import type { SplitType } from "@/generated/prisma/client";
import type { SplitInput } from "@/lib/domain";

export type CalculatedShare = {
  memberId: string;
  shareMinor: number;
  percentageBps: number | null;
  weight: number | null;
};

function largestRemainder(
  totalMinor: number,
  weighted: { memberId: string; weight: number }[]
) {
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    throw new Error("Split weights must be positive.");
  }

  const provisional = weighted.map((item) => {
    const numerator = totalMinor * item.weight;
    return {
      memberId: item.memberId,
      amount: Math.floor(numerator / totalWeight),
      remainder: numerator % totalWeight
    };
  });

  const remaining =
    totalMinor - provisional.reduce((sum, item) => sum + item.amount, 0);
  provisional.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.memberId.localeCompare(b.memberId);
  });

  for (let index = 0; index < remaining; index += 1) {
    const item = provisional[index];
    if (item) item.amount += 1;
  }

  return new Map(provisional.map((item) => [item.memberId, item.amount]));
}

export function calculateShares(input: {
  totalMinor: number;
  splitType: SplitType;
  splits: SplitInput[];
}): CalculatedShare[] {
  if (!Number.isInteger(input.totalMinor) || input.totalMinor <= 0) {
    throw new Error("Expense total must be a positive whole minor-unit amount.");
  }

  const uniqueIds = new Set(input.splits.map((split) => split.memberId));
  if (uniqueIds.size !== input.splits.length || input.splits.length === 0) {
    throw new Error("Each participant must appear exactly once.");
  }

  if (input.splitType === "EXACT") {
    const shares = input.splits.map((split) => ({
      memberId: split.memberId,
      shareMinor: split.amountMinor ?? 0,
      percentageBps: null,
      weight: null
    }));

    if (
      shares.some(
        (share) => !Number.isInteger(share.shareMinor) || share.shareMinor < 0
      )
    ) {
      throw new Error("Exact shares must be whole, non-negative minor-unit amounts.");
    }
    if (
      shares.reduce((sum, share) => sum + share.shareMinor, 0) !==
      input.totalMinor
    ) {
      throw new Error("Exact shares must add up to the expense total.");
    }
    return shares;
  }

  const weights = input.splits.map((split) => ({
    memberId: split.memberId,
    weight:
      input.splitType === "PERCENTAGE"
        ? split.percentageBps ?? 0
        : input.splitType === "SHARES"
          ? split.weight ?? 0
          : 1
  }));

  if (weights.some((item) => !Number.isInteger(item.weight) || item.weight <= 0)) {
    throw new Error("Every selected participant must have a positive split value.");
  }

  if (
    input.splitType === "PERCENTAGE" &&
    weights.reduce((sum, item) => sum + item.weight, 0) !== 10_000
  ) {
    throw new Error("Percentages must add up to exactly 100%.");
  }

  const amounts = largestRemainder(input.totalMinor, weights);
  return input.splits.map((split) => ({
    memberId: split.memberId,
    shareMinor: amounts.get(split.memberId) ?? 0,
    percentageBps:
      input.splitType === "PERCENTAGE" ? split.percentageBps ?? null : null,
    weight: input.splitType === "SHARES" ? split.weight ?? null : null
  }));
}
