import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeGroupBalances } from "@/lib/balances";
import { calculateShares } from "@/lib/splits";

describe("computeGroupBalances", () => {
  it("simplifies a chain of debts without changing final balances", () => {
    const result = computeGroupBalances({
      members: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" }
      ],
      expenses: [
        {
          paidByMemberId: "c",
          totalMinor: 300,
          shares: [
            { memberId: "a", shareMinor: 100 },
            { memberId: "b", shareMinor: 100 },
            { memberId: "c", shareMinor: 100 }
          ]
        }
      ],
      settlements: [
        {
          fromMemberId: "b",
          toMemberId: "c",
          amountMinor: 40
        }
      ]
    });

    expect(result.simplifiedDebts).toEqual([
      {
        fromMemberId: "a",
        toMemberId: "c",
        fromName: "A",
        toName: "C",
        amountMinor: 100
      },
      {
        fromMemberId: "b",
        toMemberId: "c",
        fromName: "B",
        toName: "C",
        amountMinor: 60
      }
    ]);
  });

  it("always produces balances that sum to zero", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 20 }),
        (totalMinor, memberCount) => {
          const members = Array.from({ length: memberCount }, (_, index) => ({
            id: `member-${index}`,
            name: `Member ${index}`
          }));
          const shares = calculateShares({
            totalMinor,
            splitType: "EQUAL",
            splits: members.map((member) => ({ memberId: member.id }))
          });
          const result = computeGroupBalances({
            members,
            expenses: [
              {
                paidByMemberId: members[0]!.id,
                totalMinor,
                shares
              }
            ],
            settlements: []
          });
          expect(
            result.balances.reduce((sum, balance) => sum + balance.netMinor, 0)
          ).toBe(0);
          expect(
            result.simplifiedDebts.reduce(
              (sum, debt) => sum + debt.amountMinor,
              0
            )
          ).toBe(
            result.balances
              .filter((balance) => balance.netMinor < 0)
              .reduce((sum, balance) => sum + Math.abs(balance.netMinor), 0)
          );
        }
      ),
      { numRuns: 500 }
    );
  });
});
