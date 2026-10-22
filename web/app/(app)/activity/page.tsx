import { Activity as ActivityIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/lib/money";
import { principalMembershipWhere } from "@/lib/member-identity";
import { prisma } from "@/lib/prisma";
import { requireSessionPrincipal } from "@/lib/session";

export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  const user = await requireSessionPrincipal();
  const memberships = await prisma.groupMember.findMany({
    where: { ...principalMembershipWhere(user.id), status: "ACTIVE" },
    select: { groupId: true }
  });
  const activities = await prisma.activityLog.findMany({
    where: { groupId: { in: memberships.map((item) => item.groupId) } },
    include: {
      group: { select: { name: true } },
      actorMember: { select: { displayName: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return (
    <div className="space-y-6" data-enter>
      <header>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">
          Changes across your groups
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          A clear history of invitations, expenses, corrections, and payments.
        </p>
      </header>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Latest activity</h2>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Create a group or add an expense to start the history."
            />
          ) : (
            <ol className="space-y-1">
              {activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex gap-3 rounded-xl p-3 hover:bg-[var(--surface-muted)]/60"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)]">
                    <ActivityIcon className="h-4 w-4 text-[var(--primary)]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <Badge>{activity.group.name}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--ink-subtle)]">
                      {activity.actorMember.displayName} ·{" "}
                      {formatDate(activity.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
