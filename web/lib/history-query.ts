export const HISTORY_PAGE_SIZE = 25;

export const expenseCategories = [
  "GENERAL", "FOOD", "TRANSPORT", "HOUSING", "ENTERTAINMENT",
  "SHOPPING", "UTILITIES", "HEALTH", "OTHER"
] as const;

export type SearchValues = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function page(value: string | string[] | undefined): number {
  const raw = first(value);
  return /^\d{1,6}$/.test(raw) ? Math.max(1, Math.min(Number(raw), 100_000)) : 1;
}

function date(value: string | string[] | undefined): string {
  const raw = first(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw ? raw : "";
}

export function parseHistoryQuery(values: SearchValues) {
  const category = first(values.category);
  const tab = first(values.tab);
  return {
    tab: ["overview", "expenses", "balances", "activity", "settings"].includes(tab) ? tab : "overview",
    page: page(values.page),
    paymentsPage: page(values.paymentsPage),
    activityPage: page(values.activityPage),
    filters: {
      search: first(values.q).trim().slice(0, 140),
      category: expenseCategories.find((item) => item === category) ?? ("ALL" as const),
      memberId: first(values.member).slice(0, 64) || "ALL",
      dateFrom: date(values.from),
      dateTo: date(values.to)
    }
  };
}

export type HistoryQuery = ReturnType<typeof parseHistoryQuery>;

export function pageInfo(requestedPage: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  return { page: Math.min(requestedPage, totalPages), totalPages, total };
}

export type PageInfo = ReturnType<typeof pageInfo>;

export type GroupHistoryState = Omit<HistoryQuery, "activityPage"> & {
  expensePage: PageInfo;
  paymentPage: PageInfo;
  activityPage: PageInfo;
};
