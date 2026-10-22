import { z, type ZodType } from "zod";

import type { WorkspaceActivity, WorkspaceExpense, WorkspaceMember, WorkspaceSettlement } from "@/components/group/group-workspace";
import type { CurrencyQuote, WorkspaceActions } from "@/components/group/workspace-runtime";
import { computeGroupBalances } from "@/lib/balances";
import { conversionToRecord, normalizeExchangeRate, type CurrencyConversion } from "@/lib/currency";
import type { ActionResult } from "@/lib/result";
import { calculateShares } from "@/lib/splits";
import {
  createExpenseSchema,
  createSettlementSchema,
  recordMutationSchema,
  updateExpenseSchema,
  updateSettlementSchema,
  zodFieldErrors
} from "@/lib/validation";

export const DEMO_GROUP_ID = "demo-weekend";
export const DEMO_MEMBER_ID = "demo-you";
export const DEMO_CURRENCY = "SGD";

export const demoMembers: WorkspaceMember[] = [
  { id: DEMO_MEMBER_ID, name: "You", role: "MEMBER", status: "ACTIVE", email: null, isGuest: true, invitationDeliveryStatus: null },
  { id: "demo-maya", name: "Maya", role: "OWNER", status: "ACTIVE", email: null, isGuest: true, invitationDeliveryStatus: null },
  { id: "demo-alex", name: "Alex", role: "MEMBER", status: "ACTIVE", email: null, isGuest: true, invitationDeliveryStatus: null }
];

export type DemoState = {
  expenses: WorkspaceExpense[];
  settlements: WorkspaceSettlement[];
  activities: WorkspaceActivity[];
};

const memberIdSchema = z.enum([DEMO_MEMBER_ID, "demo-maya", "demo-alex"]);
const savedConversionFields = {
  originalCurrency: z.string().nullable().optional(),
  originalMinor: z.number().int().positive().max(2_000_000_000).nullable().optional(),
  exchangeRate: z.string().max(40).nullable().optional(),
  exchangeRateDate: z.iso.date().nullable().optional(),
  exchangeRateSource: z.enum(["Frankfurter", "Manual"]).nullable().optional()
};
const savedRecordFields = {
  id: z.string().min(1).max(64),
  version: z.number().int().positive(),
  createdByMemberId: z.literal(DEMO_MEMBER_ID),
  createdAt: z.iso.datetime(),
  ...savedConversionFields
};
const demoStateSchema = z.object({
  expenses: createExpenseSchema.pick({ description: true, totalMinor: true, splitType: true, category: true, expenseDate: true })
    .extend({
      ...savedRecordFields,
      paidByMemberId: memberIdSchema,
      notes: z.string().max(500).nullable(),
      shares: z.array(z.object({
        memberId: memberIdSchema,
        shareMinor: z.number().int().nonnegative().max(2_000_000_000),
        percentageBps: z.number().int().positive().max(10_000).nullable(),
        weight: z.number().int().positive().max(1_000_000).nullable()
      })).min(1).max(3)
    }).array().max(500),
  settlements: createSettlementSchema.pick({ amountMinor: true, method: true, settledAt: true })
    .extend({
      ...savedRecordFields,
      fromMemberId: memberIdSchema,
      toMemberId: memberIdSchema,
      notes: z.string().max(500).nullable()
    }).array().max(500),
  activities: z.array(z.object({
    id: z.string().min(1).max(64), message: z.string().max(240), type: z.string().max(40),
    createdAt: z.iso.datetime(), actorName: z.enum(["You", "Maya", "Alex"])
  })).max(500)
});

/** Treat browser storage as untrusted and reset gracefully if it is damaged. */
export function parseDemoState(value: unknown): DemoState | null {
  const parsed = demoStateSchema.safeParse(value);
  if (!parsed.success) return null;
  const state = parsed.data;
  try {
    for (const records of [state.expenses, state.settlements, state.activities]) {
      if (new Set(records.map(({ id }) => id)).size !== records.length) return null;
    }
    for (const expense of state.expenses) {
      const expected = calculateShares({
        totalMinor: expense.totalMinor, splitType: expense.splitType,
        splits: expense.shares.map((share) => ({ memberId: share.memberId, amountMinor: share.shareMinor, percentageBps: share.percentageBps ?? undefined, weight: share.weight ?? undefined }))
      });
      if (expected.some((share, index) => share.shareMinor !== expense.shares[index]?.shareMinor)) return null;
      conversionFields(undefined, expense.totalMinor, expense);
    }
    for (const payment of state.settlements) {
      if (payment.fromMemberId === payment.toMemberId) return null;
      conversionFields(undefined, payment.amountMinor, payment);
    }
    return state;
  } catch {
    return null;
  }
}

export function createDemoState(): DemoState {
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const expenses: WorkspaceExpense[] = [
    { id: "demo-hotel", description: "Weekend hotel", totalMinor: 18_000, paidByMemberId: "demo-maya", category: "HOUSING" },
    { id: "demo-dinner", description: "Dinner together", totalMinor: 9_000, paidByMemberId: DEMO_MEMBER_ID, category: "FOOD" },
    { id: "demo-taxi", description: "Taxi to the hotel", totalMinor: 3_000, paidByMemberId: "demo-alex", category: "TRANSPORT" }
  ].map((expense) => ({
    ...expense,
    category: expense.category as WorkspaceExpense["category"],
    version: 1,
    createdByMemberId: DEMO_MEMBER_ID,
    createdAt: now,
    expenseDate: date,
    notes: "Sample expense — try editing it.",
    splitType: "EQUAL",
    shares: calculateShares({ totalMinor: expense.totalMinor, splitType: "EQUAL", splits: demoMembers.map(({ id }) => ({ memberId: id })) })
  }));
  return {
    expenses,
    settlements: [],
    activities: [{ id: "demo-welcome", type: "GROUP_CREATED", message: "Sample weekend group is ready to explore", actorName: "Maya", createdAt: now }]
  };
}

class DemoFailure extends Error {
  constructor(message: string, readonly fieldErrors?: Record<string, string[]>) {
    super(message);
  }
}

function parse<T>(schema: ZodType<T>, input: unknown, message: string): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new DemoFailure(message, zodFieldErrors(result.error));
  return result.data;
}

async function run<T>(work: () => { data: T; message: string }): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...work() };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Check the demo details and try again.",
      ...(error instanceof DemoFailure && error.fieldErrors ? { fieldErrors: error.fieldErrors } : {})
    };
  }
}

function validateGroup(input: { groupId: string; expectedCurrency?: string }) {
  if (input.groupId !== DEMO_GROUP_ID) throw new DemoFailure("Choose the demo group.");
  if (input.expectedCurrency && input.expectedCurrency !== DEMO_CURRENCY) {
    throw new DemoFailure("This demo group uses SGD. Check the currency and try again.");
  }
}

function validateMembers(ids: string[]) {
  if (ids.some((id) => !demoMembers.some((member) => member.id === id))) {
    throw new DemoFailure("Choose members of the demo group.");
  }
}

function editable<T extends { id: string; version: number; createdByMemberId: string }>(records: T[], id: string, version: number): T {
  const current = records.find((record) => record.id === id);
  if (!current) throw new DemoFailure("This demo record no longer exists.");
  if (current.createdByMemberId !== DEMO_MEMBER_ID) throw new DemoFailure("You can only change your own records.");
  if (current.version !== version) throw new DemoFailure("This record changed. Close the form and try again.");
  return current;
}

function conversionFields(conversion: CurrencyConversion | null | undefined, amountMinor: number, current?: WorkspaceExpense | WorkspaceSettlement) {
  if (conversion === undefined && current?.originalCurrency) {
    conversion = {
      currency: current.originalCurrency,
      originalMinor: current.originalMinor!,
      rate: current.exchangeRate!,
      rateDate: current.exchangeRateDate!,
      source: current.exchangeRateSource as CurrencyConversion["source"]
    };
  }
  const record = conversionToRecord(conversion, DEMO_CURRENCY, amountMinor);
  return { ...record, exchangeRateDate: record.exchangeRateDate?.toISOString().slice(0, 10) ?? null };
}

function validatePayment(state: DemoState, input: { fromMemberId: string; toMemberId: string; amountMinor: number }, excludeId?: string) {
  validateMembers([input.fromMemberId, input.toMemberId]);
  if (input.fromMemberId === input.toMemberId) throw new DemoFailure("Choose two different group members.");
  const { balances } = computeGroupBalances({ members: demoMembers, expenses: state.expenses, settlements: state.settlements.filter(({ id }) => id !== excludeId) });
  const from = balances.find(({ memberId }) => memberId === input.fromMemberId)!;
  const to = balances.find(({ memberId }) => memberId === input.toMemberId)!;
  if (from.netMinor >= 0 || to.netMinor <= 0) {
    throw new DemoFailure("The payer must currently owe money and the receiver must currently be owed money.");
  }
  if (input.amountMinor > Math.min(-from.netMinor, to.netMinor)) {
    throw new DemoFailure("The payment is larger than the current amount owed.");
  }
}

/** All writes stay in the supplied browser state. No account, cookies, or database are used. */
export function createDemoActions(getState: () => DemoState, setState: (next: DemoState) => void): WorkspaceActions {
  const expensesByKey = new Map<string, { expenseId: string; version: number }>();
  const settlementsByKey = new Map<string, { settlementId: string; version: number }>();
  function commit(state: DemoState, next: DemoState, type: string, message: string) {
    setState({ ...next, activities: [{ id: crypto.randomUUID(), type, message, actorName: "You", createdAt: new Date().toISOString() }, ...state.activities].slice(0, 500) });
  }
  return {
    createExpenseAction: (input) => run(() => {
      const data = parse(createExpenseSchema, input, "Check the expense details.");
      validateGroup(data);
      const previous = expensesByKey.get(data.idempotencyKey);
      if (previous) return { data: previous, message: "Expense added." };
      if (getState().expenses.length >= 500) throw new DemoFailure("Reset the demo to try more expenses.");
      validateMembers([data.paidByMemberId, ...data.splits.map(({ memberId }) => memberId)]);
      const expense: WorkspaceExpense = {
        id: crypto.randomUUID(), version: 1, createdByMemberId: DEMO_MEMBER_ID, createdAt: new Date().toISOString(),
        description: data.description, totalMinor: data.totalMinor, paidByMemberId: data.paidByMemberId,
        splitType: data.splitType, category: data.category, expenseDate: data.expenseDate, notes: data.notes || null,
        shares: calculateShares(data), ...conversionFields(data.conversion, data.totalMinor)
      };
      const state = getState();
      commit(state, { ...state, expenses: [expense, ...state.expenses] }, "EXPENSE_CREATED", `You added ${expense.description}`);
      const result = { expenseId: expense.id, version: expense.version };
      expensesByKey.set(data.idempotencyKey, result);
      return { data: result, message: "Expense added." };
    }),
    updateExpenseAction: (input) => run(() => {
      const data = parse(updateExpenseSchema, input, "Check the expense details.");
      validateGroup(data);
      const state = getState();
      const current = editable(state.expenses, data.expenseId, data.expectedVersion);
      validateMembers([data.paidByMemberId, ...data.splits.map(({ memberId }) => memberId)]);
      const expense: WorkspaceExpense = {
        ...current, version: current.version + 1,
        description: data.description, totalMinor: data.totalMinor, paidByMemberId: data.paidByMemberId,
        splitType: data.splitType, category: data.category, expenseDate: data.expenseDate, notes: data.notes || null,
        shares: calculateShares(data), ...conversionFields(data.conversion, data.totalMinor, current)
      };
      commit(state, { ...state, expenses: state.expenses.map((record) => record.id === current.id ? expense : record) }, "EXPENSE_UPDATED", `You updated ${expense.description}`);
      return { data: { expenseId: expense.id, version: expense.version }, message: "Expense updated." };
    }),
    deleteExpenseAction: (input) => run(() => {
      const data = parse(recordMutationSchema, input, "Invalid expense.");
      validateGroup(data);
      const state = getState();
      const current = editable(state.expenses, data.recordId, data.expectedVersion);
      commit(state, { ...state, expenses: state.expenses.filter(({ id }) => id !== current.id) }, "EXPENSE_DELETED", `You deleted ${current.description}`);
      return { data: { expenseId: current.id }, message: "Expense deleted." };
    }),
    createSettlementAction: (input) => run(() => {
      const data = parse(createSettlementSchema, input, "Check the payment details.");
      validateGroup(data);
      const previous = settlementsByKey.get(data.idempotencyKey);
      if (previous) return { data: previous, message: "Payment recorded." };
      const state = getState();
      if (state.settlements.length >= 500) throw new DemoFailure("Reset the demo to try more payments.");
      validatePayment(state, data);
      const settlement: WorkspaceSettlement = {
        id: crypto.randomUUID(), version: 1, createdByMemberId: DEMO_MEMBER_ID, createdAt: new Date().toISOString(),
        fromMemberId: data.fromMemberId, toMemberId: data.toMemberId, amountMinor: data.amountMinor,
        method: data.method, settledAt: data.settledAt, notes: data.notes || null,
        ...conversionFields(data.conversion, data.amountMinor)
      };
      commit(state, { ...state, settlements: [settlement, ...state.settlements] }, "SETTLEMENT_CREATED", "You recorded a payment");
      const result = { settlementId: settlement.id, version: settlement.version };
      settlementsByKey.set(data.idempotencyKey, result);
      return { data: result, message: "Payment recorded." };
    }),
    updateSettlementAction: (input) => run(() => {
      const data = parse(updateSettlementSchema, input, "Check the payment details.");
      validateGroup(data);
      const state = getState();
      const current = editable(state.settlements, data.settlementId, data.expectedVersion);
      validatePayment(state, data, current.id);
      const settlement: WorkspaceSettlement = {
        ...current, version: current.version + 1,
        fromMemberId: data.fromMemberId, toMemberId: data.toMemberId, amountMinor: data.amountMinor,
        method: data.method, settledAt: data.settledAt, notes: data.notes || null,
        ...conversionFields(data.conversion, data.amountMinor, current)
      };
      commit(state, { ...state, settlements: state.settlements.map((record) => record.id === current.id ? settlement : record) }, "SETTLEMENT_UPDATED", "You updated a payment");
      return { data: { settlementId: settlement.id, version: settlement.version }, message: "Payment updated." };
    }),
    deleteSettlementAction: (input) => run(() => {
      const data = parse(recordMutationSchema, input, "Invalid payment.");
      validateGroup(data);
      const state = getState();
      const current = editable(state.settlements, data.recordId, data.expectedVersion);
      commit(state, { ...state, settlements: state.settlements.filter(({ id }) => id !== current.id) }, "SETTLEMENT_DELETED", "You deleted a payment");
      return { data: { settlementId: current.id }, message: "Payment deleted." };
    })
  };
}

// Illustrative rates only. The demo labels these as sample rates, never live quotes.
const sampleSgdPerUnit: Record<string, number> = {
  SGD: 1, USD: 1.3, EUR: 1.5, GBP: 1.75, AUD: 0.85, CAD: 0.95, JPY: 0.009,
  CNY: 0.18, HKD: 0.167, INR: 0.015, IDR: 0.00008, MYR: 0.3, THB: 0.039,
  PHP: 0.023, KRW: 0.00095, NZD: 0.77, CHF: 1.65, SEK: 0.14, NOK: 0.13,
  DKK: 0.2, AED: 0.35, SAR: 0.35, VND: 0.00005, TWD: 0.041, KWD: 4.25,
  BHD: 3.45, OMR: 3.4, JOD: 1.84, TND: 0.45
};

export async function getDemoQuote({ from, to, signal }: { from: string; to: string; signal?: AbortSignal }): Promise<CurrencyQuote> {
  signal?.throwIfAborted();
  const fromRate = sampleSgdPerUnit[from];
  const toRate = sampleSgdPerUnit[to];
  if (!fromRate || !toRate) throw new Error("Choose a supported currency.");
  return { from, to, rate: normalizeExchangeRate((fromRate / toRate).toFixed(12)), rateDate: new Date().toISOString().slice(0, 10), source: "Manual" };
}
