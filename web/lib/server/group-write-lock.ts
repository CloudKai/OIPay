import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ActionFailure, requireWritableGroup } from "@/lib/server/authz";

type GroupWriteState = { id: string; currency: string; archivedAt: Date | null };

export function assertExpectedGroupCurrency(group: { currency: string }, expectedCurrency?: string): void {
  if (expectedCurrency && group.currency !== expectedCurrency) {
    throw new ActionFailure("The group currency changed. Refresh the group and check the amount before saving.");
  }
}

/** Acquire this before financial reads/writes or settings changes, inside their transaction. */
export async function lockWritableGroup(
  tx: Pick<Prisma.TransactionClient, "$queryRaw">,
  groupId: string,
  expectedCurrency?: string
): Promise<GroupWriteState> {
  // Every financial mutation and currency update takes the same first lock.
  // A queued action then sees the committed currency/archive state, not its earlier authorization snapshot.
  const groups = await tx.$queryRaw<GroupWriteState[]>`
    SELECT "id", "currency", "archivedAt" FROM "Group" WHERE "id" = ${groupId} FOR UPDATE
  `;
  const group = groups[0];
  if (!group) throw new ActionFailure("This group no longer exists.");
  requireWritableGroup(group);
  assertExpectedGroupCurrency(group, expectedCurrency);
  return group;
}
