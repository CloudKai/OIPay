ALTER TYPE "SplitType" ADD VALUE IF NOT EXISTS 'PERCENTAGE';
ALTER TYPE "SplitType" ADD VALUE IF NOT EXISTS 'SHARES';

ALTER TYPE "ActivityType" RENAME VALUE 'MEMBER_ADDED' TO 'MEMBER_JOINED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GROUP_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GROUP_ARCHIVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MEMBER_INVITED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MEMBER_INVITATION_REVOKED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MEMBER_REMOVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'OWNER_TRANSFERRED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'EXPENSE_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'EXPENSE_DELETED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SETTLEMENT_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SETTLEMENT_DELETED';

CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'REMOVED');
CREATE TYPE "ExpenseCategory" AS ENUM (
  'GENERAL', 'FOOD', 'TRANSPORT', 'HOUSING', 'ENTERTAINMENT',
  'SHOPPING', 'UTILITIES', 'HEALTH', 'OTHER'
);
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'OTHER');

ALTER TABLE "User"
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "image" TEXT;
UPDATE "User" SET "emailVerified" = true;

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "idToken" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Verification" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Account" (
  "id", "userId", "accountId", "providerId", "password", "createdAt", "updatedAt"
)
SELECT
  'legacy_' || "id", "id", "id", 'credential', "passwordHash", "createdAt", "updatedAt"
FROM "User";
ALTER TABLE "User" DROP COLUMN "passwordHash";

ALTER TABLE "Group"
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "GroupMember"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "invitationTokenHash" TEXT,
  ADD COLUMN "invitationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "invitationSentAt" TIMESTAMP(3),
  ADD COLUMN "invitationAcceptedAt" TIMESTAMP(3);

UPDATE "GroupMember" AS gm
SET
  "displayName" = u."name",
  "email" = lower(u."email"),
  "invitationAcceptedAt" = gm."joinedAt"
FROM "User" AS u
WHERE gm."userId" = u."id";

ALTER TABLE "GroupMember"
  ALTER COLUMN "displayName" SET NOT NULL,
  ALTER COLUMN "email" SET NOT NULL,
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Expense" RENAME COLUMN "totalCents" TO "totalMinor";
ALTER TABLE "Expense"
  ADD COLUMN "category" "ExpenseCategory" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Expense" SET "idempotencyKey" = 'legacy_' || "id";
ALTER TABLE "Expense" ALTER COLUMN "idempotencyKey" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "expenseDate" TYPE DATE USING "expenseDate"::date;

ALTER TABLE "ExpenseShare" RENAME COLUMN "shareCents" TO "shareMinor";
ALTER TABLE "ExpenseShare"
  ADD COLUMN "percentageBps" INTEGER,
  ADD COLUMN "weight" INTEGER;

ALTER TABLE "Settlement" RENAME COLUMN "amountCents" TO "amountMinor";
ALTER TABLE "Settlement"
  ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Settlement" SET "idempotencyKey" = 'legacy_' || "id";
ALTER TABLE "Settlement" ALTER COLUMN "idempotencyKey" SET NOT NULL;
ALTER TABLE "Settlement" ALTER COLUMN "settledAt" TYPE DATE USING "settledAt"::date;

CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");
CREATE INDEX "Group_archivedAt_idx" ON "Group"("archivedAt");
CREATE UNIQUE INDEX "GroupMember_groupId_email_key" ON "GroupMember"("groupId", "email");
CREATE UNIQUE INDEX "GroupMember_invitationTokenHash_key" ON "GroupMember"("invitationTokenHash");
CREATE INDEX "GroupMember_groupId_status_idx" ON "GroupMember"("groupId", "status");
CREATE INDEX "GroupMember_email_idx" ON "GroupMember"("email");
CREATE UNIQUE INDEX "Expense_groupId_idempotencyKey_key" ON "Expense"("groupId", "idempotencyKey");
CREATE INDEX "Expense_deletedAt_idx" ON "Expense"("deletedAt");
CREATE UNIQUE INDEX "Settlement_groupId_idempotencyKey_key" ON "Settlement"("groupId", "idempotencyKey");
CREATE INDEX "Settlement_deletedAt_idx" ON "Settlement"("deletedAt");

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Account"
  ADD CONSTRAINT "Account_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_userId_fkey";
ALTER TABLE "GroupMember"
  ADD CONSTRAINT "GroupMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_totalMinor_positive" CHECK ("totalMinor" > 0),
  ADD CONSTRAINT "Expense_version_positive" CHECK ("version" > 0);
ALTER TABLE "ExpenseShare"
  ADD CONSTRAINT "ExpenseShare_shareMinor_nonnegative" CHECK ("shareMinor" >= 0),
  ADD CONSTRAINT "ExpenseShare_percentageBps_range"
    CHECK ("percentageBps" IS NULL OR ("percentageBps" > 0 AND "percentageBps" <= 10000)),
  ADD CONSTRAINT "ExpenseShare_weight_positive"
    CHECK ("weight" IS NULL OR "weight" > 0);
ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_amountMinor_positive" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "Settlement_version_positive" CHECK ("version" > 0),
  ADD CONSTRAINT "Settlement_different_members" CHECK ("fromMemberId" <> "toMemberId");
