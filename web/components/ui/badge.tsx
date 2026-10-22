import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "teal" | "positive" | "negative" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-700",
        tone === "teal" && "bg-[var(--focus-soft)] text-[var(--primary)]",
        tone === "positive" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "negative" && "border-red-200 bg-red-50 text-red-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        className
      )}
      {...props}
    />
  );
}
