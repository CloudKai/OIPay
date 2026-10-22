"use server";

import { revalidatePath } from "next/cache";

import { calculateShares } from "@/lib/splits";
import { prisma } from "@/lib/prisma";
import { createOnce } from "@/lib/server/retry-transaction";
import { assertExpectedGroupCurrency, lockWritableGroup } from "@/lib/server/group-write-lock";
import type { ActionResult } from "@/lib/result";
import {
  ActionFailure,
  publicActionError,
  requireActionUser,
  requireMembership,
  requireRecordPermission,
  requireWritableGroup
} from "@/lib/server/authz";
import {
  createExpenseSchema,
  recordMutationSchema,
  updateExpenseSchema,
  zodFieldErrors
} from "@/lib/validation";
import { toDatabaseDate } from "@/lib/money";
import { validateGroupMemberIds } from "@/lib/member-validation";
import { financialConversionRecord } from "@/lib/server/record-conversion";
import { conversionAuditSnapshot } from "@/lib/currency";

async function validateExpenseMembers(
  groupId: string,
  paidByMemberId: string,
  splitMemberIds: string[]
) {
  const message = await validateGroupMemberIds(prisma, {
    groupId,
    paidByMemberId,
    splitMemberIds
  });
  if (message) throw new ActionFailure(message);
}

export async function createExpenseAction(
  input: unknown
): Promise<ActionResult<{ expenseId: string; version: number }>> {
  try {
    const parsed = createExpenseSchema.safeParse(input);
    if (!parsed.success) {
      throw new ActionFailure("Check the expense details.", zodFieldErrors(parsed.error));
    }
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireWritableGroup(membership.group);
    assertExpectedGroupCurrency(membership.group, parsed.data.expectedCurrency);
    const conversion = financialConversionRecord(parsed.data.conversion, membership.group.currency, parsed.data.totalMinor);

    const findExisting = () => prisma.expense.findUnique({
      where: {
        groupId_idempotencyKey: {
          groupId: parsed.data.groupId,
          idempotencyKey: parsed.data.idempotencyKey
        }
      },
      select: { id: true, version: true }
    });

    await validateExpenseMembers(
      parsed.data.groupId,
      parsed.data.paidByMemberId,
      parsed.data.splits.map((split) => split.memberId)
    );

    let shares;
    try {
      shares = calculateShares({
        totalMinor: parsed.data.totalMinor,
        splitType: parsed.data.splitType,
        splits: parsed.data.splits
      });
    } catch (error) {
      throw new ActionFailure(
        error instanceof Error ? error.message : "Invalid split."
      );
    }

    const expense = await createOnce(findExisting, () => prisma.$transaction(async (tx) => {
      await lockWritableGroup(tx, parsed.data.groupId, membership.group.currency);
      const created = await tx.expense.create({
        data: {
          groupId: parsed.data.groupId,
          createdByMemberId: membership.id,
          paidByMemberId: parsed.data.paidByMemberId,
          description: parsed.data.description,
          totalMinor: parsed.data.totalMinor,
          ...conversion,
          splitType: parsed.data.splitType,
          category: parsed.data.category,
          expenseDate: toDatabaseDate(parsed.data.expenseDate),
          notes: parsed.data.notes || null,
          idempotencyKey: parsed.data.idempotencyKey
        }
      });
      await tx.expenseShare.createMany({
        data: shares.map((share) => ({
          expenseId: created.id,
          memberId: share.memberId,
          shareMinor: share.shareMinor,
          percentageBps: share.percentageBps,
          weight: share.weight
        }))
      });
      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "EXPENSE_CREATED",
          message: `${membership.displayName} added ${parsed.data.description}`,
          metadata: {
            expenseId: created.id,
            totalMinor: created.totalMinor,
            currency: membership.group.currency,
            conversion: conversionAuditSnapshot(conversion),
            splitType: created.splitType
          }
        }
      });
      return created;
    }));

    revalidatePath(`/groups/${parsed.data.groupId}`);
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return {
      ok: true,
      data: { expenseId: expense.id, version: expense.version },
      message: "Expense added."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function updateExpenseAction(
  input: unknown
): Promise<ActionResult<{ expenseId: string; version: number }>> {
  try {
    const parsed = updateExpenseSchema.safeParse(input);
    if (!parsed.success) {
      throw new ActionFailure("Check the expense details.", zodFieldErrors(parsed.error));
    }
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireWritableGroup(membership.group);
    assertExpectedGroupCurrency(membership.group, parsed.data.expectedCurrency);
    const current = await prisma.expense.findFirst({
      where: {
        id: parsed.data.expenseId,
        groupId: parsed.data.groupId,
        deletedAt: null
      }
    });
    if (!current) throw new ActionFailure("This expense no longer exists.");
    requireRecordPermission({
      membership,
      createdByMemberId: current.createdByMemberId
    });
    const conversion = financialConversionRecord(parsed.data.conversion, membership.group.currency, parsed.data.totalMinor, current);

    await validateExpenseMembers(
      parsed.data.groupId,
      parsed.data.paidByMemberId,
      parsed.data.splits.map((split) => split.memberId)
    );

    let shares;
    try {
      shares = calculateShares({
        totalMinor: parsed.data.totalMinor,
        splitType: parsed.data.splitType,
        splits: parsed.data.splits
      });
    } catch (error) {
      throw new ActionFailure(
        error instanceof Error ? error.message : "Invalid split."
      );
    }

    const nextVersion = parsed.data.expectedVersion + 1;
    await prisma.$transaction(async (tx) => {
      await lockWritableGroup(tx, parsed.data.groupId, membership.group.currency);
      const updated = await tx.expense.updateMany({
        where: {
          id: parsed.data.expenseId,
          groupId: parsed.data.groupId,
          version: parsed.data.expectedVersion,
          deletedAt: null
        },
        data: {
          paidByMemberId: parsed.data.paidByMemberId,
          description: parsed.data.description,
          totalMinor: parsed.data.totalMinor,
          ...conversion,
          splitType: parsed.data.splitType,
          category: parsed.data.category,
          expenseDate: toDatabaseDate(parsed.data.expenseDate),
          notes: parsed.data.notes || null,
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) {
        throw new ActionFailure(
          "This expense changed in another window. Refresh and try again."
        );
      }
      await tx.expenseShare.deleteMany({
        where: { expenseId: parsed.data.expenseId }
      });
      await tx.expenseShare.createMany({
        data: shares.map((share) => ({
          expenseId: parsed.data.expenseId,
          memberId: share.memberId,
          shareMinor: share.shareMinor,
          percentageBps: share.percentageBps,
          weight: share.weight
        }))
      });
      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "EXPENSE_UPDATED",
          message: `${membership.displayName} updated ${parsed.data.description}`,
          metadata: {
            expenseId: parsed.data.expenseId,
            version: nextVersion,
            previousTotalMinor: current.totalMinor,
            totalMinor: parsed.data.totalMinor,
            currency: membership.group.currency,
            previousConversion: conversionAuditSnapshot(current),
            conversion: conversionAuditSnapshot(conversion)
          }
        }
      });
    });

    revalidatePath(`/groups/${parsed.data.groupId}`);
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return {
      ok: true,
      data: { expenseId: parsed.data.expenseId, version: nextVersion },
      message: "Expense updated."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function deleteExpenseAction(
  input: unknown
): Promise<ActionResult<{ expenseId: string }>> {
  try {
    const parsed = recordMutationSchema.safeParse(input);
    if (!parsed.success) throw new ActionFailure("Invalid expense.");
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireWritableGroup(membership.group);
    const current = await prisma.expense.findFirst({
      where: {
        id: parsed.data.recordId,
        groupId: parsed.data.groupId,
        deletedAt: null
      }
    });
    if (!current) throw new ActionFailure("This expense is already deleted.");
    requireRecordPermission({
      membership,
      createdByMemberId: current.createdByMemberId
    });

    await prisma.$transaction(async (tx) => {
      await lockWritableGroup(tx, parsed.data.groupId, membership.group.currency);
      const deleted = await tx.expense.updateMany({
        where: {
          id: parsed.data.recordId,
          groupId: parsed.data.groupId,
          version: parsed.data.expectedVersion,
          deletedAt: null
        },
        data: { deletedAt: new Date(), version: { increment: 1 } }
      });
      if (deleted.count !== 1) {
        throw new ActionFailure(
          "This expense changed in another window. Refresh and try again."
        );
      }
      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "EXPENSE_DELETED",
          message: `${membership.displayName} deleted ${current.description}`,
          metadata: { expenseId: current.id }
        }
      });
    });
    revalidatePath(`/groups/${parsed.data.groupId}`);
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return {
      ok: true,
      data: { expenseId: current.id },
      message: "Expense deleted."
    };
  } catch (error) {
    return publicActionError(error);
  }
}
