"use client";

import { Search, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { useWorkspaceRuntime } from "@/components/group/workspace-runtime";
import ExpenseDialog from "@/components/group/expense-dialog";
import HistoryPagination from "@/components/group/history-pagination";
import type { WorkspaceMember, WorkspaceExpense } from "@/components/group/group-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form";
import { formatDate, formatMoney } from "@/lib/money";
import type { HistoryQuery, PageInfo } from "@/lib/history-query";

const categoryLabels: Record<string, string> = {
  GENERAL: "General",
  FOOD: "Food & dining",
  TRANSPORT: "Transport",
  HOUSING: "Housing",
  ENTERTAINMENT: "Entertainment",
  SHOPPING: "Shopping",
  UTILITIES: "Utilities",
  HEALTH: "Health",
  OTHER: "Other"
};


export default function ExpenseHistory({
  groupId,
  currency,
  members,
  expenses,
  filters,
  pageInfo,
  archived,
  canManage,
  nameById
}: {
  groupId: string;
  currency: string;
  members: WorkspaceMember[];
  expenses: WorkspaceExpense[];
  filters: HistoryQuery["filters"];
  pageInfo: PageInfo;
  archived: boolean;
  canManage: (createdByMemberId: string) => boolean;
  nameById: Map<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["q", "category", "member", "from", "to"]) {
      const value = String(form.get(key) ?? "");
      if (!value || value === "ALL") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    params.set("tab", "expenses");
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Expense history</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {expenses.length} of {pageInfo.total} matching expenses
          </p>
        </div>
        {!archived ? (
          <ExpenseDialog groupId={groupId} currency={currency} members={members} />
        ) : null}
      </CardHeader>
      <CardContent>
        <form key={JSON.stringify(filters)} onSubmit={applyFilters} className="grid gap-2 rounded-2xl bg-[var(--surface-muted)]/65 p-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--ink-subtle)]" />
            <Input
              name="q"
              defaultValue={filters.search}
              placeholder="Search description or notes"
              className="pl-9"
              aria-label="Search expenses"
            />
          </div>
          <Select name="category" defaultValue={filters.category} aria-label="Filter by category">
            <option value="ALL">All categories</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select name="member" defaultValue={filters.memberId} aria-label="Filter by member">
            <option value="ALL">All members</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
          <div className="flex min-w-0 gap-2">
            <Input className="min-w-0 flex-1" type="date" name="from" defaultValue={filters.dateFrom} aria-label="Expenses from date" />
            <Input className="min-w-0 flex-1" type="date" name="to" defaultValue={filters.dateTo} aria-label="Expenses to date" />
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Filtering..." : "Apply filters"}</Button>
        </form>

        {expenses.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No matching expenses"
              description="Change the search or filters to see more records."
            />
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {expenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  groupId={groupId}
                  currency={currency}
                  members={members}
                  archived={archived}
                  manageable={canManage(expense.createdByMemberId)}
                  nameById={nameById}
                />
              ))}
            </div>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--ink-subtle)]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Expense</th>
                    <th className="px-3 py-3 font-semibold">Paid by</th>
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Split</th>
                    <th className="px-3 py-3 text-right font-semibold">Amount</th>
                    <th className="px-3 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-[var(--surface-muted)]/45">
                      <td className="px-3 py-4">
                        <p className="font-medium">{expense.description}</p>
                        <p className="mt-1 text-xs text-[var(--ink-subtle)]">
                          {categoryLabels[expense.category]}
                        </p>
                      </td>
                      <td className="px-3 py-4">{nameById.get(expense.paidByMemberId)}</td>
                      <td className="px-3 py-4">{formatDate(expense.expenseDate)}</td>
                      <td className="px-3 py-4">{expense.splitType.toLowerCase()}</td>
                      <td className="px-3 py-4 text-right font-semibold">
                        {formatMoney(expense.totalMinor, currency)}
                        <OriginalExpenseAmount expense={expense} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-1">
                          {!archived && canManage(expense.createdByMemberId) ? (
                            <>
                              <ExpenseDialog
                                groupId={groupId}
                                currency={currency}
                                members={members}
                                expense={expense}
                              />
                              <DeleteExpense
                                groupId={groupId}
                                expense={expense}
                              />
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <HistoryPagination info={pageInfo} parameter="page" tab="expenses" label="Expense history" />
      </CardContent>
    </Card>
  );
}

function ExpenseCard({
  expense,
  groupId,
  currency,
  members,
  archived,
  manageable,
  nameById
}: {
  expense: WorkspaceExpense;
  groupId: string;
  currency: string;
  members: WorkspaceMember[];
  archived: boolean;
  manageable: boolean;
  nameById: Map<string, string>;
}) {
  return (
    <article aria-label={`Expense: ${expense.description}`} className="border-b border-[var(--border)] py-4 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge>{categoryLabels[expense.category]}</Badge>
          <h3 className="mt-2 font-semibold">{expense.description}</h3>
          <p className="mt-1 text-xs text-[var(--ink-subtle)]">
            {nameById.get(expense.paidByMemberId)} paid · {formatDate(expense.expenseDate)}
          </p>
        </div>
        <div className="text-right font-semibold">
          <p>{formatMoney(expense.totalMinor, currency)}</p>
          <OriginalExpenseAmount expense={expense} />
        </div>
      </div>
      {expense.notes ? (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">{expense.notes}</p>
      ) : null}
      <p className="mt-3 text-xs text-[var(--ink-subtle)]">
        {expense.shares
          .map(
            (share) =>
              `${nameById.get(share.memberId)} ${formatMoney(share.shareMinor, currency)}`
          )
          .join(" · ")}
      </p>
      {!archived && manageable ? (
        <div className="mt-3 flex gap-1 border-t border-[var(--border)] pt-3">
          <ExpenseDialog
            groupId={groupId}
            currency={currency}
            members={members}
            expense={expense}
          />
          <DeleteExpense groupId={groupId} expense={expense} />
        </div>
      ) : null}
    </article>
  );
}

function OriginalExpenseAmount({ expense }: { expense: WorkspaceExpense }) {
  if (!expense.originalCurrency || expense.originalMinor == null) return null;
  return (
    <p className="mt-1 max-w-52 text-xs font-normal text-[var(--ink-muted)]">
      Originally {formatMoney(expense.originalMinor, expense.originalCurrency)}
      <span className="block">Rate {expense.exchangeRate} · {expense.exchangeRateDate}</span>
    </p>
  );
}

function DeleteExpense({
  groupId,
  expense
}: {
  groupId: string;
  expense: WorkspaceExpense;
}) {
  const { actions: { deleteExpenseAction } } = useWorkspaceRuntime();
  return (
    <ConfirmAction
      title={`Delete ${expense.description}?`}
      description="It will stop affecting balances. The deletion remains visible in activity history."
      confirmLabel="Delete expense"
      trigger={
        <Button variant="ghost" size="sm">
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      }
      onConfirm={() =>
        deleteExpenseAction({
          groupId,
          recordId: expense.id,
          expectedVersion: expense.version
        })
      }
    />
  );
}
