import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ session: vi.fn(), membershipRead: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionUser: auth.session, getSessionPrincipal: auth.session }));
vi.mock("@/lib/server/authz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/authz")>();
  return {
    ...actual,
    requireMembership: async (...args: Parameters<typeof actual.requireMembership>) => {
      const membership = await actual.requireMembership(...args);
      auth.membershipRead(membership);
      return membership;
    }
  };
});

import { createExpenseAction } from "@/app/actions/expenses";
import { updateGroupAction } from "@/app/actions/groups";
import { prisma } from "@/lib/prisma";
import { lockWritableGroup } from "@/lib/server/group-write-lock";

const suite = process.env.RUN_DATABASE_TESTS === "true" ? describe : describe.skip;

function barrier() {
  let resolve!: () => void;
  return { promise: new Promise<void>((done) => { resolve = done; }), release: () => resolve() };
}

suite("concurrent group settings and financial writes", () => {
  const groupIds: string[] = [];
  const userIds: string[] = [];
  let groupId: string;
  let ownerId: string;

  beforeEach(async () => {
    auth.membershipRead.mockReset();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const user = await prisma.user.create({ data: { name: "Lock Test Owner", email: `lock-${unique}@example.com`, emailVerified: true } });
    userIds.push(user.id);
    auth.session.mockResolvedValue(user);
    const group = await prisma.group.create({
      data: {
        name: "Concurrent trip", currency: "USD",
        members: { create: { userId: user.id, displayName: user.name, email: user.email, role: "OWNER", status: "ACTIVE" } }
      }, include: { members: true }
    });
    groupId = group.id;
    groupIds.push(groupId);
    ownerId = group.members[0]!.id;
  });

  afterAll(async () => {
    await prisma.expenseShare.deleteMany({ where: { expense: { groupId: { in: groupIds } } } });
    await prisma.activityLog.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.settlement.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.expense.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.groupMember.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  function expenseInput() {
    return {
      groupId, expectedCurrency: "USD", description: "First expense", totalMinor: 100,
      paidByMemberId: ownerId, splitType: "EQUAL", category: "GENERAL", expenseDate: "2026-01-02",
      splits: [{ memberId: ownerId }], idempotencyKey: `expense-${groupId}`
    };
  }

  it("prevents a queued currency change after the first expense commits", async () => {
    const locked = barrier();
    const releaseWriter = barrier();
    const membershipRead = barrier();
    const writer = prisma.$transaction(async (tx) => {
      await lockWritableGroup(tx, groupId, "USD");
      await tx.expense.create({ data: {
        groupId, createdByMemberId: ownerId, paidByMemberId: ownerId, description: "First expense",
        totalMinor: 100, splitType: "EQUAL", expenseDate: new Date("2026-01-02"),
        idempotencyKey: `first-${groupId}`, shares: { create: { memberId: ownerId, shareMinor: 100 } }
      } });
      locked.release();
      await releaseWriter.promise;
    });
    await locked.promise;
    auth.membershipRead.mockImplementationOnce(() => membershipRead.release());
    const settings = updateGroupAction({ groupId, name: "Concurrent trip", currency: "EUR" });
    try {
      await membershipRead.promise;
    } finally {
      releaseWriter.release();
    }
    await writer;
    expect(await settings).toMatchObject({ ok: false, message: expect.stringContaining("cannot be changed") });
    expect((await prisma.group.findUniqueOrThrow({ where: { id: groupId } })).currency).toBe("USD");
    expect(await prisma.expense.count({ where: { groupId } })).toBe(1);
  });

  it("rejects an expense authorized before a concurrent currency change commits", async () => {
    const locked = barrier();
    const releaseSettings = barrier();
    const membershipRead = barrier();
    const settings = prisma.$transaction(async (tx) => {
      await lockWritableGroup(tx, groupId);
      await tx.group.update({ where: { id: groupId }, data: { currency: "EUR" } });
      locked.release();
      await releaseSettings.promise;
    });
    await locked.promise;
    auth.membershipRead.mockImplementationOnce((membership) => {
      expect(membership.group.currency).toBe("USD");
      membershipRead.release();
    });
    const expense = createExpenseAction(expenseInput());
    try {
      await membershipRead.promise;
    } finally {
      releaseSettings.release();
    }
    await settings;
    expect(await expense).toMatchObject({ ok: false, message: expect.stringContaining("currency changed") });
    expect(await prisma.expense.count({ where: { groupId } })).toBe(0);
  });

  it("rejects a financial write authorized before archiving commits", async () => {
    const archived = barrier();
    const releaseArchive = barrier();
    const membershipRead = barrier();
    const archive = prisma.$transaction(async (tx) => {
      await tx.group.update({ where: { id: groupId }, data: { archivedAt: new Date() } });
      archived.release();
      await releaseArchive.promise;
    });
    await archived.promise;
    auth.membershipRead.mockImplementationOnce((membership) => {
      expect(membership.group.archivedAt).toBeNull();
      membershipRead.release();
    });
    const expense = createExpenseAction(expenseInput());
    try {
      await membershipRead.promise;
    } finally {
      releaseArchive.release();
    }
    await archive;
    expect(await expense).toMatchObject({ ok: false, message: expect.stringContaining("archived") });
    expect(await prisma.expense.count({ where: { groupId } })).toBe(0);
  });
});
