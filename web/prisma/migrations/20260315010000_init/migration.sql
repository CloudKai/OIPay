-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('EQUAL', 'EXACT');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('GROUP_CREATED', 'MEMBER_ADDED', 'EXPENSE_CREATED', 'SETTLEMENT_CREATED');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "createdByMemberId" TEXT NOT NULL,
  "paidByMemberId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "splitType" "SplitType" NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseShare" (
  "id" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "shareCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpenseShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "createdByMemberId" TEXT NOT NULL,
  "fromMemberId" TEXT NOT NULL,
  "toMemberId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "settledAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "actorMemberId" TEXT NOT NULL,
  "type" "ActivityType" NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");
CREATE INDEX "Expense_groupId_expenseDate_idx" ON "Expense"("groupId", "expenseDate");
CREATE INDEX "Expense_paidByMemberId_idx" ON "Expense"("paidByMemberId");
CREATE UNIQUE INDEX "ExpenseShare_expenseId_memberId_key" ON "ExpenseShare"("expenseId", "memberId");
CREATE INDEX "ExpenseShare_memberId_idx" ON "ExpenseShare"("memberId");
CREATE INDEX "Settlement_groupId_settledAt_idx" ON "Settlement"("groupId", "settledAt");
CREATE INDEX "Settlement_fromMemberId_idx" ON "Settlement"("fromMemberId");
CREATE INDEX "Settlement_toMemberId_idx" ON "Settlement"("toMemberId");
CREATE INDEX "ActivityLog_groupId_createdAt_idx" ON "ActivityLog"("groupId", "createdAt");
CREATE INDEX "ActivityLog_actorMemberId_idx" ON "ActivityLog"("actorMemberId");

-- AddForeignKey
ALTER TABLE "GroupMember"
  ADD CONSTRAINT "GroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMember"
  ADD CONSTRAINT "GroupMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_createdByMemberId_fkey"
  FOREIGN KEY ("createdByMemberId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_paidByMemberId_fkey"
  FOREIGN KEY ("paidByMemberId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExpenseShare"
  ADD CONSTRAINT "ExpenseShare_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseShare"
  ADD CONSTRAINT "ExpenseShare_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_createdByMemberId_fkey"
  FOREIGN KEY ("createdByMemberId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_fromMemberId_fkey"
  FOREIGN KEY ("fromMemberId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_toMemberId_fkey"
  FOREIGN KEY ("toMemberId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActivityLog"
  ADD CONSTRAINT "ActivityLog_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityLog"
  ADD CONSTRAINT "ActivityLog_actorMemberId_fkey"
  FOREIGN KEY ("actorMemberId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
