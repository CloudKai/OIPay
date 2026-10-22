import { describe, expect, it } from "vitest";

import {
  currencyFractionDigits,
  formatMoney,
  majorToMinor,
  minorToInput
} from "@/lib/money";

describe("currency-aware money", () => {
  it.each([
    ["JPY", "1250", 1250, 0],
    ["USD", "12.50", 1250, 2],
    ["KWD", "1.234", 1234, 3]
  ] as const)(
    "handles %s minor-unit precision",
    (currency, input, expectedMinor, digits) => {
      expect(currencyFractionDigits(currency)).toBe(digits);
      expect(majorToMinor(input, currency)).toBe(expectedMinor);
      expect(minorToInput(expectedMinor, currency)).toBe(input);
      expect(formatMoney(expectedMinor, currency, "en-US")).toContain(
        expectedMinor === 1250 && currency === "JPY" ? "1,250" : input
      );
    }
  );

  it("rejects precision beyond the currency", () => {
    expect(majorToMinor("1.001", "USD")).toBeNaN();
    expect(majorToMinor("-1.00", "USD")).toBeNaN();
  });
});
