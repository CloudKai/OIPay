export function dollarsToCents(input: string): number {
  const normalized = input.replace(/,/g, "").trim();
  const asNumber = Number(normalized);
  if (!Number.isFinite(asNumber)) {
    return NaN;
  }
  return Math.round(asNumber * 100);
}

export function centsToDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

export function formatDate(date: Date | string): string {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
