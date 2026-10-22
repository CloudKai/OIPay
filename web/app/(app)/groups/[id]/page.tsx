import { notFound } from "next/navigation";

import GroupWorkspace from "@/components/group/group-workspace";
import { parseHistoryQuery, type SearchValues } from "@/lib/history-query";
import { getGroupPageData } from "@/lib/group-data";
import { requireSessionPrincipal } from "@/lib/session";

export default async function GroupPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchValues>;
}) {
  const [{ id }, user] = await Promise.all([params, requireSessionPrincipal()]);
  const data = await getGroupPageData(id, user.id, parseHistoryQuery(await searchParams));
  if (!data) notFound();

  return (
    <GroupWorkspace
      group={{
        id: data.group.id,
        name: data.group.name,
        currency: data.group.currency,
        joinEnabled: data.group.joinEnabled,
        archived: Boolean(data.group.archivedAt),
        hasFinancialRecords:
          data.group._count.expenses + data.group._count.settlements > 0
      }}
      currentMember={{
        id: data.membership.id,
        role: data.membership.role
      }}
      members={data.group.members.map((member) => ({
        id: member.id,
        name: member.displayName,
        email: member.email,
        isGuest: Boolean(member.guestSessionId && !member.userId),
        role: member.role,
        status: member.status,
        invitationDeliveryStatus: member.invitationDeliveryStatus
      }))}
      expenses={data.group.expenses.map((expense) => ({
        id: expense.id,
        version: expense.version,
        description: expense.description,
        totalMinor: expense.totalMinor,
        originalCurrency: expense.originalCurrency,
        originalMinor: expense.originalMinor,
        exchangeRate: expense.exchangeRate,
        exchangeRateDate: expense.exchangeRateDate?.toISOString().slice(0, 10) ?? null,
        exchangeRateSource: expense.exchangeRateSource,
        paidByMemberId: expense.paidByMemberId,
        createdByMemberId: expense.createdByMemberId,
        splitType: expense.splitType,
        category: expense.category,
        expenseDate: expense.expenseDate.toISOString().slice(0, 10),
        notes: expense.notes,
        createdAt: expense.createdAt.toISOString(),
        shares: expense.shares.map((share) => ({
          memberId: share.memberId,
          shareMinor: share.shareMinor,
          percentageBps: share.percentageBps,
          weight: share.weight
        }))
      }))}
      recentExpenses={data.recentExpenses.map((expense) => ({
        id: expense.id,
        version: expense.version,
        description: expense.description,
        totalMinor: expense.totalMinor,
        originalCurrency: expense.originalCurrency,
        originalMinor: expense.originalMinor,
        exchangeRate: expense.exchangeRate,
        exchangeRateDate: expense.exchangeRateDate?.toISOString().slice(0, 10) ?? null,
        exchangeRateSource: expense.exchangeRateSource,
        paidByMemberId: expense.paidByMemberId,
        createdByMemberId: expense.createdByMemberId,
        splitType: expense.splitType,
        category: expense.category,
        expenseDate: expense.expenseDate.toISOString().slice(0, 10),
        notes: expense.notes,
        createdAt: expense.createdAt.toISOString(),
        shares: expense.shares.map((share) => ({
          memberId: share.memberId,
          shareMinor: share.shareMinor,
          percentageBps: share.percentageBps,
          weight: share.weight
        }))
      }))}
      history={data.history}
      settlements={data.group.settlements.map((settlement) => ({
        id: settlement.id,
        version: settlement.version,
        fromMemberId: settlement.fromMemberId,
        toMemberId: settlement.toMemberId,
        amountMinor: settlement.amountMinor,
        originalCurrency: settlement.originalCurrency,
        originalMinor: settlement.originalMinor,
        exchangeRate: settlement.exchangeRate,
        exchangeRateDate: settlement.exchangeRateDate?.toISOString().slice(0, 10) ?? null,
        exchangeRateSource: settlement.exchangeRateSource,
        method: settlement.method,
        settledAt: settlement.settledAt.toISOString().slice(0, 10),
        notes: settlement.notes,
        createdByMemberId: settlement.createdByMemberId,
        createdAt: settlement.createdAt.toISOString()
      }))}
      balances={data.balances}
      simplifiedDebts={data.simplifiedDebts}
      activities={data.group.activities.map((activity) => ({
        id: activity.id,
        message: activity.message,
        type: activity.type,
        createdAt: activity.createdAt.toISOString(),
        actorName: activity.actorMember.displayName
      }))}
    />
  );
}
