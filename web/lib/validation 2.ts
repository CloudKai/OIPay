import { SplitType } from "@prisma/client";
import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(80)
});

export const addMemberSchema = z.object({
  email: z.string().trim().email()
});

export const exactShareSchema = z.object({
  memberId: z.string().min(1),
  shareCents: z.number().int().positive()
});

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1).max(140),
  totalCents: z.number().int().positive(),
  paidByMemberId: z.string().min(1),
  participantMemberIds: z.array(z.string().min(1)).min(1),
  splitType: z.nativeEnum(SplitType),
  expenseDate: z.string().min(1),
  notes: z.string().trim().max(500).optional().nullable(),
  exactShares: z.array(exactShareSchema).optional()
});

export const createSettlementSchema = z.object({
  fromMemberId: z.string().min(1),
  toMemberId: z.string().min(1),
  amountCents: z.number().int().positive(),
  settledAt: z.string().min(1),
  notes: z.string().trim().max(500).optional().nullable()
});
