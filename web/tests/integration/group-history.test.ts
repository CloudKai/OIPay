import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { computeGroupBalances } from "@/lib/balances";
import { getDashboardData, getGroupPageData } from "@/lib/group-data";
import { parseHistoryQuery } from "@/lib/history-query";
import { prisma } from "@/lib/prisma";
import { loadGroupFinance } from "@/lib/server/finance";

const suite = process.env.RUN_DATABASE_TESTS === "true" ? describe : describe.skip;
const suffix = randomUUID();
let userId = "";
let groupId = "";
let memberIds: string[] = [];
let paymentId = "";

suite("bounded histories and full-history balances", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { name: "History Owner", email: `history-${suffix}@example.com` } });
    userId = user.id;
    const group = await prisma.group.create({ data: { name: "History test", members: { create: [
      { userId, displayName: user.name, email: user.email, role: "OWNER", status: "ACTIVE" },
      { displayName: "Pending", email: `pending-${suffix}@example.com`, status: "INVITED" },
      { displayName: "Former", email: `former-${suffix}@example.com`, status: "REMOVED" }
    ] } }, include: { members: true } });
    groupId = group.id;
    memberIds = [group.members.find((member) => member.userId === userId)!.id,
      group.members.find((member) => member.status === "INVITED")!.id,
      group.members.find((member) => member.status === "REMOVED")!.id];
    const expenses = Array.from({ length: 61 }, (_, index) => ({
      id: `history-${suffix}-${String(index).padStart(3, "0")}`,
      groupId, createdByMemberId: memberIds[0]!, paidByMemberId: memberIds[0]!,
      description: `History item ${index}`, notes: index === 0 ? "Hidden needle" : null,
      totalMinor: 100, splitType: "EXACT" as const, expenseDate: new Date("2026-01-01"),
      createdAt: new Date("2026-01-01"), idempotencyKey: `history-${index}`,
      deletedAt: index === 60 ? new Date() : null
    }));
    await prisma.expense.createMany({ data: expenses });
    await prisma.expenseShare.createMany({ data: expenses.flatMap((expense) => memberIds.map((memberId, index) => ({
      expenseId: expense.id, memberId, shareMinor: index === 0 ? 50 : 25
    }))) });
    const payment = await prisma.settlement.create({ data: {
      groupId, createdByMemberId: memberIds[0]!, fromMemberId: memberIds[1]!, toMemberId: memberIds[0]!,
      amountMinor: 100, settledAt: new Date("2026-01-02"), idempotencyKey: "history-payment"
    } });
    paymentId = payment.id;
    await prisma.settlement.create({ data: {
      groupId, createdByMemberId: memberIds[0]!, fromMemberId: memberIds[1]!, toMemberId: memberIds[0]!,
      amountMinor: 999, settledAt: new Date("2026-01-02"), idempotencyKey: "deleted-payment", deletedAt: new Date()
    } });
  });

  afterAll(async () => {
    await prisma.expenseShare.deleteMany({ where: { expense: { groupId } } });
    await prisma.settlement.deleteMany({ where: { groupId } });
    await prisma.expense.deleteMany({ where: { groupId } });
    await prisma.groupMember.deleteMany({ where: { groupId } });
    await prisma.group.deleteMany({ where: { id: groupId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("matches the reference ledger calculation, including removed members and partial payments", async () => {
    const [members, expenses, settlements] = await Promise.all([
      prisma.groupMember.findMany({ where: { groupId } }),
      prisma.expense.findMany({ where: { groupId, deletedAt: null }, include: { shares: true } }),
      prisma.settlement.findMany({ where: { groupId, deletedAt: null } })
    ]);
    const expected = computeGroupBalances({ members: members.map((member) => ({ id: member.id, name: member.displayName })), expenses, settlements });
    const actual = await loadGroupFinance(prisma, groupId);
    expect(actual).toEqual(expected);
    expect(actual.balances.find((member) => member.memberId === memberIds[0])?.netMinor).toBe(2900);
    const withoutPayment = await loadGroupFinance(prisma, groupId, { excludeSettlementId: paymentId });
    expect(withoutPayment.balances.find((member) => member.memberId === memberIds[0])?.netMinor).toBe(3000);
  });

  it("loads 25 records per page without changing balances or recent expenses", async () => {
    const first = await getGroupPageData(groupId, userId);
    const second = await getGroupPageData(groupId, userId, parseHistoryQuery({ page: "2", tab: "expenses" }));
    expect(first!.group.expenses).toHaveLength(25);
    expect(second!.group.expenses).toHaveLength(25);
    expect(first!.history.expensePage.total).toBe(60);
    expect(second!.balances).toEqual(first!.balances);
    expect(second!.recentExpenses).toEqual(first!.recentExpenses);
    const firstIds = new Set(first!.group.expenses.map((expense) => expense.id));
    expect(second!.group.expenses.some((expense) => firstIds.has(expense.id))).toBe(false);
  });

  it("searches the full history and keeps overview/balances independent of filters", async () => {
    const data = await getGroupPageData(groupId, userId, parseHistoryQuery({ q: "needle", page: "999" }));
    expect(data!.group.expenses).toHaveLength(1);
    expect(data!.group.expenses[0]!.description).toBe("History item 0");
    expect(data!.history.expensePage.page).toBe(1);
    expect(data!.recentExpenses[0]!.description).toBe("History item 59");
    expect(data!.balances.find((member) => member.memberId === memberIds[0])?.netMinor).toBe(2900);
  });

  it("returns only summaries to the dashboard and refuses another user's group history", async () => {
    const dashboard = await getDashboardData(userId);
    expect(dashboard[0]!.balance?.netMinor).toBe(2900);
    expect(dashboard[0]!.group._count.members).toBe(2);
    expect(dashboard[0]!.group).not.toHaveProperty("expenses");
    expect(dashboard[0]!.group).not.toHaveProperty("settlements");
    expect(await getGroupPageData(groupId, "not-a-member")).toBeNull();
  });
});
