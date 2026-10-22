import { describe, expect, it } from "vitest";

import { conversionToRecord, convertMinor, normalizeExchangeRate } from "./currency";
import { currencyConversionSchema } from "./validation";

describe("exact currency conversion", () => {
  it("converts decimal rates without floating-point cent errors", () => {
    expect(convertMinor(100, "USD", "SGD", "1.005")).toBe(101);
    expect(convertMinor(10, "USD", "SGD", "0.7")).toBe(7);
    expect(convertMinor(2000000000, "USD", "SGD", "0.999999999999999999")).toBe(2000000000);
  });

  it("respects zero-decimal and three-decimal currencies", () => {
    expect(convertMinor(3000, "JPY", "SGD", "0.00809")).toBe(2427);
    expect(convertMinor(100, "SGD", "JPY", "110.5")).toBe(111);
    expect(convertMinor(1000, "KWD", "SGD", "4.25")).toBe(425);
    expect(convertMinor(100, "SGD", "KWD", "0.2355")).toBe(236);
  });

  it("supports negative display balances with symmetric rounding", () => {
    expect(convertMinor(-100, "USD", "SGD", "1.005")).toBe(-101);
    expect(convertMinor(0, "USD", "SGD", "1.005")).toBe(0);
  });

  it("rejects unsafe amounts, unsupported currencies and invalid rates", () => {
    for (const value of ["0", "-1", "1e6", "Infinity", "0.0000000000000000001"]) {
      expect(() => convertMinor(100, "USD", "SGD", value)).toThrow();
    }
    expect(() => convertMinor(1.5, "USD", "SGD", "1")).toThrow();
    expect(() => convertMinor(1, "ABC", "SGD", "1")).toThrow();
    expect(() => convertMinor(Number.MAX_SAFE_INTEGER, "USD", "SGD", "2")).toThrow();
    expect(normalizeExchangeRate("001.230000")).toBe("1.23");
  });

  it("recomputes the ledger amount rather than trusting the browser total", () => {
    const conversion = { currency: "JPY", originalMinor: 3000, rate: "0.00809", rateDate: "2026-01-02", source: "Frankfurter" as const };
    expect(conversionToRecord(conversion, "SGD", 2427)).toEqual({
      originalCurrency: "JPY", originalMinor: 3000, exchangeRate: "0.00809",
      exchangeRateDate: new Date("2026-01-02T00:00:00.000Z"), exchangeRateSource: "Frankfurter"
    });
    expect(() => conversionToRecord(conversion, "SGD", 2428)).toThrow(/does not match/);
    expect(() => conversionToRecord({ ...conversion, originalMinor: 1, rate: "0.00001" }, "SGD", 0)).toThrow();
    expect(() => conversionToRecord({ ...conversion, currency: "SGD" }, "SGD", 2427)).toThrow(/same/);
  });

  it("rejects invalid conversion metadata and impossible calendar dates", () => {
    const conversion = { currency: "JPY", originalMinor: 3000, rate: "0.00809", rateDate: "2026-01-02", source: "Manual" };
    expect(currencyConversionSchema.safeParse(conversion).success).toBe(true);
    expect(currencyConversionSchema.safeParse({ ...conversion, rateDate: "2026-02-30" }).success).toBe(false);
    expect(currencyConversionSchema.safeParse({ ...conversion, rateDate: "2999-01-01" }).success).toBe(false);
    expect(currencyConversionSchema.safeParse({ ...conversion, originalMinor: 0 }).success).toBe(false);
    expect(currencyConversionSchema.safeParse({ ...conversion, source: "Unknown" }).success).toBe(false);
  });
});
