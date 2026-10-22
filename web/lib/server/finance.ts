import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { simplifyDebts } from "@/lib/balances";

export type FinanceClient = Pick<PrismaClient, "groupMember" | "expense" | "expenseShare" | "settlement">;

// Transfer one total per member instead of every expense, share and payment.
// Call within the caller's transaction when a consistent snapshot is required.
export async function loadMemberTotals(
  client: FinanceClient,
  groupIds: string[],
  memberIds: string[],
  options?: { excludeSettlementId?: string }
) {
  if (memberIds.length === 0) return new Map<string, { paidMinor: number; owedMinor: number; netMinor: number }>();
  const settlementWhere = {
    groupId: { in: groupIds },
    deletedAt: null,
    ...(options?.excludeSettlementId ? { id: { not: options.excludeSettlementId } } : {})
  };
  const [expenses, shares, paidSettlements, receivedSettlements] = await Promise.all([
    client.expense.groupBy({
      by: ["paidByMemberId"],
      where: { groupId: { in: groupIds }, deletedAt: null, paidByMemberId: { in: memberIds } },
      _sum: { totalMinor: true }
    }),
    client.expenseShare.groupBy({
      by: ["memberId"],
      where: { memberId: { in: memberIds }, expense: { groupId: { in: groupIds }, deletedAt: null } },
      _sum: { shareMinor: true }
    }),
    client.settlement.groupBy({
      by: ["fromMemberId"],
      where: { ...settlementWhere, fromMemberId: { in: memberIds } },
      _sum: { amountMinor: true }
    }),
    client.settlement.groupBy({
      by: ["toMemberId"],
      where: { ...settlementWhere, toMemberId: { in: memberIds } },
      _sum: { amountMinor: true }
    })
  ]);
  const paid = new Map(expenses.map((item) => [item.paidByMemberId, item._sum.totalMinor ?? 0]));
  const owed = new Map(shares.map((item) => [item.memberId, item._sum.shareMinor ?? 0]));
  for (const item of paidSettlements) paid.set(item.fromMemberId, (paid.get(item.fromMemberId) ?? 0) + (item._sum.amountMinor ?? 0));
  for (const item of receivedSettlements) owed.set(item.toMemberId, (owed.get(item.toMemberId) ?? 0) + (item._sum.amountMinor ?? 0));
  return new Map(memberIds.map((id) => {
    const paidMinor = paid.get(id) ?? 0;
    const owedMinor = owed.get(id) ?? 0;
    return [id, { paidMinor, owedMinor, netMinor: paidMinor - owedMinor }];
  }));
}

export async function loadGroupFinance(
  client: FinanceClient,
  groupId: string,
  options?: { excludeSettlementId?: string }
) {
  const members = await client.groupMember.findMany({
    where: { groupId }, select: { id: true, displayName: true }
  });
  const totals = await loadMemberTotals(client, [groupId], members.map((member) => member.id), options);
  const balances = members.map((member) => ({
    memberId: member.id,
    name: member.displayName,
    ...totals.get(member.id)!
  }));
  return { balances, simplifiedDebts: simplifyDebts(balances) };
}

export function validateSettlementAgainstBalances(input: {
  balances: Awaited<ReturnType<typeof loadGroupFinance>>["balances"];
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}): void {
  const from = input.balances.find(
    (balance) => balance.memberId === input.fromMemberId
  );
  const to = input.balances.find(
    (balance) => balance.memberId === input.toMemberId
  );

  if (!from || !to || from.memberId === to.memberId) {
    throw new Error("Choose two different group members.");
  }
  if (from.netMinor >= 0 || to.netMinor <= 0) {
    throw new Error(
      "The payer must currently owe money and the receiver must currently be owed money."
    );
  }

  const maximum = Math.min(Math.abs(from.netMinor), to.netMinor);
  if (input.amountMinor > maximum) {
    throw new Error("The payment is larger than the current amount owed.");
  }
}
