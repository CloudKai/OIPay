import { prisma } from "../lib/prisma";

async function upsertDemoUser(input: {
  email: string;
  name: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, emailVerified: true },
    create: {
      email: input.email,
      name: input.name,
      emailVerified: true
    }
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The development seed must not run in production.");
  }

  const [kai, ben, lina] = await Promise.all([
    upsertDemoUser({
      email: "kai@example.com",
      name: "Kai"
    }),
    upsertDemoUser({
      email: "ben@example.com",
      name: "Ben"
    }),
    upsertDemoUser({
      email: "lina@example.com",
      name: "Lina"
    })
  ]);

  let group = await prisma.group.findFirst({ where: { name: "Bali Trip" } });
  group ??= await prisma.group.create({
    data: { name: "Bali Trip", currency: "USD" }
  });
  const groupId = group.id;

  async function membership(user: typeof kai, role: "OWNER" | "MEMBER") {
    return prisma.groupMember.upsert({
      where: { groupId_email: { groupId, email: user.email } },
      update: {
        userId: user.id,
        displayName: user.name,
        status: "ACTIVE",
        role
      },
      create: {
        groupId,
        userId: user.id,
        displayName: user.name,
        email: user.email,
        status: "ACTIVE",
        role,
        invitationAcceptedAt: new Date()
      }
    });
  }

  const [kaiMember, benMember, linaMember] = await Promise.all([
    membership(kai, "OWNER"),
    membership(ben, "MEMBER"),
    membership(lina, "MEMBER")
  ]);

  if ((await prisma.expense.count({ where: { groupId } })) === 0) {
    const expense = await prisma.expense.create({
      data: {
        groupId,
        createdByMemberId: kaiMember.id,
        paidByMemberId: kaiMember.id,
        description: "Villa deposit",
        totalMinor: 90_000,
        splitType: "EQUAL",
        category: "HOUSING",
        expenseDate: new Date(),
        notes: "Paid upfront for everyone",
        idempotencyKey: "seed-villa-deposit"
      }
    });
    await prisma.expenseShare.createMany({
      data: [kaiMember, benMember, linaMember].map((member) => ({
        expenseId: expense.id,
        memberId: member.id,
        shareMinor: 30_000
      }))
    });
    await prisma.activityLog.create({
      data: {
        groupId,
        actorMemberId: kaiMember.id,
        type: "EXPENSE_CREATED",
        message: "Kai added Villa deposit",
        metadata: { expenseId: expense.id, totalMinor: expense.totalMinor }
      }
    });
  }

  if ((await prisma.activityLog.count({
    where: { groupId, type: "GROUP_CREATED" }
  })) === 0) {
    await prisma.activityLog.create({
      data: {
        groupId,
        actorMemberId: kaiMember.id,
        type: "GROUP_CREATED",
        message: "Kai created Bali Trip"
      }
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
