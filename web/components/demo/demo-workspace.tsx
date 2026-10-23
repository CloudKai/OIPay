"use client";

import { BrandName } from "@/components/ui/brand-name";

import { RotateCcw, WalletCards } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import GroupWorkspace from "@/components/group/group-workspace";
import { WorkspaceRuntimeProvider } from "@/components/group/workspace-runtime";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { computeGroupBalances } from "@/lib/balances";
import { createDemoActions, createDemoState, DEMO_CURRENCY, DEMO_GROUP_ID, DEMO_MEMBER_ID,
  demoMembers, getDemoQuote, parseDemoState, type DemoState } from "@/lib/demo";
import { HISTORY_PAGE_SIZE, pageInfo, parseHistoryQuery } from "@/lib/history-query";

// Preserve existing demo edits when the product name changes.
const storageKey = "splittogether:demo:v1";

function createDemoStore(initial: DemoState) {
  let state = initial;
  let hydrated = false;
  const listeners = new Set<() => void>();
  function update(next: DemoState) {
    state = next;
    try { window.sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch {
      // The demo still works for this visit when browser storage is unavailable.
    }
    listeners.forEach((listener) => listener());
  }
  const actions = createDemoActions(() => state, update);
  return {
    actions,
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!hydrated) {
        hydrated = true;
        try {
          const saved = window.sessionStorage.getItem(storageKey);
          const restored = saved ? parseDemoState(JSON.parse(saved)) : null;
          if (restored) state = restored;
        } catch { /* Invalid or unavailable storage starts a fresh demo. */ }
      }
      return () => { listeners.delete(listener); };
    },
    reset: () => update(createDemoState())
  };
}

export default function DemoWorkspace({ initialState }: { initialState: DemoState }) {
  const [store] = useState(() => createDemoStore(initialState));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const search = useSearchParams();
  const query = parseHistoryQuery(Object.fromEntries(search.entries()));
  const { filters } = query;
  const expenses = state.expenses.filter((expense) =>
    (!filters.search || `${expense.description} ${expense.notes ?? ""}`.toLowerCase().includes(filters.search.toLowerCase())) &&
    (filters.category === "ALL" || expense.category === filters.category) &&
    (filters.memberId === "ALL" || expense.paidByMemberId === filters.memberId || expense.shares.some((share) => share.memberId === filters.memberId)) &&
    (!filters.dateFrom || expense.expenseDate >= filters.dateFrom) &&
    (!filters.dateTo || expense.expenseDate <= filters.dateTo)
  ).toSorted((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt));
  const expensePage = pageInfo(query.page, expenses.length);
  const paymentPage = pageInfo(query.paymentsPage, state.settlements.length);
  const activityPage = pageInfo(query.activityPage, state.activities.length);
  const slice = <T,>(items: T[], page: number) => items.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);
  const finance = computeGroupBalances({ members: demoMembers, ...state });

  return (
    <WorkspaceRuntimeProvider value={{ isDemo: true, actions: store.actions, getQuote: getDemoQuote }}>
      <div className="min-h-dvh bg-[var(--canvas)]">
        <header className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <Link href="/login" className="flex items-center gap-2 font-bold">
              <WalletCards className="h-5 w-5 text-[var(--primary)]" /> <BrandName />
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="ghost" size="sm"><Link href="/login">Exit demo</Link></Button>
              <Button asChild size="sm"><Link href="/signup">Create an account</Link></Button>
            </div>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
          <section aria-label="Demo mode" className="flex flex-col justify-between gap-3 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-semibold">Try a sample trip</p>
              <p className="mt-1 max-w-prose text-sm leading-6 text-[var(--ink-muted)]">
                Add an expense or record a payment with Maya and Alex to see how it works.
              </p>
              <p className="mt-1 max-w-prose text-xs leading-5 text-[var(--ink-muted)]">
                Demo mode uses sample data and rates. Your changes stay in this tab until it closes; real groups are unaffected.
              </p>
            </div>
            <ConfirmAction title="Reset the demo?" description="This replaces your demo changes with the original sample expenses."
              confirmLabel="Reset demo" trigger={<Button variant="ghost" size="sm" className="shrink-0 self-start"><RotateCcw className="h-4 w-4" />Reset demo</Button>}
              onConfirm={async () => {
                store.reset();
                window.history.replaceState(null, "", "/demo");
                return { ok: true, message: "Demo reset. You’re back to the sample trip." };
              }} />
          </section>
          <GroupWorkspace group={{ id: DEMO_GROUP_ID, name: "Weekend in Singapore", currency: DEMO_CURRENCY,
            archived: false, hasFinancialRecords: state.expenses.length > 0 || state.settlements.length > 0, joinEnabled: false }}
            currentMember={{ id: DEMO_MEMBER_ID, role: "MEMBER" }} members={demoMembers}
            expenses={slice(expenses, expensePage.page)} settlements={slice(state.settlements, paymentPage.page)}
            activities={slice(state.activities, activityPage.page)} recentExpenses={expenses.slice(0, 5)}
            {...finance} history={{ ...query, expensePage, paymentPage, activityPage }} />
        </main>
      </div>
    </WorkspaceRuntimeProvider>
  );
}
