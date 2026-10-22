import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { calculateShares } from "@/lib/splits";

describe("calculateShares", () => {
  it("splits equal amounts deterministically", () => {
    expect(
      calculateShares({
        totalMinor: 10,
        splitType: "EQUAL",
        splits: [{ memberId: "c" }, { memberId: "a" }, { memberId: "b" }]
      })
    ).toEqual([
      { memberId: "c", shareMinor: 3, percentageBps: null, weight: null },
      { memberId: "a", shareMinor: 4, percentageBps: null, weight: null },
      { memberId: "b", shareMinor: 3, percentageBps: null, weight: null }
    ]);
  });

  it("requires exact amounts to match the total", () => {
    expect(() =>
      calculateShares({
        totalMinor: 100,
        splitType: "EXACT",
        splits: [
          { memberId: "a", amountMinor: 60 },
          { memberId: "b", amountMinor: 39 }
        ]
      })
    ).toThrow("add up");
  });

  it("stores percentage basis points and rounds the amounts", () => {
    expect(
      calculateShares({
        totalMinor: 101,
        splitType: "PERCENTAGE",
        splits: [
          { memberId: "a", percentageBps: 3333 },
          { memberId: "b", percentageBps: 3333 },
          { memberId: "c", percentageBps: 3334 }
        ]
      }).map((share) => share.shareMinor)
    ).toEqual([34, 33, 34]);
  });

  it("supports weighted shares", () => {
    expect(
      calculateShares({
        totalMinor: 100,
        splitType: "SHARES",
        splits: [
          { memberId: "a", weight: 1 },
          { memberId: "b", weight: 3 }
        ]
      }).map((share) => share.shareMinor)
    ).toEqual([25, 75]);
  });

  it("always allocates the entire total for equal and weighted splits", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2_000_000_000 }),
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), {
          minLength: 1,
          maxLength: 50
        }),
        (totalMinor, weights) => {
          const members = weights.map((weight, index) => ({
            memberId: `member-${index.toString().padStart(3, "0")}`,
            weight
          }));
          const shares = calculateShares({
            totalMinor,
            splitType: "SHARES",
            splits: members
          });
          expect(shares.reduce((sum, share) => sum + share.shareMinor, 0)).toBe(
            totalMinor
          );
          expect(shares.every((share) => share.shareMinor >= 0)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });
});
