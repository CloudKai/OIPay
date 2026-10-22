import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { prisma } from "../../lib/prisma";
import { assertLocalE2eServices } from "./environment";

export default async function globalSetup() {
  if (process.env.E2E_LOCAL_SERVICES !== "true") {
    if (process.env.E2E_REQUIRE_AUTH === "true" && (!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD)) {
      throw new Error("Authenticated browser tests are required. Configure credentials or isolated local Supabase services.");
    }
    return;
  }
  assertLocalE2eServices(process.env);
  const suiteStartedAt = new Date();
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Local Supabase admin credentials are required for browser tests.");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const email = `e2e-${randomUUID()}@example.com`;
  const password = `Test-${randomUUID()}!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: "Browser Test" }
  });
  if (error || !data.user) throw new Error("Could not create the isolated browser-test user.");
  process.env.E2E_USER_EMAIL = email;
  process.env.E2E_USER_PASSWORD = password;
  const authUserId = data.user.id;
  const guestEmail = `e2e-guest-${randomUUID()}@example.com`;
  const guestPassword = `Test-${randomUUID()}!`;
  const linkedGuest = await admin.auth.admin.createUser({
    email: guestEmail, password: guestPassword, email_confirm: true,
    user_metadata: { full_name: "Linked Browser Guest" }
  });
  if (linkedGuest.error || !linkedGuest.data.user) {
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error("Could not create the isolated guest-linking test user.");
  }
  const guestAuthUserId = linkedGuest.data.user.id;
  process.env.E2E_GUEST_EMAIL = guestEmail;
  process.env.E2E_GUEST_PASSWORD = guestPassword;

  return async () => {
    try {
      const user = await prisma.user.findUnique({ where: { authUserId } });
      if (user) {
        const groups = await prisma.groupMember.findMany({
          where: { userId: user.id, role: "OWNER" }, select: { groupId: true }
        });
        const groupId = { in: groups.map((group) => group.groupId) };
        const guestMemberships = await prisma.groupMember.findMany({
          where: { groupId, guestSessionId: { not: null } },
          select: { guestSessionId: true }
        });
        await prisma.$transaction(async (tx) => {
          await tx.expenseShare.deleteMany({ where: { expense: { groupId } } });
          await tx.activityLog.deleteMany({ where: { groupId } });
          await tx.settlement.deleteMany({ where: { groupId } });
          await tx.expense.deleteMany({ where: { groupId } });
          await tx.groupMember.deleteMany({ where: { groupId } });
          await tx.guestSession.deleteMany({ where: {
            OR: [
              { id: { in: guestMemberships.flatMap((member) => member.guestSessionId ? [member.guestSessionId] : []) } },
              // Recovery intentionally leaves the previous browser credential without a membership.
              { createdAt: { gte: suiteStartedAt } }
            ],
            members: { none: {} }
          } });
          await tx.group.deleteMany({ where: { id: groupId } });
          await tx.user.delete({ where: { id: user.id } });
        });
      }
      await prisma.user.deleteMany({ where: { authUserId: guestAuthUserId } });
    } finally {
      await admin.auth.admin.deleteUser(authUserId);
      await admin.auth.admin.deleteUser(guestAuthUserId);
      await prisma.$disconnect();
    }
  };
}
