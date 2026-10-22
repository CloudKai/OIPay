import type { MemberBalance, SimplifiedDebt } from "@/lib/domain";

export type BalanceMember = {
  id: string;
  name: string;
};

export type BalanceExpense = {
  paidByMemberId: string;
  totalMinor: number;
  shares: { memberId: string; shareMinor: number }[];
};

export type BalanceSettlement = {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
};

export function computeGroupBalances(input: {
  members: BalanceMember[];
  expenses: BalanceExpense[];
  settlements: BalanceSettlement[];
}): { balances: MemberBalance[]; simplifiedDebts: SimplifiedDebt[] } {
  const paid = new Map(input.members.map((member) => [member.id, 0]));
  const owed = new Map(input.members.map((member) => [member.id, 0]));

  for (const expense of input.expenses) {
    paid.set(
      expense.paidByMemberId,
      (paid.get(expense.paidByMemberId) ?? 0) + expense.totalMinor
    );
    for (const share of expense.shares) {
      owed.set(share.memberId, (owed.get(share.memberId) ?? 0) + share.shareMinor);
    }
  }

  for (const settlement of input.settlements) {
    paid.set(
      settlement.fromMemberId,
      (paid.get(settlement.fromMemberId) ?? 0) + settlement.amountMinor
    );
    owed.set(
      settlement.toMemberId,
      (owed.get(settlement.toMemberId) ?? 0) + settlement.amountMinor
    );
  }

  const balances = input.members.map((member) => {
    const paidMinor = paid.get(member.id) ?? 0;
    const owedMinor = owed.get(member.id) ?? 0;
    return {
      memberId: member.id,
      name: member.name,
      paidMinor,
      owedMinor,
      netMinor: paidMinor - owedMinor
    };
  });

  return { balances, simplifiedDebts: simplifyDebts(balances) };
}

export function simplifyDebts(balances: MemberBalance[]): SimplifiedDebt[] {
  const names = new Map(balances.map((balance) => [balance.memberId, balance.name]));

  const creditors = balances
    .filter((balance) => balance.netMinor > 0)
    .map((balance) => ({
      memberId: balance.memberId,
      amountMinor: balance.netMinor
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor || a.memberId.localeCompare(b.memberId));
  const debtors = balances
    .filter((balance) => balance.netMinor < 0)
    .map((balance) => ({
      memberId: balance.memberId,
      amountMinor: Math.abs(balance.netMinor)
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor || a.memberId.localeCompare(b.memberId));

  const simplifiedDebts: SimplifiedDebt[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    if (!debtor || !creditor) break;

    const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor);
    simplifiedDebts.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      fromName: names.get(debtor.memberId) ?? debtor.memberId,
      toName: names.get(creditor.memberId) ?? creditor.memberId,
      amountMinor
    });

    debtor.amountMinor -= amountMinor;
    creditor.amountMinor -= amountMinor;
    if (debtor.amountMinor === 0) debtorIndex += 1;
    if (creditor.amountMinor === 0) creditorIndex += 1;
  }

  return simplifiedDebts;
}
