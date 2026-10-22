import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  ReceiptText
} from "lucide-react";
import Link from "next/link";

import CreateGroupForm from "@/components/dashboard/create-group-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { getDashboardData } from "@/lib/group-data";
import { formatDate, formatMoney } from "@/lib/money";
import { requireSessionPrincipal } from "@/lib/session";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireSessionPrincipal();
  const groups = await getDashboardData(user.id);
  const activeGroups = groups.filter((item) => !item.group.archivedAt);
  const totals = new Map<string, { owed: number; owes: number }>();
  for (const item of activeGroups) {
    const current = totals.get(item.group.currency) ?? { owed: 0, owes: 0 };
    if ((item.balance?.netMinor ?? 0) >= 0) {
      current.owed += item.balance?.netMinor ?? 0;
    } else {
      current.owes += Math.abs(item.balance?.netMinor ?? 0);
    }
    totals.set(item.group.currency, current);
  }
  const recent = groups
    .flatMap((item) =>
      item.group.activities.map((activity) => ({
        ...activity,
        groupName: item.group.name,
        currency: item.group.currency
      }))
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6);

  return (
    <div className="space-y-7" data-enter>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Good to see you, {user.name.split(" ")[0]}.
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Your shared expenses and balances, all in one place.
          </p>
        </div>
        {!user.isGuest ? <CreateGroupForm /> : <Link href="/account" className="text-sm font-semibold text-[var(--primary)] underline">Add an account to create groups</Link>}
      </header>

      {totals.size === 0 ? (
        <Card className="bg-white">
          <CardContent className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Create a group for your next shared expense.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
                Add people before they register, choose a currency, and split the
                first expense when you’re ready.
              </p>
            </div>
            <CreateGroupForm triggerLabel="Create first group" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...totals.entries()].map(([currency, total]) => (
            <Card key={currency}>
              <CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <div>
                  <p className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                    <ArrowUpRight className="h-4 w-4 text-[var(--negative)]" />
                    You owe
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--negative)]">
                    {formatMoney(total.owes, currency)}
                  </p>
                </div>
                <div className="border-t border-[var(--border)] pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <p className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                    <ArrowDownLeft className="h-4 w-4 text-[var(--positive)]" />
                    You are owed
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--positive)]">
                    {formatMoney(total.owed, currency)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Your groups</h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                Current balance in each group
              </p>
            </div>
            <Link href="/groups" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {activeGroups.length === 0 ? (
              <EmptyState
                title="No active groups"
                description="Create a group to start tracking shared expenses."
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {activeGroups.slice(0, 6).map((item) => {
                  const net = item.balance?.netMinor ?? 0;
                  return (
                    <Link
                      key={item.group.id}
                      href={`/groups/${item.group.id}`}
                      className="group grid grid-cols-[1fr_auto] gap-x-4 px-1 py-4 transition hover:bg-[var(--surface-muted)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                    >
                      <div className="min-w-0">
                        <h3 className="font-semibold break-words">{item.group.name}</h3>
                        <p className="mt-1 text-xs text-[var(--ink-subtle)]">{item.group._count.members} members · {item.group.currency}</p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 text-[var(--ink-subtle)]" />
                      <p
                        className={`col-span-2 mt-2 text-sm ${
                          net > 0
                            ? "text-[var(--positive)]"
                            : net < 0
                              ? "text-[var(--negative)]"
                              : "text-[var(--ink-muted)]"
                        }`}
                      >
                        {net > 0
                          ? `You are owed ${formatMoney(net, item.group.currency)}`
                          : net < 0
                            ? `You owe ${formatMoney(Math.abs(net), item.group.currency)}`
                            : "Settled up"}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Latest changes across groups</p>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                description="New expenses, invitations, and payments will appear here."
              />
            ) : (
              <ol className="space-y-4">
                {recent.map((activity) => (
                  <li key={activity.id} className="flex gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
                      <ReceiptText className="h-4 w-4 text-[var(--primary)]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm leading-5">{activity.message}</p>
                      <p className="mt-1 text-xs text-[var(--ink-subtle)]">
                        {activity.groupName} · {formatDate(activity.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
