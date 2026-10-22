-- Guest credentials are available only to trusted server-side code.
ALTER TABLE "GuestSession" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "GuestSession" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "GuestSession" FROM authenticated;
  END IF;
END
$$;

CREATE UNIQUE INDEX "GroupMember_groupId_guestSessionId_key"
  ON "GroupMember"("groupId", "guestSessionId");

-- Preserve member IDs and financial references. Disambiguate pre-existing
-- duplicate labels once, before new memberships enforce unique names.
DO $$
DECLARE
  member RECORD;
  name_key TEXT;
  member_label TEXT;
BEGIN
  FOR member IN
    SELECT "id", "groupId", "displayName" FROM "GroupMember"
    WHERE "status" <> 'REMOVED'
    ORDER BY "joinedAt", "id"
  LOOP
    member_label := regexp_replace(trim(normalize(member."displayName", NFKC)), '\s+', ' ', 'g');
    name_key := lower(member_label);
    IF EXISTS (SELECT 1 FROM "GroupMember"
      WHERE "groupId" = member."groupId" AND "displayNameKey" = name_key AND "id" <> member."id") THEN
      member_label := left(member_label, 30) || ' ' || member."id";
      name_key := lower(member_label);
    END IF;
    UPDATE "GroupMember" SET "displayName" = member_label, "displayNameKey" = name_key
      WHERE "id" = member."id";
  END LOOP;
END
$$;
