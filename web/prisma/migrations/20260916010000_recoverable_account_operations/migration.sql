CREATE TYPE "InvitationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DISABLED');
ALTER TABLE "GroupMember" ADD COLUMN "invitationDeliveryStatus" "InvitationDeliveryStatus";

CREATE TABLE "AccountDeletionJob" (
  "authUserId" UUID NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountDeletionJob_pkey" PRIMARY KEY ("authUserId"),
  CONSTRAINT "AccountDeletionJob_attempts_nonnegative" CHECK ("attempts" >= 0)
);
CREATE INDEX "AccountDeletionJob_completedAt_nextAttemptAt_idx"
  ON "AccountDeletionJob"("completedAt", "nextAttemptAt");

ALTER TABLE "AccountDeletionJob" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "AccountDeletionJob" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "AccountDeletionJob" FROM authenticated;
  END IF;
END
$$;
