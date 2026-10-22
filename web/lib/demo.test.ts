import { describe, expect, it } from "vitest";

import { computeGroupBalances } from "@/lib/balances";
import { convertMinor } from "@/lib/currency";
import {
  createDemoActions, createDemoState, DEMO_CURRENCY, DEMO_GROUP_ID, DEMO_MEMBER_ID,
  demoMembers, getDemoQuote, parseDemoState, type DemoState
} from "@/lib/demo";
import { supportedCurrencies } from "@/lib/money";

function setup() {
  let state = createDemoState();
  const actions = createDemoActions(() => state, (next) => { state = next; });
  return { actions, state: () => state };
}

function expenseInput() {
  return {
    groupId: DEMO_GROUP_ID, expectedCurrency: DEMO_CURRENCY, description: "Coffee", totalMinor: 1_001,
    paidByMemberId: DEMO_MEMBER_ID, splitType: "EQUAL", category: "FOOD",
    expenseDate: new Date().toISOString().slice(0, 10), idempotencyKey: "demo-coffee-key",
    splits: demoMembers.map(({ id }) => ({ memberId: id }))
  };
}

function paymentInput() {
  return {
    groupId: DEMO_GROUP_ID, expectedCurrency: DEMO_CURRENCY, fromMemberId: DEMO_MEMBER_ID,
    toMemberId: "demo-maya", amountMinor: 500, method: "BANK_TRANSFER",
    settledAt: new Date().toISOString().slice(0, 10), idempotencyKey: "demo-payment-key"
  };
}

function balances(state: DemoState) {
  return computeGroupBalances({ members: demoMembers, ...state }).balances;
}

describe("browser demo finances", () => {
  it("starts with an editable sample trip and balanced SGD debts", () => {
    const state = createDemoState();
    expect(balances(state).map(({ memberId, netMinor }) => ({ memberId, netMinor }))).toEqual([
      { memberId: DEMO_MEMBER_ID, netMinor: -1_000 },
      { memberId: "demo-maya", netMinor: 8_000 },
      { memberId: "demo-alex", netMinor: -7_000 }
    ]);
    expect(state.expenses.every(({ createdByMemberId }) => createdByMemberId === DEMO_MEMBER_ID)).toBe(true);
    state.expenses.pop();
    expect(createDemoState().expenses).toHaveLength(3);
  });

  it("adds, edits, and deletes expenses while preserving prior state and activity", async () => {
    const demo = setup();
    const original = demo.state();
    const added = await demo.actions.createExpenseAction(expenseInput());
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(original.expenses).toHaveLength(3);
    expect(demo.state().expenses).toHaveLength(4);
    const coffee = demo.state().expenses.find(({ id }) => id === added.data.expenseId)!;
    expect(coffee.shares.reduce((sum, { shareMinor }) => sum + shareMinor, 0)).toBe(1_001);
    expect(balances(demo.state()).reduce((sum, { netMinor }) => sum + netMinor, 0)).toBe(0);
    const edited = await demo.actions.updateExpenseAction({
      ...expenseInput(), expenseId: coffee.id, expectedVersion: 1,
      description: "Breakfast", splitType: "EXACT", totalMinor: 600,
      splits: [{ memberId: DEMO_MEMBER_ID, amountMinor: 400 }, { memberId: "demo-maya", amountMinor: 200 }]
    });
    expect(edited).toMatchObject({ ok: true, data: { version: 2 } });
    expect(demo.state().expenses[0]).toMatchObject({ description: "Breakfast", totalMinor: 600 });
    expect(coffee.description).toBe("Coffee");
    expect(await demo.actions.deleteExpenseAction({ groupId: DEMO_GROUP_ID, recordId: coffee.id, expectedVersion: 2 })).toMatchObject({ ok: true });
    expect(demo.state().expenses).toEqual(original.expenses);
    expect(demo.state().activities.map(({ type }) => type).slice(0, 3)).toEqual(["EXPENSE_DELETED", "EXPENSE_UPDATED", "EXPENSE_CREATED"]);
  });

  it("rejects bad amounts, participants, groups, currencies, and exact splits without writing", async () => {
    const demo = setup();
    const original = demo.state();
    for (const changes of [
      { totalMinor: -1 }, { totalMinor: 1.5 }, { totalMinor: 2_000_000_001 },
      { paidByMemberId: "real-person" }, { splits: [{ memberId: "real-person" }] },
      { groupId: "real-group" }, { expectedCurrency: "USD" },
      { splitType: "EXACT", splits: [{ memberId: DEMO_MEMBER_ID, amountMinor: 1 }] },
      { splits: [{ memberId: DEMO_MEMBER_ID }, { memberId: DEMO_MEMBER_ID }] }
    ]) {
      expect(await demo.actions.createExpenseAction({ ...expenseInput(), ...changes })).toMatchObject({ ok: false });
      expect(demo.state()).toBe(original);
    }
    expect(await demo.actions.createExpenseAction(null)).toMatchObject({ ok: false, fieldErrors: expect.any(Object) });
  });

  it("rejects stale edits and deletes without overwriting a newer record", async () => {
    const demo = setup();
    const hotel = demo.state().expenses[0]!;
    const input = { ...expenseInput(), expenseId: hotel.id, expectedVersion: 1 };
    expect(await demo.actions.updateExpenseAction(input)).toMatchObject({ ok: true, data: { version: 2 } });
    const state = demo.state();
    expect(await demo.actions.updateExpenseAction(input)).toMatchObject({ ok: false });
    expect(await demo.actions.deleteExpenseAction({ groupId: DEMO_GROUP_ID, recordId: hotel.id, expectedVersion: 1 })).toMatchObject({ ok: false });
    expect(demo.state()).toBe(state);
    expect(await demo.actions.deleteExpenseAction({ groupId: DEMO_GROUP_ID, recordId: "missing", expectedVersion: 1 })).toMatchObject({ ok: false });
  });

  it("makes retries idempotent for both expenses and payments", async () => {
    const expenses = setup();
    const firstExpense = await expenses.actions.createExpenseAction(expenseInput());
    expect(await expenses.actions.createExpenseAction(expenseInput())).toEqual(firstExpense);
    expect(expenses.state().expenses).toHaveLength(4);
    const payments = setup();
    const firstPayment = await payments.actions.createSettlementAction(paymentInput());
    expect(await payments.actions.createSettlementAction(paymentInput())).toEqual(firstPayment);
    expect(payments.state().settlements).toHaveLength(1);
  });

  it("records partial payments, edits with the old payment excluded, and restores deleted debt", async () => {
    const demo = setup();
    const original = demo.state();
    const paid = await demo.actions.createSettlementAction(paymentInput());
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(balances(demo.state()).find(({ memberId }) => memberId === DEMO_MEMBER_ID)?.netMinor).toBe(-500);
    const edit = { ...paymentInput(), settlementId: paid.data.settlementId, expectedVersion: 1, amountMinor: 1_000 };
    expect(await demo.actions.updateSettlementAction(edit)).toMatchObject({ ok: true, data: { version: 2 } });
    expect(balances(demo.state()).find(({ memberId }) => memberId === DEMO_MEMBER_ID)?.netMinor).toBe(0);
    const settled = demo.state();
    expect(await demo.actions.updateSettlementAction({ ...edit, amountMinor: 1_001, expectedVersion: 2 })).toMatchObject({ ok: false });
    expect(await demo.actions.updateSettlementAction(edit)).toMatchObject({ ok: false });
    expect(demo.state()).toBe(settled);
    expect(await demo.actions.deleteSettlementAction({ groupId: DEMO_GROUP_ID, recordId: paid.data.settlementId, expectedVersion: 2 })).toMatchObject({ ok: true });
    expect(balances(demo.state())).toEqual(balances(original));
    expect(demo.state().activities[0]?.type).toBe("SETTLEMENT_DELETED");
  });

  it("blocks overpayments, self payments, reversed debt, and unknown members", async () => {
    const demo = setup();
    const original = demo.state();
    for (const changes of [
      { amountMinor: 1_001 }, { amountMinor: 0 }, { fromMemberId: "real-member" },
      { toMemberId: DEMO_MEMBER_ID }, { fromMemberId: "demo-maya", toMemberId: DEMO_MEMBER_ID }
    ]) {
      expect(await demo.actions.createSettlementAction({ ...paymentInput(), ...changes })).toMatchObject({ ok: false });
      expect(demo.state()).toBe(original);
    }
  });

  it("validates conversions exactly and preserves saved rates on ordinary edits", async () => {
    const demo = setup();
    const conversion = { currency: "EUR", originalMinor: 1_000, rate: "1.5", rateDate: new Date().toISOString().slice(0, 10), source: "Manual" };
    expect(await demo.actions.createExpenseAction({ ...expenseInput(), totalMinor: 1_499, conversion })).toMatchObject({ ok: false });
    const added = await demo.actions.createExpenseAction({ ...expenseInput(), totalMinor: 1_500, conversion });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const input = { ...expenseInput(), totalMinor: 1_500, expenseId: added.data.expenseId, expectedVersion: 1 };
    expect(await demo.actions.updateExpenseAction(input)).toMatchObject({ ok: true });
    expect(demo.state().expenses[0]).toMatchObject({ originalCurrency: "EUR", originalMinor: 1_000, exchangeRate: "1.5", exchangeRateDate: conversion.rateDate, exchangeRateSource: "Manual" });
    expect(await demo.actions.updateExpenseAction({ ...input, totalMinor: 1_501, expectedVersion: 2 })).toMatchObject({ ok: false });
    expect(await demo.actions.updateExpenseAction({ ...input, conversion: null, expectedVersion: 2 })).toMatchObject({ ok: true });
    expect(demo.state().expenses[0]?.originalCurrency).toBeNull();
  });

  it("supports foreign currency repayments without changing their accounting amount", async () => {
    const demo = setup();
    const conversion = { currency: "JPY", originalMinor: 500, rate: "0.01", rateDate: new Date().toISOString().slice(0, 10), source: "Manual" };
    const result = await demo.actions.createSettlementAction({ ...paymentInput(), conversion });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(demo.state().settlements[0]).toMatchObject({ amountMinor: 500, originalCurrency: "JPY", originalMinor: 500, exchangeRate: "0.01" });
    expect(await demo.actions.updateSettlementAction({ ...paymentInput(), settlementId: result.data.settlementId, expectedVersion: 1 })).toMatchObject({ ok: true });
    expect(demo.state().settlements[0]?.originalCurrency).toBe("JPY");
  });
});

describe("stored demo state", () => {
  it("round trips fresh and changed states", async () => {
    const demo = setup();
    expect(parseDemoState(JSON.parse(JSON.stringify(demo.state())))).toEqual(demo.state());
    await demo.actions.createExpenseAction(expenseInput());
    await demo.actions.createSettlementAction(paymentInput());
    expect(parseDemoState(JSON.parse(JSON.stringify(demo.state())))).toEqual(demo.state());
  });

  it("rejects damaged, oversized, duplicate, and financially inconsistent data", () => {
    expect(parseDemoState(null)).toBeNull();
    expect(parseDemoState({ expenses: [], settlements: [] })).toBeNull();
    const state = createDemoState();
    expect(parseDemoState({ ...state, expenses: [...state.expenses, state.expenses[0]] })).toBeNull();
    expect(parseDemoState({ ...state, activities: Array.from({ length: 501 }, () => state.activities[0]) })).toBeNull();
    state.expenses[0]!.shares[0]!.shareMinor++;
    expect(parseDemoState(state)).toBeNull();
    const unknownMember = createDemoState();
    unknownMember.expenses[0]!.paidByMemberId = "real-member";
    expect(parseDemoState(unknownMember)).toBeNull();
  });
});

describe("illustrative demo quotes", () => {
  it("covers every supported currency and uses the target per source convention", async () => {
    for (const { code } of supportedCurrencies) {
      const quote = await getDemoQuote({ from: code, to: DEMO_CURRENCY });
      expect(quote).toMatchObject({ from: code, to: DEMO_CURRENCY, source: "Manual", rateDate: new Date().toISOString().slice(0, 10) });
      expect(Number(quote.rate)).toBeGreaterThan(0);
    }
    const eur = await getDemoQuote({ from: "EUR", to: DEMO_CURRENCY });
    expect(convertMinor(1_000, "EUR", DEMO_CURRENCY, eur.rate)).toBe(1_500);
    expect((await getDemoQuote({ from: DEMO_CURRENCY, to: "EUR" })).rate).toBe("0.666666666667");
  });

  it("rejects unsupported currencies and respects cancellation", async () => {
    await expect(getDemoQuote({ from: "ABC", to: "SGD" })).rejects.toThrow("supported currency");
    const controller = new AbortController();
    controller.abort();
    await expect(getDemoQuote({ from: "EUR", to: "SGD", signal: controller.signal })).rejects.toThrow();
  });
});
