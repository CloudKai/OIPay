ALTER TABLE "User"
  ADD COLUMN "authUserId" UUID;

CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

DROP TABLE IF EXISTS "RateLimit";
DROP TABLE IF EXISTS "Verification";
DROP TABLE IF EXISTS "Account";
DROP TABLE IF EXISTS "Session";

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseShare" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Settlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE
      "User",
      "Group",
      "GroupMember",
      "Expense",
      "ExpenseShare",
      "Settlement",
      "ActivityLog"
    FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE
      "User",
      "Group",
      "GroupMember",
      "Expense",
      "ExpenseShare",
      "Settlement",
      "ActivityLog"
    FROM authenticated;
  END IF;
END
$$;
