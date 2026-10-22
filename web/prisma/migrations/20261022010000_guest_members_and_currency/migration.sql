-- Additive changes: existing financial amounts remain in each group's currency.
ALTER TABLE "Group"
  ADD COLUMN "joinTokenHash" TEXT,
  ADD COLUMN "joinEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Group_joinTokenHash_key" ON "Group"("joinTokenHash");

CREATE TABLE "GuestSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");

ALTER TABLE "GroupMember"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "displayNameKey" TEXT,
  ADD COLUMN "guestSessionId" TEXT,
  ADD COLUMN "guestRecoveryTokenHash" TEXT,
  ADD COLUMN "guestRecoveryExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "GroupMember_groupId_displayNameKey_key"
  ON "GroupMember"("groupId", "displayNameKey");
CREATE UNIQUE INDEX "GroupMember_guestRecoveryTokenHash_key"
  ON "GroupMember"("guestRecoveryTokenHash");
CREATE INDEX "GroupMember_guestSessionId_idx" ON "GroupMember"("guestSessionId");
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_guestSessionId_fkey"
  FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD COLUMN "originalCurrency" VARCHAR(3),
  ADD COLUMN "originalMinor" INTEGER,
  ADD COLUMN "exchangeRate" VARCHAR(40),
  ADD COLUMN "exchangeRateDate" DATE,
  ADD COLUMN "exchangeRateSource" VARCHAR(80);
ALTER TABLE "Settlement"
  ADD COLUMN "originalCurrency" VARCHAR(3),
  ADD COLUMN "originalMinor" INTEGER,
  ADD COLUMN "exchangeRate" VARCHAR(40),
  ADD COLUMN "exchangeRateDate" DATE,
  ADD COLUMN "exchangeRateSource" VARCHAR(80);

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_conversion_complete" CHECK (
  ("originalCurrency" IS NULL AND "originalMinor" IS NULL AND "exchangeRate" IS NULL
    AND "exchangeRateDate" IS NULL AND "exchangeRateSource" IS NULL)
  OR ("originalCurrency" IS NOT NULL AND "originalCurrency" ~ '^[A-Z]{3}$'
    AND "originalMinor" IS NOT NULL AND "originalMinor" > 0
    AND "exchangeRate" IS NOT NULL AND "exchangeRate" ~ '^[0-9]+([.][0-9]+)?$'
    AND "exchangeRate"::numeric > 0
    AND "exchangeRateDate" IS NOT NULL AND "exchangeRateSource" IS NOT NULL)
);
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_conversion_complete" CHECK (
  ("originalCurrency" IS NULL AND "originalMinor" IS NULL AND "exchangeRate" IS NULL
    AND "exchangeRateDate" IS NULL AND "exchangeRateSource" IS NULL)
  OR ("originalCurrency" IS NOT NULL AND "originalCurrency" ~ '^[A-Z]{3}$'
    AND "originalMinor" IS NOT NULL AND "originalMinor" > 0
    AND "exchangeRate" IS NOT NULL AND "exchangeRate" ~ '^[0-9]+([.][0-9]+)?$'
    AND "exchangeRate"::numeric > 0
    AND "exchangeRateDate" IS NOT NULL AND "exchangeRateSource" IS NOT NULL)
);
