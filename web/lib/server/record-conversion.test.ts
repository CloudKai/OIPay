import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn(), getSessionPrincipal: vi.fn() }));

import { financialConversionRecord } from "./record-conversion";

const saved = {
  originalCurrency: "JPY", originalMinor: 3000, exchangeRate: "0.00809",
  exchangeRateDate: new Date("2026-01-02T00:00:00Z"), exchangeRateSource: "Frankfurter"
};

describe("saved financial conversion", () => {
  it("preserves the original rate when an edit omits conversion", () => {
    expect(financialConversionRecord(undefined, "SGD", 2427, saved)).toEqual(saved);
  });
  it("rejects an amount edit that would silently contradict the saved conversion", () => {
    expect(() => financialConversionRecord(undefined, "SGD", 2500, saved)).toThrow(/does not match/);
  });
  it("only clears conversion when explicitly requested", () => {
    expect(financialConversionRecord(null, "SGD", 2500, saved)).toEqual({
      originalCurrency: null, originalMinor: null, exchangeRate: null, exchangeRateDate: null, exchangeRateSource: null
    });
  });
});
