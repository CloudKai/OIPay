-- DropIndex
DROP INDEX "GroupMember_groupId_idx";

-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Settlement" ALTER COLUMN "updatedAt" DROP DEFAULT;
