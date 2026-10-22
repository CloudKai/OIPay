import { randomUUID } from "node:crypto";
import type { User as AuthUser } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Never call an external account service from a database integration test.
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));

import { prisma } from "@/lib/prisma";
import { requestAccountDeletion } from "@/lib/server/account-deletion";
import { AccountDeletionRequested, AppUserSynchronizer } from "@/lib/session";

const suite = process.env.RUN_DATABASE_TESTS === "true" ? describe : describe.skip;
const authIds: string[] = [];
const userIds: string[] = [];
const groupIds: string[] = [];

suite("durable account deletion", () => {
  beforeAll(() => vi.stubEnv("CRON_SECRET", "integration-only-secret".repeat(2)));
  afterAll(async () => {
    await prisma.groupMember.deleteMany({ where: { groupId: { in: groupIds } } });
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.accountDeletionJob.deleteMany({ where: { authUserId: { in: authIds } } });
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });

  async function fixture(role: "OWNER" | "MEMBER") {
    const authUserId = randomUUID();
    const user = await prisma.user.create({
      data: { authUserId, name: "Deletion Test", email: `${authUserId}@example.com` }
    });
    authIds.push(authUserId);
    userIds.push(user.id);
    const group = await prisma.group.create({
      data: { name: "Deletion test", members: { create: {
        userId: user.id, email: user.email, displayName: user.name, role
      } } },
      include: { members: true }
    });
    groupIds.push(group.id);
    return { user, group, member: group.members[0]!, authUserId };
  }

  it("commits cleanup with a recovery job and blocks stale identity synchronization", async () => {
    const { user, member, authUserId } = await fixture("MEMBER");
    await requestAccountDeletion(user.id, authUserId);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.accountDeletionJob.findUnique({ where: { authUserId } })).toMatchObject({ completedAt: null });
    expect(await prisma.groupMember.findUnique({ where: { id: member.id } })).toMatchObject({
      userId: null, status: "REMOVED", displayName: "Deleted member"
    });
    await expect(new AppUserSynchronizer().synchronize({
      id: authUserId, email: user.email
    } as AuthUser)).rejects.toBeInstanceOf(AccountDeletionRequested);
  });

  it("rolls back the recovery job when profile cleanup fails", async () => {
    const { user, member, authUserId } = await fixture("MEMBER");
    // Reject this fixture's anonymization after the recovery job is inserted.
    // The temporary constraint exercises rollback in a real database transaction.
    const constraintName = `deletion_rollback_${randomUUID().replaceAll("-", "")}`;
    const memberIdLiteral = member.id.replaceAll("'", "''");
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "GroupMember" ADD CONSTRAINT "${constraintName}" CHECK ("id" <> '${memberIdLiteral}' OR "userId" IS NOT NULL) NOT VALID`
    );
    try {
      await expect(requestAccountDeletion(user.id, authUserId)).rejects.toThrow(/constraint|23514/i);
      expect(await prisma.accountDeletionJob.findUnique({ where: { authUserId } })).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
      expect(await prisma.groupMember.findUnique({ where: { id: member.id } })).toMatchObject({ userId: user.id, status: "ACTIVE" });
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "GroupMember" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
    }
  });

  it("preserves the last owner and does not queue deletion", async () => {
    const { user, authUserId } = await fixture("OWNER");
    await expect(requestAccountDeletion(user.id, authUserId)).rejects.toThrow("Transfer ownership");
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect(await prisma.accountDeletionJob.findUnique({ where: { authUserId } })).toBeNull();
  });
});
