import { CircleAlert, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

export function FormMessage({
  message,
  className
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800",
        className
      )}
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-32 place-items-center py-8 px-4 text-center">
      <div>
        <Inbox className="mx-auto h-7 w-7 text-[var(--ink-subtle)]" />
        <h3 className="mt-3 font-semibold text-[var(--ink)]">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--ink-muted)]">
          {description}
        </p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-slate-200/70 motion-reduce:animate-none",
        className
      )}
    />
  );
}
