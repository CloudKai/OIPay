"use server";

import { revalidatePath } from "next/cache";

import { toDatabaseDate } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { createOnce, retryTransaction } from "@/lib/server/retry-transaction";
import { assertExpectedGroupCurrency, lockWritableGroup } from "@/lib/server/group-write-lock";
import { financialConversionRecord } from "@/lib/server/record-conversion";
import { conversionAuditSnapshot } from "@/lib/currency";
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
  loadGroupFinance,
  validateSettlementAgainstBalances
} from "@/lib/server/finance";
import {
  createSettlementSchema,
  recordMutationSchema,
  updateSettlementSchema,
  zodFieldErrors
} from "@/lib/validation";

function validatePayment(
  finance: Awaited<ReturnType<typeof loadGroupFinance>>,
  input: { fromMemberId: string; toMemberId: string; amountMinor: number }
) {
  try {
    validateSettlementAgainstBalances({
      balances: finance.balances,
      ...input
    });
  } catch (error) {
    throw new ActionFailure(
      error instanceof Error ? error.message : "Invalid payment."
    );
  }
}

export async function createSettlementAction(
  input: unknown
): Promise<ActionResult<{ settlementId: string; version: number }>> {
  try {
    const parsed = createSettlementSchema.safeParse(input);
    if (!parsed.success) {
      throw new ActionFailure("Check the payment details.", zodFieldErrors(parsed.error));
    }
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireWritableGroup(membership.group);
    assertExpectedGroupCurrency(membership.group, parsed.data.expectedCurrency);
    const conversion = financialConversionRecord(parsed.data.conversion, membership.group.currency, parsed.data.amountMinor);

    const findExisting = () => prisma.settlement.findUnique({
      where: {
        groupId_idempotencyKey: {
          groupId: parsed.data.groupId,
          idempotencyKey: parsed.data.idempotencyKey
        }
      },
      select: { id: true, version: true }
    });

    const settlement = await createOnce(findExisting, () => prisma.$transaction(
      async (tx) => {
        await lockWritableGroup(tx, parsed.data.groupId, membership.group.currency);
        const finance = await loadGroupFinance(tx, parsed.data.groupId);
        validatePayment(finance, parsed.data);
        const created = await tx.settlement.create({
          data: {
            groupId: parsed.data.groupId,
            createdByMemberId: membership.id,
            fromMemberId: parsed.data.fromMemberId,
            toMemberId: parsed.data.toMemberId,
            amountMinor: parsed.data.amountMinor,
            ...conversion,
            method: parsed.data.method,
            settledAt: toDatabaseDate(parsed.data.settledAt),
            notes: parsed.data.notes || null,
            idempotencyKey: parsed.data.idempotencyKey
          }
        });
        await tx.activityLog.create({
          data: {
            groupId: parsed.data.groupId,
            actorMemberId: membership.id,
            type: "SETTLEMENT_CREATED",
            message: `${membership.displayName} recorded a payment`,
            metadata: {
              settlementId: created.id,
              amountMinor: created.amountMinor,
              currency: membership.group.currency,
              conversion: conversionAuditSnapshot(conversion),
              method: created.method
            }
          }
        });
        return created;
      },
      { isolationLevel: "Serializable" }
    ));

    revalidatePath(`/groups/${parsed.data.groupId}`);
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return {
      ok: true,
      data: { settlementId: settlement.id, version: settlement.version },
      message: "Payment recorded."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function updateSettlementAction(
  input: unknown
): Promise<ActionResult<{ settlementId: string; version: number }>> {
  try {
    const parsed = updateSettlementSchema.safeParse(input);
    if (!parsed.success) {
      throw new ActionFailure("Check the payment details.", zodFieldErrors(parsed.error));
    }
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireWritableGroup(membership.group);
    assertExpectedGroupCurrency(membership.group, parsed.data.expectedCurrency);
    const current = await prisma.settlement.findFirst({
      where: {
        id: parsed.data.settlementId,
        groupId: parsed.data.groupId,
        deletedAt: null
      }
    });
    if (!current) throw new ActionFailure("This payment no longer exists.");
    requireRecordPermission({
      membership,
      createdByMemberId: current.createdByMemberId
    });
    const conversion = financialConversionRecord(parsed.data.conversion, membership.group.currency, parsed.data.amountMinor, current);

    const nextVersion = parsed.data.expectedVersion + 1;
    await retryTransaction(() => prisma.$transaction(
      async (tx) => {
        await lockWritableGroup(tx, parsed.data.groupId, membership.group.currency);
        const finance = await loadGroupFinance(tx, parsed.data.groupId, {
          excludeSettlementId: current.id
        });
        validatePayment(finance, parsed.data);
        const updated = await tx.settlement.updateMany({
          where: {
            id: current.id,
            groupId: parsed.data.groupId,
            version: parsed.data.expectedVersion,
            deletedAt: null
          },
          data: {
            fromMemberId: parsed.data.fromMemberId,
            toMemberId: parsed.data.toMemberId,
            amountMinor: parsed.data.amountMinor,
            ...conversion,
            method: parsed.data.method,
            settledAt: toDatabaseDate(parsed.data.settledAt),
            notes: parsed.data.notes || null,
            version: { increment: 1 }
          }
        });
        if (updated.count !== 1) {
          throw new ActionFailure(
            "This payment changed in another window. Refresh and try again."
          );
        }
        await tx.activityLog.create({
          data: {
            groupId: parsed.data.groupId,
            actorMemberId: membership.id,
            type: "SETTLEMENT_UPDATED",
            message: `${membership.displayName} updated a payment`,
            metadata: {
              settlementId: current.id,
              version: nextVersion,
              previousAmountMinor: current.amountMinor,
              amountMinor: parsed.data.amountMinor,
              currency: membership.group.currency,
              previousConversion: conversionAuditSnapshot(current),
              conversion: conversionAuditSnapshot(conversion)
            }
          }
        });
      },
      { isolationLevel: "Serializable" }
    ));

    revalidatePath(`/groups/${parsed.data.groupId}`);
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return {
      ok: true,
      data: { settlementId: current.id, version: nextVersion },
      message: "Payment updated."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function deleteSettlementAction(
  input: unknown
): Promise<ActionResult<{ settlementId: string }>> {
  try {
    const parsed = recordMutationSchema.safeParse(input);
    if (!parsed.success) throw new ActionFailure("Invalid payment.");
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireWritableGroup(membership.group);
    const current = await prisma.settlement.findFirst({
      where: {
        id: parsed.data.recordId,
        groupId: parsed.data.groupId,
        deletedAt: null
      }
    });
    if (!current) throw new ActionFailure("This payment is already deleted.");
    requireRecordPermission({
      membership,
      createdByMemberId: current.createdByMemberId
    });

    await prisma.$transaction(async (tx) => {
      await lockWritableGroup(tx, parsed.data.groupId, membership.group.currency);
      const deleted = await tx.settlement.updateMany({
        where: {
          id: current.id,
          groupId: parsed.data.groupId,
          version: parsed.data.expectedVersion,
          deletedAt: null
        },
        data: { deletedAt: new Date(), version: { increment: 1 } }
      });
      if (deleted.count !== 1) {
        throw new ActionFailure(
          "This payment changed in another window. Refresh and try again."
        );
      }
      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "SETTLEMENT_DELETED",
          message: `${membership.displayName} deleted a payment`,
          metadata: { settlementId: current.id }
        }
      });
    });
    revalidatePath(`/groups/${parsed.data.groupId}`);
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return {
      ok: true,
      data: { settlementId: current.id },
      message: "Payment deleted."
    };
  } catch (error) {
    return publicActionError(error);
  }
}
