import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionUser: auth.getSessionUser }));

import { GET as exportAccount } from "@/app/api/account/export/route";
import { validateGroupMemberIds } from "@/lib/member-validation";
import { prisma } from "@/lib/prisma";
import { createOnce } from "@/lib/server/retry-transaction";

const run = process.env.RUN_DATABASE_TESTS === "true";
const suite = run ? describe : describe.skip;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const userIds: string[] = [];
const groupIds: string[] = [];

suite("PostgreSQL financial invariants", () => {
  let groupId = "";
  let ownerMemberId = "";
  let pendingMemberId = "";
  let otherMemberId = "";

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: {
        name: "Integration Owner",
        email: `owner-${suffix}@example.com`,
        emailVerified: true
      }
    });
    const other = await prisma.user.create({
      data: {
        name: "Other Group Member",
        email: `other-${suffix}@example.com`,
        emailVerified: true
      }
    });
    userIds.push(owner.id, other.id);
    auth.getSessionUser.mockResolvedValue(owner);

    const group = await prisma.group.create({
      data: {
        name: `Integration Group ${suffix}`,
        currency: "USD",
        members: {
          create: [
            {
              userId: owner.id,
              displayName: owner.name,
              email: owner.email,
              role: "OWNER",
              status: "ACTIVE"
            },
            {
              displayName: "Pending Person",
              email: `pending-${suffix}@example.com`,
              status: "INVITED"
            }
          ]
        }
      },
      include: { members: true }
    });
    groupId = group.id;
    groupIds.push(group.id);
    ownerMemberId = group.members.find((member) => member.userId === owner.id)!.id;
    pendingMemberId = group.members.find((member) => member.status === "INVITED")!.id;

    const otherGroup = await prisma.group.create({
      data: {
        name: `Other Group ${suffix}`,
        currency: "USD",
        members: {
          create: {
            userId: other.id,
            displayName: other.name,
            email: other.email,
            status: "ACTIVE"
          }
        }
      },
      include: { members: true }
    });
    groupIds.push(otherGroup.id);
    otherMemberId = otherGroup.members[0]!.id;
  });

  afterAll(async () => {
    await prisma.expenseShare.deleteMany({
      where: { expense: { groupId: { in: groupIds } } }
    });
    await prisma.activityLog.deleteMany({
      where: { groupId: { in: groupIds } }
    });
    await prisma.settlement.deleteMany({
      where: { groupId: { in: groupIds } }
    });
    await prisma.expense.deleteMany({
      where: { groupId: { in: groupIds } }
    });
    await prisma.groupMember.deleteMany({
      where: { groupId: { in: groupIds } }
    });
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("keeps pending members available for expense shares", async () => {
    const expense = await prisma.expense.create({
      data: {
        groupId,
        createdByMemberId: ownerMemberId,
        paidByMemberId: ownerMemberId,
        description: "Pending member expense",
        totalMinor: 101,
        splitType: "EQUAL",
        expenseDate: new Date(),
        idempotencyKey: `pending-${suffix}`,
        shares: {
          create: [
            { memberId: ownerMemberId, shareMinor: 51 },
            { memberId: pendingMemberId, shareMinor: 50 }
          ]
        }
      },
      include: { shares: true }
    });
    expect(expense.shares.reduce((sum, share) => sum + share.shareMinor, 0)).toBe(
      101
    );
  });

  it("rejects member IDs from another group in the domain validator", async () => {
    await expect(
      validateGroupMemberIds(prisma, {
        groupId,
        paidByMemberId: ownerMemberId,
        splitMemberIds: [ownerMemberId, otherMemberId]
      })
    ).resolves.toBe("Every participant must belong to this group.");
  });

  it("prevents duplicate submissions with a group-scoped key", async () => {
    const data = {
      groupId,
      createdByMemberId: ownerMemberId,
      paidByMemberId: ownerMemberId,
      description: "Duplicate protected",
      totalMinor: 100,
      splitType: "EXACT" as const,
      expenseDate: new Date(),
      idempotencyKey: `duplicate-${suffix}`
    };
    await prisma.expense.create({ data });
    await expect(prisma.expense.create({ data })).rejects.toMatchObject({
      code: "P2002"
    });
  });

  it("detects simultaneous edits with versioned updates", async () => {
    const expense = await prisma.expense.create({
      data: {
        groupId,
        createdByMemberId: ownerMemberId,
        paidByMemberId: ownerMemberId,
        description: "Versioned",
        totalMinor: 100,
        splitType: "EXACT",
        expenseDate: new Date(),
        idempotencyKey: `version-${suffix}`
      }
    });
    const first = await prisma.expense.updateMany({
      where: { id: expense.id, version: 1 },
      data: { version: { increment: 1 } }
    });
    const stale = await prisma.expense.updateMany({
      where: { id: expense.id, version: 1 },
      data: { version: { increment: 1 } }
    });
    expect(first.count).toBe(1);
    expect(stale.count).toBe(0);
  });

  it("keeps soft-deleted records out of active balance queries", async () => {
    const expense = await prisma.expense.create({
      data: {
        groupId,
        createdByMemberId: ownerMemberId,
        paidByMemberId: ownerMemberId,
        description: "Soft deleted",
        totalMinor: 100,
        splitType: "EXACT",
        expenseDate: new Date(),
        idempotencyKey: `deleted-${suffix}`,
        deletedAt: new Date()
      }
    });
    expect(
      await prisma.expense.count({
        where: { id: expense.id, deletedAt: null }
      })
    ).toBe(0);
  });

  it("enforces positive amounts at the database layer", async () => {
    await expect(
      prisma.settlement.create({
        data: {
          groupId,
          createdByMemberId: ownerMemberId,
          fromMemberId: pendingMemberId,
          toMemberId: ownerMemberId,
          amountMinor: -1,
          settledAt: new Date(),
          idempotencyKey: `negative-${suffix}`
        }
      })
    ).rejects.toBeTruthy();
  });

  it("exports group data only while the requesting member is active", async () => {
    try {
      for (const status of ["ACTIVE", "INVITED", "REMOVED"] as const) {
        await prisma.groupMember.update({
          where: { id: ownerMemberId },
          data: { status }
        });
        const response = await exportAccount();
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.account.memberships.some(
          (member: { id: string }) => member.id === ownerMemberId
        )).toBe(status === "ACTIVE");
      }
    } finally {
      await prisma.groupMember.update({
        where: { id: ownerMemberId },
        data: { status: "ACTIVE" }
      });
    }
  });

  it("acknowledges concurrent duplicate creates as the same saved expense", async () => {
    const idempotencyKey = `concurrent-${suffix}`;
    const find = () => prisma.expense.findUnique({
      where: { groupId_idempotencyKey: { groupId, idempotencyKey } },
      select: { id: true, version: true }
    });
    const create = () => prisma.$transaction(async (tx) => tx.expense.create({
      data: {
        groupId,
        createdByMemberId: ownerMemberId,
        paidByMemberId: ownerMemberId,
        description: "Concurrent retry",
        totalMinor: 100,
        splitType: "EQUAL",
        expenseDate: new Date(),
        idempotencyKey,
        shares: { create: { memberId: ownerMemberId, shareMinor: 100 } }
      }
    }));
    const [first, second] = await Promise.all([
      createOnce(find, create),
      createOnce(find, create)
    ]);
    expect(first.id).toBe(second.id);
    expect(await prisma.expense.count({ where: { groupId, idempotencyKey } })).toBe(1);
  });
});
