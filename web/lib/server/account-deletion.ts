import "server-only";

import { prisma } from "@/lib/prisma";
import { ActionFailure } from "@/lib/server/authz";
import { retryTransaction } from "@/lib/server/retry-transaction";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function requestAccountDeletion(userId: string, authUserId: string) {
  // Validate recovery configuration before removing any app data.
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) {
    throw new ActionFailure("Account deletion is temporarily unavailable. Please try again later.");
  }
  createSupabaseAdminClient();

  await retryTransaction(() => prisma.$transaction(async (tx) => {
    // Synchronization takes this same lock so a concurrent login cannot recreate
    // the profile between deletion and creation of the durable job.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${authUserId}))`;
    if (await tx.accountDeletionJob.findUnique({ where: { authUserId } })) return;

    const ownedMemberships = await tx.groupMember.findMany({
      where: { userId, status: "ACTIVE", role: "OWNER" },
      select: { id: true, groupId: true, group: { select: { name: true } } }
    });
    for (const owned of ownedMemberships) {
      const otherOwners = await tx.groupMember.count({
        where: { groupId: owned.groupId, status: "ACTIVE", role: "OWNER", id: { not: owned.id } }
      });
      if (otherOwners === 0) {
        throw new ActionFailure(`Transfer ownership of ${owned.group.name} before deleting your account.`);
      }
    }

    await tx.accountDeletionJob.create({ data: { authUserId } });
    const memberships = await tx.groupMember.findMany({
      where: { userId },
      select: { id: true }
    });
    for (const membership of memberships) {
      await tx.groupMember.update({
        where: { id: membership.id },
        data: {
          userId: null,
          displayName: "Deleted member",
          email: null,
          displayNameKey: null,
          guestSessionId: null,
          guestRecoveryTokenHash: null,
          guestRecoveryExpiresAt: null,
          role: "MEMBER",
          status: "REMOVED",
          invitationTokenHash: null,
          invitationExpiresAt: null,
          invitationDeliveryStatus: null
        }
      });
    }
    await tx.user.delete({ where: { id: userId } });
  }, { isolationLevel: "Serializable" }));
}

export async function processAccountDeletion(authUserId: string): Promise<boolean> {
  const now = new Date();
  const job = await prisma.accountDeletionJob.findUnique({ where: { authUserId } });
  if (!job) return false;
  if (job.completedAt) return true;

  // A short lease prevents concurrent workers. An interrupted worker becomes
  // eligible again automatically; no in-memory state is needed for recovery.
  const claimed = await prisma.accountDeletionJob.updateMany({
    where: { authUserId, completedAt: null, nextAttemptAt: { lte: now } },
    data: { attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + 5 * 60_000) }
  });
  if (claimed.count !== 1) return false;

  try {
    const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(authUserId);
    // The provider may have completed deletion before an earlier response was lost.
    if (error && error.code !== "user_not_found") throw error;
    await prisma.accountDeletionJob.update({
      where: { authUserId },
      data: { completedAt: new Date() }
    });
    return true;
  } catch {
    // Do not log provider payloads, email addresses, or auth IDs.
    console.error("[account-deletion] Login cleanup failed; saved job will be retried.");
    return false;
  }
}
