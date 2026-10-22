"use client";

import { Tabs } from "radix-ui";
import {
  ArrowUpRight,
  CircleDollarSign,
  ReceiptText,
  Trash2
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { useWorkspaceRuntime } from "@/components/group/workspace-runtime";
import ExpenseDialog, {
  type ExpenseEditorValue,
  type GroupMemberOption
} from "@/components/group/expense-dialog";
import ExpenseHistory from "@/components/group/expense-history";
import { DisplayCurrencyPicker, DisplayCurrencyProvider, DisplayEquivalent } from "@/components/group/display-currency";
import HistoryPagination from "@/components/group/history-pagination";
import type { GroupHistoryState } from "@/lib/history-query";
import GroupSettings from "@/components/group/group-settings";
import InviteMemberDialog from "@/components/group/invite-member-dialog";
import SettlementDialog, {
  type SettlementEditorValue
} from "@/components/group/settlement-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/feedback";
import type { MemberBalance, SimplifiedDebt } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/money";

export type WorkspaceMember = GroupMemberOption & {
  email: string | null;
  isGuest: boolean;
  role: "OWNER" | "MEMBER";
  invitationDeliveryStatus: "PENDING" | "SENT" | "FAILED" | "DISABLED" | null;
};

export type WorkspaceExpense = ExpenseEditorValue & {
  createdByMemberId: string;
  createdAt: string;
};

export type WorkspaceSettlement = SettlementEditorValue & {
  createdByMemberId: string;
  createdAt: string;
};

export type WorkspaceActivity = {
  id: string;
  message: string;
  type: string;
  createdAt: string;
  actorName: string;
};


export default function GroupWorkspace({
  group,
  currentMember,
  members,
  expenses,
  settlements,
  balances,
  simplifiedDebts,
  activities,
  recentExpenses,
  history
}: {
  group: {
    id: string;
    name: string;
    currency: string;
    archived: boolean;
    hasFinancialRecords: boolean;
    joinEnabled: boolean;
  };
  currentMember: { id: string; role: "OWNER" | "MEMBER" };
  members: WorkspaceMember[];
  expenses: WorkspaceExpense[];
  settlements: WorkspaceSettlement[];
  balances: MemberBalance[];
  simplifiedDebts: SimplifiedDebt[];
  activities: WorkspaceActivity[];
  recentExpenses: WorkspaceExpense[];
  history: GroupHistoryState;
}) {
  const { isDemo, actions: { deleteSettlementAction } } = useWorkspaceRuntime();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  function changeTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    // Every tab's data is already loaded. Update the URL immediately without
    // racing a server navigation against form saves or a browser refresh.
    window.history.replaceState(null, "", `${pathname}?${params}`);
  }
  const nameById = new Map(members.map((member) => [member.id, member.name]));
  const canManage = (createdByMemberId: string) =>
    currentMember.role === "OWNER" || currentMember.id === createdByMemberId;
  const currentBalance =
    balances.find((balance) => balance.memberId === currentMember.id)?.netMinor ?? 0;

  return (
    <DisplayCurrencyProvider groupId={group.id} memberId={currentMember.id} groupCurrency={group.currency}>
    <div className="space-y-6" data-enter>
      <header className="border-b border-[var(--border)] pb-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>
                {group.currency}
              </Badge>
              {group.archived ? <Badge tone="warning">Archived</Badge> : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              {group.name}
            </h1>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              {members.filter((member) => member.status !== "REMOVED").length} members ·{" "}
              {currentBalance > 0
                ? `you are owed ${formatMoney(currentBalance, group.currency)}`
                : currentBalance < 0
                  ? `you owe ${formatMoney(Math.abs(currentBalance), group.currency)}`
                  : "you are settled up"}
            </p>
            <DisplayEquivalent amountMinor={Math.abs(currentBalance)} className="mt-1 text-sm text-[var(--ink-muted)]" />
          </div>
          {!group.archived ? (
            <div className="flex flex-wrap gap-2">
              {currentMember.role === "OWNER" ? (
                <InviteMemberDialog groupId={group.id} />
              ) : null}
              <SettlementDialog
                groupId={group.id}
                currency={group.currency}
                members={members}
                debts={simplifiedDebts}
              />
              <ExpenseDialog
                groupId={group.id}
                currency={group.currency}
                members={members}
              />
            </div>
          ) : null}
        </div>
      </header>

      <DisplayCurrencyPicker />

      <Tabs.Root value={searchParams.get("tab") ?? history.tab} onValueChange={changeTab}>
        <Tabs.List
          className="flex gap-5 overflow-x-auto border-b border-[var(--border)]"
          aria-label="Group views"
        >
          {([
            ["overview", "Overview"],
            ["expenses", "Expenses"],
            ["balances", "Balances"],
            ["activity", "Activity"],
            ["settings", "Settings"]
          ] as const).map(([value, label]) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="min-h-11 shrink-0 border-b-2 border-transparent px-1 text-sm font-medium text-[var(--ink-muted)] outline-none transition hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)] data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)]"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="overview" className="mt-5 outline-none">
          <Overview
            currency={group.currency}
            balances={balances}
            debts={simplifiedDebts}
            members={members}
            groupId={group.id}
            archived={group.archived}
            recentExpenses={recentExpenses}
            nameById={nameById}
          />
        </Tabs.Content>

        <Tabs.Content value="expenses" className="mt-5 outline-none">
          <ExpenseHistory
            groupId={group.id}
            currency={group.currency}
            members={members}
            expenses={expenses}
            filters={history.filters}
            pageInfo={history.expensePage}
            archived={group.archived}
            canManage={canManage}
            nameById={nameById}
          />
        </Tabs.Content>

        <Tabs.Content value="balances" className="mt-5 outline-none">
          <Balances
            groupId={group.id}
            currency={group.currency}
            balances={balances}
            debts={simplifiedDebts}
            members={members}
            archived={group.archived}
          />
        </Tabs.Content>

        <Tabs.Content value="activity" className="mt-5 outline-none">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Activity history</h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                Invitations, corrections, deletions, expenses, and payments
              </p>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  description="Group changes will appear here."
                />
              ) : (
                <ol className="relative ml-3 border-l border-[var(--border)]">
                  {activities.map((activity) => (
                    <li key={activity.id} className="relative pb-6 pl-7 last:pb-0">
                      <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[var(--primary)]" />
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="mt-1 text-xs text-[var(--ink-subtle)]">
                        {activity.actorName} · {formatDate(activity.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            <HistoryPagination info={history.activityPage} parameter="activityPage" tab="activity" label="Activity" />
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="settings" className="mt-5 outline-none">
          {isDemo ? (
            <Card><CardContent className="p-6">
              <h2 className="font-semibold">About this demo group</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">You, Maya, and Alex are sample members. Try expenses, splits, and payments here. Create an account to start a real group and invite friends.</p>
            </CardContent></Card>
          ) : <GroupSettings
            group={group}
            members={members}
            currentMemberId={currentMember.id}
            isOwner={currentMember.role === "OWNER"}
          />}
        </Tabs.Content>
      </Tabs.Root>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Payment history</h2>
        {settlements.length === 0 ? (
          <EmptyState
            title="No payments recorded"
            description="When someone pays back part or all of a balance, it will appear here."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {settlements.map((settlement) => (
              <Card key={settlement.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-8 w-8 place-items-center text-[var(--ink-muted)]">
                      <CircleDollarSign className="h-5 w-5 text-[var(--primary)]" />
                    </span>
                    <p className="text-lg font-semibold">
                      {formatMoney(settlement.amountMinor, group.currency)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm font-medium">
                    {nameById.get(settlement.fromMemberId)} paid{" "}
                    {nameById.get(settlement.toMemberId)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-subtle)]">
                    {formatDate(settlement.settledAt)} ·{" "}
                    {settlement.method.replaceAll("_", " ").toLowerCase()}
                  </p>
                  {settlement.originalCurrency && settlement.originalMinor != null ? (
                    <p className="mt-2 text-xs text-[var(--ink-muted)]">
                      Originally {formatMoney(settlement.originalMinor, settlement.originalCurrency)} · rate {settlement.exchangeRate} on {settlement.exchangeRateDate}
                    </p>
                  ) : null}
                  {settlement.notes ? (
                    <p className="mt-2 text-sm text-[var(--ink-muted)]">
                      {settlement.notes}
                    </p>
                  ) : null}
                  {!group.archived && canManage(settlement.createdByMemberId) ? (
                    <div className="mt-3 flex gap-1 border-t border-[var(--border)] pt-3">
                      <SettlementDialog
                        groupId={group.id}
                        currency={group.currency}
                        members={members}
                        debts={simplifiedDebts}
                        settlement={settlement}
                      />
                      <ConfirmAction
                        title="Delete this payment?"
                        description="The payment will stop affecting balances, and the deletion remains in activity history."
                        confirmLabel="Delete payment"
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        }
                        onConfirm={() =>
                          deleteSettlementAction({
                            groupId: group.id,
                            recordId: settlement.id,
                            expectedVersion: settlement.version
                          })
                        }
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <HistoryPagination info={history.paymentPage} parameter="paymentsPage" label="Payment history" />
      </section>
    </div>
    </DisplayCurrencyProvider>
  );
}

function Overview({
  currency,
  balances,
  debts,
  members,
  groupId,
  archived,
  recentExpenses,
  nameById
}: {
  currency: string;
  balances: MemberBalance[];
  debts: SimplifiedDebt[];
  members: WorkspaceMember[];
  groupId: string;
  archived: boolean;
  recentExpenses: WorkspaceExpense[];
  nameById: Map<string, string>;
}) {
  const total = recentExpenses.reduce((sum, expense) => sum + expense.totalMinor, 0);
  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 px-1 py-2 text-sm text-[var(--ink-muted)]">
          <p><span className="font-semibold tabular-nums text-[var(--ink)]">{formatMoney(total, currency)}</span> in recent expenses</p>
          <p>{members.filter((member) => member.status !== "REMOVED").length} people sharing</p>
        </div>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Recent expenses</h2>
          </CardHeader>
          <CardContent>
            {recentExpenses.length === 0 ? (
              <EmptyState
                title="No expenses yet"
                description="Add the first shared purchase to calculate balances."
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="grid h-7 w-7 shrink-0 place-items-center">
                      <ReceiptText className="h-4 w-4 text-[var(--primary)]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{expense.description}</p>
                      <p className="text-xs text-[var(--ink-subtle)]">
                        Paid by {nameById.get(expense.paidByMemberId)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatMoney(expense.totalMinor, currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Balances
        groupId={groupId}
        currency={currency}
        balances={balances}
        debts={debts}
        members={members}
        archived={archived}
        compact
      />
    </div>
  );
}

function Balances({
  groupId,
  currency,
  balances,
  debts,
  members,
  archived,
  compact = false
}: {
  groupId: string;
  currency: string;
  balances: MemberBalance[];
  debts: SimplifiedDebt[];
  members: WorkspaceMember[];
  archived: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-5" : "grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"}>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Member balances</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Paid minus their share
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {balances.map((balance) => (
              <div
                key={balance.memberId}
                className="flex items-center gap-3 border-b border-[var(--border)] py-4 first:pt-0 last:border-0 last:pb-0"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-muted)] text-sm font-semibold">
                  {balance.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{balance.name}</p>
                  <p className="text-xs text-[var(--ink-subtle)]">
                    Paid {formatMoney(balance.paidMinor, currency)} · share{" "}
                    {formatMoney(balance.owedMinor, currency)}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    balance.netMinor > 0
                      ? "text-[var(--positive)]"
                      : balance.netMinor < 0
                        ? "text-[var(--negative)]"
                        : "text-[var(--ink-muted)]"
                  }`}
                >
                  {balance.netMinor > 0 ? "+" : ""}
                  {formatMoney(balance.netMinor, currency)}
                  <DisplayEquivalent amountMinor={balance.netMinor} />
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Simplified payments</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Fewer transfers, same final balances
          </p>
        </CardHeader>
        <CardContent>
          {debts.length === 0 ? (
            <EmptyState
              title="Everyone is settled up"
              description="No payments are needed right now."
            />
          ) : (
            <div className="space-y-3">
              {debts.map((debt) => (
                <div
                  key={`${debt.fromMemberId}:${debt.toMemberId}`}
                  className="border-b border-[var(--border)] py-4 first:pt-0 last:border-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center">
                      <ArrowUpRight className="h-5 w-5 text-[var(--primary)]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <strong>{debt.fromName}</strong>{debt.fromName === "You" ? " pay " : " pays "}
                        <strong>{debt.toName}</strong>
                      </p>
                      <p className="mt-1 text-xl font-semibold">
                        {formatMoney(debt.amountMinor, currency)}
                        <DisplayEquivalent amountMinor={debt.amountMinor} />
                      </p>
                    </div>
                    {!archived ? (
                      <SettlementDialog
                        groupId={groupId}
                        currency={currency}
                        members={members}
                        debts={debts}
                        debt={debt}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

