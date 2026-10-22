import "server-only";

import { normalizeExchangeRate } from "@/lib/currency";
import { isSupportedCurrency } from "@/lib/money";

export class ExchangeRateUnavailable extends Error {
  constructor() {
    super("An automatic rate is unavailable. Enter the exchange rate from your bank or payment receipt.");
  }
}

function decimalFromNumber(value: number): string {
  // JSON rates may use scientific notation; expand without floating-point arithmetic.
  const [coefficient = "", exponent] = String(value).toLowerCase().split("e");
  if (!exponent) return normalizeExchangeRate(coefficient);
  const [whole = "", fraction = ""] = coefficient.split(".");
  const digits = whole + fraction;
  const position = whole.length + Number(exponent);
  const decimal = position <= 0
    ? `0.${"0".repeat(-position)}${digits}`
    : position >= digits.length
      ? digits + "0".repeat(position - digits.length)
      : `${digits.slice(0, position)}.${digits.slice(position)}`;
  return normalizeExchangeRate(decimal);
}

/** Entry-day reference rate. Its publication date is returned honestly, including weekends. */
export async function lookupExchangeRate(from: string, to: string, now = new Date()) {
  if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) throw new ExchangeRateUnavailable();
  const requestedDate = now.toISOString().slice(0, 10);
  if (from === to) return { from, to, rate: "1", rateDate: requestedDate, requestedDate, source: "Frankfurter" as const };

  try {
    // Official API documentation: https://frankfurter.dev/ . No credentials or group data leave the app.
    const url = new URL(`https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/${to.toLowerCase()}`);
    url.searchParams.set("date", requestedDate);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 900 }
    });
    if (!response.ok) throw new ExchangeRateUnavailable();
    const body = await response.text();
    if (body.length > 16_384) throw new ExchangeRateUnavailable();
    const data: unknown = JSON.parse(body);
    if (!data || typeof data !== "object") throw new ExchangeRateUnavailable();
    const row = data as Record<string, unknown>;
    if (typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
        typeof row.rate !== "number" || !Number.isFinite(row.rate) || row.rate <= 0 ||
        typeof row.base !== "string" || row.base.toUpperCase() !== from ||
        typeof row.quote !== "string" || row.quote.toUpperCase() !== to) throw new ExchangeRateUnavailable();
    const publishedAt = new Date(`${row.date}T00:00:00.000Z`);
    const entryDay = new Date(`${requestedDate}T00:00:00.000Z`);
    const age = entryDay.getTime() - publishedAt.getTime();
    if (Number.isNaN(age) || publishedAt.toISOString().slice(0, 10) !== row.date || age < 0 || age > 7 * 86400_000) {
      throw new ExchangeRateUnavailable();
    }
    return {
      from, to,
      rate: decimalFromNumber(row.rate),
      rateDate: row.date,
      requestedDate,
      source: "Frankfurter" as const
    };
  } catch {
    throw new ExchangeRateUnavailable();
  }
}
