"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { PageInfo } from "@/lib/history-query";

export default function HistoryPagination({ info, parameter, tab, label }: {
  info: PageInfo;
  parameter: "page" | "paymentsPage" | "activityPage";
  tab?: string;
  label: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  function href(page: number) {
    const params = new URLSearchParams(search.toString());
    params.set(parameter, String(page));
    if (tab) params.set("tab", tab);
    return `${pathname}?${params}`;
  }
  if (info.totalPages <= 1) return null;
  return (
    <nav aria-label={`${label} pages`} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[var(--ink-muted)]">Page {info.page} of {info.totalPages} · {info.total} records</p>
      <div className="flex gap-2">
        {info.page > 1 ? (
          <Button asChild variant="secondary" size="sm"><Link href={href(info.page - 1)} scroll={false}>Previous</Link></Button>
        ) : <Button variant="secondary" size="sm" disabled>Previous</Button>}
        {info.page < info.totalPages ? (
          <Button asChild variant="secondary" size="sm"><Link href={href(info.page + 1)} scroll={false}>Next</Link></Button>
        ) : <Button variant="secondary" size="sm" disabled>Next</Button>}
      </div>
    </nav>
  );
}
