import {
  ExpenseCategory,
  PaymentMethod,
  SplitType
} from "@/generated/prisma/enums";
import { z } from "zod";
import { normalizeExchangeRate } from "@/lib/currency";
import { isSupportedCurrency } from "@/lib/money";

const id = z.string().trim().min(1).max(64);
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Use a valid date.");
const minorAmount = z.number().int().positive().max(2_000_000_000);
const optionalNotes = z.string().trim().max(500).optional().nullable();
const idempotencyKey = z.string().trim().min(8).max(128);
const currency = z.string().trim().toUpperCase().refine(isSupportedCurrency, "Choose a supported currency.");

export const currencyConversionSchema = z.object({
  currency,
  originalMinor: minorAmount,
  rate: z.string().max(40).transform((value, ctx) => {
    try { return normalizeExchangeRate(value); } catch (error) {
      ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Invalid exchange rate." });
      return z.NEVER;
    }
  }),
  rateDate: dateOnly.refine((value) => value <= new Date().toISOString().slice(0, 10), "The rate date cannot be in the future."),
  source: z.enum(["Frankfurter", "Manual"])
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  currency
});

export const updateGroupSchema = createGroupSchema.extend({
  groupId: id
});

export const groupIdSchema = z.object({ groupId: id });

export const inviteMemberSchema = z.object({
  groupId: id,
  displayName: z.string().trim().min(1).max(60),
  email: z.email().transform((value) => value.trim().toLowerCase())
});

export const memberMutationSchema = z.object({
  groupId: id,
  memberId: id
});

export const claimInvitationSchema = z.object({
  token: z.string().trim().min(32).max(256)
});

export const splitInputSchema = z.object({
  memberId: id,
  amountMinor: z.number().int().nonnegative().max(2_000_000_000).optional(),
  percentageBps: z.number().int().positive().max(10_000).optional(),
  weight: z.number().int().positive().max(1_000_000).optional()
});

const expenseFields = {
  groupId: id,
  expectedCurrency: currency.optional(),
  description: z.string().trim().min(1).max(140),
  totalMinor: minorAmount,
  conversion: currencyConversionSchema.nullable().optional(),
  paidByMemberId: id,
  splitType: z.enum(SplitType),
  category: z.enum(ExpenseCategory),
  expenseDate: dateOnly,
  notes: optionalNotes,
  splits: z.array(splitInputSchema).min(1).max(100)
};

export const createExpenseSchema = z.object({
  ...expenseFields,
  idempotencyKey
});

export const updateExpenseSchema = z.object({
  ...expenseFields,
  expenseId: id,
  expectedVersion: z.number().int().positive()
});

export const recordMutationSchema = z.object({
  groupId: id,
  recordId: id,
  expectedVersion: z.number().int().positive()
});

const settlementFields = {
  groupId: id,
  expectedCurrency: currency.optional(),
  fromMemberId: id,
  toMemberId: id,
  amountMinor: minorAmount,
  conversion: currencyConversionSchema.nullable().optional(),
  method: z.enum(PaymentMethod),
  settledAt: dateOnly,
  notes: optionalNotes
};

export const createSettlementSchema = z.object({
  ...settlementFields,
  idempotencyKey
});

export const updateSettlementSchema = z.object({
  ...settlementFields,
  settlementId: id,
  expectedVersion: z.number().int().positive()
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60)
});

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return errors;
}
