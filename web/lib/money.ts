const ISO_CURRENCIES = [
  "USD", "SGD", "EUR", "GBP", "AUD", "CAD", "JPY", "CNY", "HKD", "INR",
  "IDR", "MYR", "THB", "PHP", "KRW", "NZD", "CHF", "SEK", "NOK", "DKK",
  "AED", "SAR", "VND", "TWD", "KWD", "BHD", "OMR", "JOD", "TND"
] as const;

export const supportedCurrencies = ISO_CURRENCIES.map((code) => ({
  code,
  name: new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code
}));

export function currencyFractionDigits(currency: string): number {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function isSupportedCurrency(currency: string): boolean {
  return ISO_CURRENCIES.includes(currency.toUpperCase() as (typeof ISO_CURRENCIES)[number]);
}

export function majorToMinor(input: string, currency: string): number {
  const digits = currencyFractionDigits(currency);
  const normalized = input.replace(/,/g, "").trim();

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return Number.NaN;
  }

  const [whole = "0", fraction = ""] = normalized.split(".");
  if (fraction.length > digits) {
    return Number.NaN;
  }

  const paddedFraction = fraction.padEnd(digits, "0");
  const value = Number(whole) * 10 ** digits + Number(paddedFraction || "0");
  return Number.isSafeInteger(value) ? value : Number.NaN;
}

export function minorToInput(minor: number, currency: string): string {
  const digits = currencyFractionDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}

export function formatMoney(minor: number, currency: string, locale?: string): string {
  const digits = currencyFractionDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(minor / 10 ** digits);
}

export function formatDate(date: Date | string, locale?: string): string {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}

export function toDatabaseDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date.");
  }
  return parsed;
}
