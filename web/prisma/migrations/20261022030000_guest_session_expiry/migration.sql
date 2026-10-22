ALTER TABLE "GuestSession"
  ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '365 days');
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");
