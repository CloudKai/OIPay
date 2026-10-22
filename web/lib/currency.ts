import { currencyFractionDigits, isSupportedCurrency } from "@/lib/money";

export interface CurrencyConversion {
  currency: string;
  originalMinor: number;
  /** Group-currency major units for one original-currency major unit. */
  rate: string;
  rateDate: string;
  source: "Frankfurter" | "Manual";
}

export function normalizeExchangeRate(rate: string): string {
  const value = rate.trim();
  if (!/^\d{1,12}(?:\.\d{1,18})?$/.test(value)) {
    throw new Error("Enter a positive exchange rate with at most 18 decimal places.");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  const normalizedWhole = BigInt(whole).toString();
  const normalizedFraction = fraction.replace(/0+$/, "");
  const normalized = normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
  if (BigInt(whole + fraction) === 0n) throw new Error("The exchange rate must be greater than zero.");
  return normalized;
}

/** Decimal integer arithmetic; round halves away from zero to the target's minor unit. */
export function convertMinor(
  originalMinor: number,
  fromCurrency: string,
  toCurrency: string,
  rate: string
): number {
  if (!Number.isSafeInteger(originalMinor)) throw new Error("Enter a valid amount.");
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) {
    throw new Error("Choose a supported currency.");
  }
  const [whole = "0", fraction = ""] = normalizeExchangeRate(rate).split(".");
  const numerator = BigInt(Math.abs(originalMinor)) * BigInt(whole + fraction) *
    (10n ** BigInt(currencyFractionDigits(toCurrency)));
  const denominator = (10n ** BigInt(fraction.length)) *
    (10n ** BigInt(currencyFractionDigits(fromCurrency)));
  const rounded = (numerator + denominator / 2n) / denominator;
  const result = Number(rounded) * (originalMinor < 0 ? -1 : 1);
  if (!Number.isSafeInteger(result)) throw new Error("The converted amount is too large.");
  return result;
}

export function conversionToRecord(
  conversion: CurrencyConversion | null | undefined,
  groupCurrency: string,
  ledgerMinor: number
) {
  if (!conversion) return {
    originalCurrency: null,
    originalMinor: null,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null
  };
  if (conversion.currency === groupCurrency) {
    throw new Error("Use the group amount directly when both currencies are the same.");
  }
  const convertedMinor = convertMinor(conversion.originalMinor, conversion.currency, groupCurrency, conversion.rate);
  if (convertedMinor !== ledgerMinor || convertedMinor <= 0 || convertedMinor > 2_000_000_000) {
    throw new Error("The group amount does not match the original amount and exchange rate. Check the conversion.");
  }
  return {
    originalCurrency: conversion.currency,
    originalMinor: conversion.originalMinor,
    exchangeRate: normalizeExchangeRate(conversion.rate),
    exchangeRateDate: new Date(`${conversion.rateDate}T00:00:00.000Z`),
    exchangeRateSource: conversion.source
  };
}

/** Serializable snapshot for the activity history, including cleared conversions. */
export function conversionAuditSnapshot(record: {
  originalCurrency: string | null;
  originalMinor: number | null;
  exchangeRate: string | null;
  exchangeRateDate: Date | null;
  exchangeRateSource: string | null;
}) {
  return record.originalCurrency ? {
    currency: record.originalCurrency,
    originalMinor: record.originalMinor,
    rate: record.exchangeRate,
    rateDate: record.exchangeRateDate?.toISOString().slice(0, 10) ?? null,
    source: record.exchangeRateSource
  } : null;
}
