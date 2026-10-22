import { Archive, ChevronRight, UsersRound } from "lucide-react";
import Link from "next/link";

import CreateGroupForm from "@/components/dashboard/create-group-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { getDashboardData } from "@/lib/group-data";
import { formatMoney } from "@/lib/money";
import { requireSessionPrincipal } from "@/lib/session";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  const user = await requireSessionPrincipal();
  const groups = await getDashboardData(user.id);
  return (
    <div className="space-y-6" data-enter>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">
            Your groups
          </h1>
        </div>
        {!user.isGuest ? <CreateGroupForm /> : <Link href="/account" className="text-sm font-semibold text-[var(--primary)] underline">Add an account to create groups</Link>}
      </header>
      {groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create one for a trip, household, event, or team."
          action={<CreateGroupForm triggerLabel="Create a group" />}
        />
      ) : (
        <div className="divide-y divide-[var(--border)] rounded-xl bg-white px-5 sm:px-6">
          {groups.map((item) => {
            const net = item.balance?.netMinor ?? 0;
            return (
              <Link key={item.group.id} href={`/groups/${item.group.id}`}
                className="group flex items-center gap-4 py-6 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
                {item.group.archivedAt ? <Archive className="h-5 w-5 shrink-0 text-[var(--ink-subtle)]" /> : <UsersRound className="h-5 w-5 shrink-0 text-[var(--ink-subtle)]" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-base font-semibold group-hover:text-[var(--primary)]">{item.group.name}</h2>
                    {item.group.archivedAt ? <Badge tone="warning">Archived</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">{item.group._count.members} members · {item.group.currency}</p>
                  <p className={`mt-2 text-sm ${net > 0 ? "text-[var(--positive)]" : net < 0 ? "text-[var(--negative)]" : "text-[var(--ink-muted)]"}`}>
                    {net > 0 ? `You are owed ${formatMoney(net, item.group.currency)}` : net < 0 ? `You owe ${formatMoney(Math.abs(net), item.group.currency)}` : "You are settled up"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-subtle)]" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
