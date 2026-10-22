export type BalanceMember = {
  id: string;
  name: string;
};

export type BalanceExpense = {
  id: string;
  paidByMemberId: string;
  totalCents: number;
  shares: { memberId: string; shareCents: number }[];
};

export type BalanceSettlement = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
};

export type MemberBalance = {
  memberId: string;
  name: string;
  paidCents: number;
  owedCents: number;
  netCents: number;
};

export type SimplifiedDebt = {
  fromMemberId: string;
  toMemberId: string;
  fromName: string;
  toName: string;
  amountCents: number;
};

export function computeGroupBalances(input: {
  members: BalanceMember[];
  expenses: BalanceExpense[];
  settlements: BalanceSettlement[];
}): { balances: MemberBalance[]; simplifiedDebts: SimplifiedDebt[] } {
  const memberNames = new Map(input.members.map((member) => [member.id, member.name]));
  const paidByMember = new Map<string, number>();
  const owedByMember = new Map<string, number>();

  for (const member of input.members) {
    paidByMember.set(member.id, 0);
    owedByMember.set(member.id, 0);
  }

  for (const expense of input.expenses) {
    paidByMember.set(
      expense.paidByMemberId,
      (paidByMember.get(expense.paidByMemberId) ?? 0) + expense.totalCents
    );

    for (const share of expense.shares) {
      owedByMember.set(share.memberId, (owedByMember.get(share.memberId) ?? 0) + share.shareCents);
    }
  }

  for (const settlement of input.settlements) {
    // Settlement is represented as an opposite balance entry:
    // - payer gets credit (+paid)
    // - receiver gets debt (+owed)
    paidByMember.set(
      settlement.fromMemberId,
      (paidByMember.get(settlement.fromMemberId) ?? 0) + settlement.amountCents
    );

    owedByMember.set(
      settlement.toMemberId,
      (owedByMember.get(settlement.toMemberId) ?? 0) + settlement.amountCents
    );
  }

  const balances: MemberBalance[] = input.members.map((member) => {
    const paidCents = paidByMember.get(member.id) ?? 0;
    const owedCents = owedByMember.get(member.id) ?? 0;

    return {
      memberId: member.id,
      name: member.name,
      paidCents,
      owedCents,
      netCents: paidCents - owedCents
    };
  });

  const creditors = balances
    .filter((member) => member.netCents > 0)
    .map((member) => ({ memberId: member.memberId, amountCents: member.netCents }));

  const debtors = balances
    .filter((member) => member.netCents < 0)
    .map((member) => ({ memberId: member.memberId, amountCents: Math.abs(member.netCents) }));

  creditors.sort((a, b) => b.amountCents - a.amountCents);
  debtors.sort((a, b) => b.amountCents - a.amountCents);

  const simplifiedDebts: SimplifiedDebt[] = [];

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    const amountCents = Math.min(debtor.amountCents, creditor.amountCents);

    if (amountCents > 0) {
      simplifiedDebts.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        fromName: memberNames.get(debtor.memberId) ?? debtor.memberId,
        toName: memberNames.get(creditor.memberId) ?? creditor.memberId,
        amountCents
      });
    }

    debtor.amountCents -= amountCents;
    creditor.amountCents -= amountCents;

    if (debtor.amountCents === 0) {
      debtorIndex += 1;
    }

    if (creditor.amountCents === 0) {
      creditorIndex += 1;
    }
  }

  return { balances, simplifiedDebts };
}
