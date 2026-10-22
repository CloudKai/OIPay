import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { HISTORY_PAGE_SIZE, pageInfo, parseHistoryQuery, type HistoryQuery } from "@/lib/history-query";
import { principalMembershipWhere } from "@/lib/member-identity";
import { prisma } from "@/lib/prisma";
import { loadGroupFinance, loadMemberTotals } from "@/lib/server/finance";

export function expenseHistoryWhere(groupId: string, filters: HistoryQuery["filters"]): Prisma.ExpenseWhereInput {
  return {
    groupId,
    deletedAt: null,
    ...(filters.category !== "ALL" ? { category: filters.category } : {}),
    ...(filters.search ? { OR: [
      { description: { contains: filters.search, mode: "insensitive" as const } },
      { notes: { contains: filters.search, mode: "insensitive" as const } }
    ] } : {}),
    ...(filters.memberId !== "ALL" ? { AND: [{ OR: [
      { paidByMemberId: filters.memberId },
      { shares: { some: { memberId: filters.memberId } } }
    ] }] } : {}),
    ...(filters.dateFrom || filters.dateTo ? { expenseDate: {
      ...(filters.dateFrom ? { gte: new Date(`${filters.dateFrom}T00:00:00Z`) } : {}),
      ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T00:00:00Z`) } : {})
    } } : {})
  };
}

export async function getGroupPageData(groupId: string, userId: string, query = parseHistoryQuery({})) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.groupMember.findFirst({
      where: { groupId, ...principalMembershipWhere(userId), status: "ACTIVE" },
      include: { group: { include: {
        members: { orderBy: [{ status: "asc" }, { joinedAt: "asc" }] },
        _count: { select: { expenses: true, settlements: true } }
      } } }
    });
    if (!membership) return null;

    const where = expenseHistoryWhere(groupId, query.filters);
    const [expenseCount, paymentCount, activityCount, finance] = await Promise.all([
      tx.expense.count({ where }),
      tx.settlement.count({ where: { groupId, deletedAt: null } }),
      tx.activityLog.count({ where: { groupId } }),
      loadGroupFinance(tx, groupId)
    ]);
    const expensePage = pageInfo(query.page, expenseCount);
    const paymentPage = pageInfo(query.paymentsPage, paymentCount);
    const activityPage = pageInfo(query.activityPage, activityCount);
    const expenseOrder = [{ expenseDate: "desc" }, { createdAt: "desc" }, { id: "desc" }] satisfies Prisma.ExpenseOrderByWithRelationInput[];
    const [expenses, recentExpenses, settlements, activities] = await Promise.all([
      tx.expense.findMany({ where, include: { shares: true }, orderBy: expenseOrder,
        take: HISTORY_PAGE_SIZE, skip: (expensePage.page - 1) * HISTORY_PAGE_SIZE }),
      tx.expense.findMany({ where: { groupId, deletedAt: null }, include: { shares: true },
        orderBy: expenseOrder, take: 5 }),
      tx.settlement.findMany({ where: { groupId, deletedAt: null },
        orderBy: [{ settledAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: HISTORY_PAGE_SIZE, skip: (paymentPage.page - 1) * HISTORY_PAGE_SIZE }),
      tx.activityLog.findMany({ where: { groupId },
        include: { actorMember: { select: { displayName: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: HISTORY_PAGE_SIZE, skip: (activityPage.page - 1) * HISTORY_PAGE_SIZE })
    ]);
    return {
      membership,
      group: { ...membership.group, expenses, settlements, activities },
      recentExpenses,
      history: { ...query, expensePage, paymentPage, activityPage },
      ...finance
    };
  }, { isolationLevel: "RepeatableRead" });
}

export async function getDashboardData(userId: string) {
  return prisma.$transaction(async (tx) => {
    const memberships = await tx.groupMember.findMany({
      where: { ...principalMembershipWhere(userId), status: "ACTIVE" },
      include: { group: { include: {
        _count: { select: { members: { where: { status: { not: "REMOVED" } } } } },
        activities: {
          select: { id: true, message: true, createdAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 6
        }
      } } },
      orderBy: { joinedAt: "desc" }
    });
    const totals = await loadMemberTotals(tx, memberships.map((item) => item.groupId), memberships.map((item) => item.id));
    return memberships.map((membership) => ({
      membership,
      group: membership.group,
      balance: totals.get(membership.id) ?? null
    }));
  }, { isolationLevel: "RepeatableRead" });
}

export async function getInvitationPreview(token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  const invitation = await prisma.groupMember.findUnique({
    where: { invitationTokenHash: hash },
    select: {
      displayName: true,
      email: true,
      status: true,
      invitationExpiresAt: true,
      group: { select: { id: true, name: true, currency: true } }
    }
  });
  if (!invitation) return null;
  return {
    ...invitation,
    expired:
      invitation.status !== "INVITED" ||
      !invitation.invitationExpiresAt ||
      invitation.invitationExpiresAt.getTime() <= Date.now()
  };
}
