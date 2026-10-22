import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  user: vi.fn(), membership: vi.fn(), revalidate: vi.fn(),
  expense: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  settlement: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  shares: { createMany: vi.fn(), deleteMany: vi.fn() },
  activity: { create: vi.fn() }, transaction: vi.fn(), finance: vi.fn(), lock: vi.fn()
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/session", () => ({ getSessionUser: mocks.user, getSessionPrincipal: mocks.user }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  expense: mocks.expense, settlement: mocks.settlement, $transaction: mocks.transaction
} }));
vi.mock("@/lib/server/authz", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/authz")>(),
  requireActionUser: mocks.user, requireMembership: mocks.membership
}));
vi.mock("@/lib/member-validation", () => ({ validateGroupMemberIds: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/server/finance", () => ({ loadGroupFinance: mocks.finance, validateSettlementAgainstBalances: vi.fn() }));
vi.mock("@/lib/server/retry-transaction", () => ({
  createOnce: async (_find: unknown, create: () => Promise<unknown>) => create(),
  retryTransaction: async (operation: () => Promise<unknown>) => operation()
}));

import { createExpenseAction, updateExpenseAction, deleteExpenseAction } from "./expenses";
import { createSettlementAction, updateSettlementAction, deleteSettlementAction } from "./settlements";

const conversion = { currency: "JPY", originalMinor: 3000, rate: "0.00809", rateDate: "2026-01-02", source: "Frankfurter" };
const saved = { originalCurrency: "JPY", originalMinor: 3000, exchangeRate: "0.00809", exchangeRateDate: new Date("2026-01-02T00:00:00Z"), exchangeRateSource: "Frankfurter" };
const expenseInput = {
  groupId: "trip", description: "Dinner", totalMinor: 2427, paidByMemberId: "alice",
  splitType: "EQUAL", category: "FOOD", expenseDate: "2026-01-02",
  splits: [{ memberId: "alice" }, { memberId: "bob" }], idempotencyKey: "unique-request", conversion
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "guest:session", name: "Alice" });
  mocks.membership.mockResolvedValue({ id: "alice", role: "MEMBER", group: { currency: "SGD", archivedAt: null } });
  mocks.expense.create.mockImplementation(async ({ data }) => ({ id: "expense", version: 1, ...data }));
  mocks.settlement.create.mockImplementation(async ({ data }) => ({ id: "settlement", version: 1, ...data }));
  mocks.expense.updateMany.mockResolvedValue({ count: 1 });
  mocks.finance.mockResolvedValue({ balances: [] });
  mocks.lock.mockResolvedValue([{ id: "trip", currency: "SGD", archivedAt: null }]);
  mocks.transaction.mockImplementation(async (operation) => operation({
    expense: mocks.expense, settlement: mocks.settlement, expenseShare: mocks.shares, activityLog: mocks.activity, $queryRaw: mocks.lock
  }));
});

describe("financial currency and archive rechecks", () => {
  const paymentInput = {
    groupId: "trip", fromMemberId: "alice", toMemberId: "bob", amountMinor: 2427,
    method: "BANK_TRANSFER", settledAt: "2026-01-02", idempotencyKey: "unique-payment", conversion
  };
  it.each([
    ["expense", () => createExpenseAction({ ...expenseInput, expectedCurrency: "USD" })],
    ["payment", () => createSettlementAction({ ...paymentInput, expectedCurrency: "USD" })],
    ["expense edit", () => updateExpenseAction({ ...expenseInput, expenseId: "expense", expectedVersion: 1, expectedCurrency: "USD" })],
    ["payment edit", () => updateSettlementAction({ ...paymentInput, settlementId: "payment", expectedVersion: 1, expectedCurrency: "USD" })]
  ])("rejects a stale browser currency for %s before any transaction", async (_name, save) => {
    expect(await save()).toMatchObject({ ok: false, message: expect.stringContaining("currency changed") });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([
    ["expense", () => createExpenseAction(expenseInput)],
    ["payment", () => createSettlementAction(paymentInput)]
  ])("rejects a changed locked currency before creating %s", async (_name, save) => {
    mocks.lock.mockResolvedValue([{ id: "trip", currency: "USD", archivedAt: null }]);
    expect(await save()).toMatchObject({ ok: false, message: expect.stringContaining("currency changed") });
    expect(mocks.expense.create).not.toHaveBeenCalled();
    expect(mocks.settlement.create).not.toHaveBeenCalled();
  });
  it.each([
    ["create expense", () => createExpenseAction(expenseInput)],
    ["create payment", () => createSettlementAction(paymentInput)],
    ["update expense", () => updateExpenseAction({ ...expenseInput, expenseId: "expense", expectedVersion: 1 })],
    ["update payment", () => updateSettlementAction({ ...paymentInput, settlementId: "payment", expectedVersion: 1 })],
    ["delete expense", () => deleteExpenseAction({ groupId: "trip", recordId: "expense", expectedVersion: 1 })],
    ["delete payment", () => deleteSettlementAction({ groupId: "trip", recordId: "payment", expectedVersion: 1 })]
  ])("rechecks archive status before %s", async (_name, save) => {
    mocks.expense.findFirst.mockResolvedValue({ id: "expense", createdByMemberId: "alice", ...saved });
    mocks.settlement.findFirst.mockResolvedValue({ id: "payment", createdByMemberId: "alice", ...saved });
    mocks.lock.mockResolvedValue([{ id: "trip", currency: "SGD", archivedAt: new Date() }]);
    expect(await save()).toMatchObject({ ok: false, message: expect.stringContaining("archived") });
    expect(mocks.expense.create).not.toHaveBeenCalled();
    expect(mocks.settlement.create).not.toHaveBeenCalled();
    expect(mocks.expense.updateMany).not.toHaveBeenCalled();
    expect(mocks.settlement.updateMany).not.toHaveBeenCalled();
    expect(mocks.activity.create).not.toHaveBeenCalled();
  });
});

describe("foreign financial record actions", () => {
  it("persists the confirmed original expense and saved rate alongside exact group shares", async () => {
    expect(await createExpenseAction(expenseInput)).toMatchObject({ ok: true });
    expect(mocks.expense.create).toHaveBeenCalledWith({ data: expect.objectContaining({ totalMinor: 2427, ...saved }) });
    const shares = mocks.shares.createMany.mock.calls[0]?.[0].data as { shareMinor: number }[];
    expect(shares.reduce((sum, share) => sum + share.shareMinor, 0)).toBe(2427);
  });
  it("rejects a tampered group expense total before writing a record", async () => {
    expect(await createExpenseAction({ ...expenseInput, totalMinor: 2500 })).toMatchObject({ ok: false, message: expect.stringMatching(/does not match/) });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("keeps a converted expense rate when an older client edits its description", async () => {
    mocks.expense.findFirst.mockResolvedValue({ id: "expense", createdByMemberId: "alice", ...saved });
    expect(await updateExpenseAction({ ...expenseInput, expenseId: "expense", expectedVersion: 1, conversion: undefined })).toMatchObject({ ok: true });
    expect(mocks.expense.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining(saved) }));
  });
  it("uses the group equivalent for a foreign repayment and keeps original payment evidence", async () => {
    expect(await createSettlementAction({
      groupId: "trip", fromMemberId: "alice", toMemberId: "bob", amountMinor: 2427,
      method: "BANK_TRANSFER", settledAt: "2026-01-02", idempotencyKey: "unique-payment", conversion
    })).toMatchObject({ ok: true });
    expect(mocks.settlement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amountMinor: 2427, ...saved }) });
  });
});
