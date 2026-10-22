import bcrypt from "bcryptjs";
import { PrismaClient, ActivityType, GroupRole, SplitType } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertDemoUsers() {
  const demoPasswordHash = await bcrypt.hash("password123", 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "kai@example.com" },
      update: { name: "Kai", passwordHash: demoPasswordHash },
      create: { email: "kai@example.com", name: "Kai", passwordHash: demoPasswordHash }
    }),
    prisma.user.upsert({
      where: { email: "ben@example.com" },
      update: { name: "Ben", passwordHash: demoPasswordHash },
      create: { email: "ben@example.com", name: "Ben", passwordHash: demoPasswordHash }
    }),
    prisma.user.upsert({
      where: { email: "lina@example.com" },
      update: { name: "Lina", passwordHash: demoPasswordHash },
      create: { email: "lina@example.com", name: "Lina", passwordHash: demoPasswordHash }
    })
  ]);

  return { kai: users[0], ben: users[1], lina: users[2] };
}

async function ensureBaliTripGroup(kaiId: string, benId: string, linaId: string) {
  let group = await prisma.group.findFirst({ where: { name: "Bali Trip" } });

  if (!group) {
    group = await prisma.group.create({ data: { name: "Bali Trip" } });
  }

  const kaiMember = await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: kaiId } },
    update: { role: GroupRole.OWNER },
    create: { groupId: group.id, userId: kaiId, role: GroupRole.OWNER }
  });

  const benMember = await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: benId } },
    update: {},
    create: { groupId: group.id, userId: benId, role: GroupRole.MEMBER }
  });

  const linaMember = await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: linaId } },
    update: {},
    create: { groupId: group.id, userId: linaId, role: GroupRole.MEMBER }
  });

  const existingExpenseCount = await prisma.expense.count({ where: { groupId: group.id } });

  if (existingExpenseCount === 0) {
    const sampleExpense = await prisma.expense.create({
      data: {
        groupId: group.id,
        createdByMemberId: kaiMember.id,
        paidByMemberId: kaiMember.id,
        description: "Villa Deposit",
        totalCents: 90000,
        splitType: SplitType.EQUAL,
        expenseDate: new Date(),
        notes: "Paid upfront for everyone"
      }
    });

    await prisma.expenseShare.createMany({
      data: [
        { expenseId: sampleExpense.id, memberId: kaiMember.id, shareCents: 30000 },
        { expenseId: sampleExpense.id, memberId: benMember.id, shareCents: 30000 },
        { expenseId: sampleExpense.id, memberId: linaMember.id, shareCents: 30000 }
      ]
    });

    await prisma.activityLog.create({
      data: {
        groupId: group.id,
        actorMemberId: kaiMember.id,
        type: ActivityType.EXPENSE_CREATED,
        message: "Kai added an expense: Villa Deposit",
        metadata: { expenseId: sampleExpense.id, totalCents: 90000 }
      }
    });
  }

  const existingSettlementCount = await prisma.settlement.count({ where: { groupId: group.id } });

  if (existingSettlementCount === 0) {
    const settlement = await prisma.settlement.create({
      data: {
        groupId: group.id,
        createdByMemberId: benMember.id,
        fromMemberId: benMember.id,
        toMemberId: kaiMember.id,
        amountCents: 18000,
        settledAt: new Date(),
        notes: "Partial payback"
      }
    });

    await prisma.activityLog.create({
      data: {
        groupId: group.id,
        actorMemberId: benMember.id,
        type: ActivityType.SETTLEMENT_CREATED,
        message: "Ben recorded a settlement to Kai",
        metadata: { settlementId: settlement.id, amountCents: 18000 }
      }
    });
  }

  const existingGroupCreateActivity = await prisma.activityLog.findFirst({
    where: { groupId: group.id, type: ActivityType.GROUP_CREATED }
  });

  if (!existingGroupCreateActivity) {
    await prisma.activityLog.create({
      data: {
        groupId: group.id,
        actorMemberId: kaiMember.id,
        type: ActivityType.GROUP_CREATED,
        message: "Kai created the group Bali Trip"
      }
    });
  }

  return group;
}

async function main() {
  const { kai, ben, lina } = await upsertDemoUsers();
  await ensureBaliTripGroup(kai.id, ben.id, lina.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
