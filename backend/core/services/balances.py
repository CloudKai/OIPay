"""Balance + settlement computation.

- `compute_member_balances(room)` returns each member's paid/owed/net in cents.
- `simplify_settlements(balances)` turns net balances into minimal-ish transfers
    using a greedy debtor→creditor matching algorithm.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from django.db.models import Sum

from core.models import Expense, ExpenseSplit, Member, Room


@dataclass(frozen=True)
class MemberBalance:
    member_id: str
    paid_cents: int
    owed_cents: int

    @property
    def net_cents(self) -> int:
        # Positive means others owe them; negative means they owe others.
        return self.paid_cents - self.owed_cents


def compute_member_balances(room: Room) -> List[MemberBalance]:
    members = list(room.members.all())
    paid_by_member: Dict[str, int] = {str(m.id): 0 for m in members}
    owed_by_member: Dict[str, int] = {str(m.id): 0 for m in members}

    paid_rows = (
        Expense.objects.filter(room=room)
        .values('payer_member_id')
        .annotate(total=Sum('amount_cents'))
    )
    for row in paid_rows:
        paid_by_member[str(row['payer_member_id'])] = int(row['total'] or 0)

    owed_rows = (
        ExpenseSplit.objects.filter(expense__room=room)
        .values('member_id')
        .annotate(total=Sum('share_cents'))
    )
    for row in owed_rows:
        owed_by_member[str(row['member_id'])] = int(row['total'] or 0)

    return [
        MemberBalance(
            member_id=str(m.id),
            paid_cents=paid_by_member[str(m.id)],
            owed_cents=owed_by_member[str(m.id)],
        )
        for m in members
    ]


def simplify_settlements(balances: List[MemberBalance]) -> List[dict]:
    # Greedy debtor -> creditor matching.
    creditors = []  # (member_id, amount)
    debtors = []  # (member_id, amount)

    for b in balances:
        if b.net_cents > 0:
            creditors.append([b.member_id, b.net_cents])
        elif b.net_cents < 0:
            debtors.append([b.member_id, -b.net_cents])

    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)

    settlements: List[dict] = []
    i = 0
    j = 0
    while i < len(debtors) and j < len(creditors):
        debtor_id, debtor_amt = debtors[i]
        creditor_id, creditor_amt = creditors[j]

        pay = min(debtor_amt, creditor_amt)
        if pay:
            settlements.append(
                {
                    'from_member_id': debtor_id,
                    'to_member_id': creditor_id,
                    'amount_cents': pay,
                }
            )

        debtor_amt -= pay
        creditor_amt -= pay
        debtors[i][1] = debtor_amt
        creditors[j][1] = creditor_amt

        if debtor_amt == 0:
            i += 1
        if creditor_amt == 0:
            j += 1

    return settlements
