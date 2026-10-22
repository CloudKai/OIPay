import "dotenv/config";

import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";

import { prisma } from "../lib/prisma";
import { getSiteUrl } from "../lib/site-url";
import {
  getSupabasePublicConfig,
  getSupabaseSecretKey
} from "../lib/supabase/config";

async function listAuthUsers(): Promise<Map<string, SupabaseUser>> {
  const { url } = getSupabasePublicConfig();
  const admin = createClient(url, getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const usersByEmail = new Map<string, SupabaseUser>();

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000
    });
    if (error) throw error;

    data.users.forEach((user) => {
      if (user.email) usersByEmail.set(user.email.toLowerCase(), user);
    });
    if (data.users.length < 1000) break;
  }

  return usersByEmail;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    throw new Error(
      "This command emails existing users. Re-run with --confirm after reviewing docs/supabase-setup.md."
    );
  }

  const { url } = getSupabasePublicConfig();
  const admin = createClient(url, getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const authUsers = await listAuthUsers();
  const appUsers = await prisma.user.findMany({
    where: { authUserId: null },
    select: { id: true, email: true, name: true }
  });

  let linked = 0;
  let invited = 0;

  for (const appUser of appUsers) {
    const email = appUser.email.toLowerCase();
    let authUser = authUsers.get(email);

    if (!authUser) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: appUser.name,
          name: appUser.name
        },
        redirectTo: `${getSiteUrl()}/reset-password`
      });
      if (error) {
        console.error(`Could not invite ${email}: ${error.message}`);
        continue;
      }
      authUser = data.user;
      invited += 1;
    } else {
      linked += 1;
    }

    await prisma.user.update({
      where: { id: appUser.id },
      data: { authUserId: authUser.id }
    });
  }

  console.log(
    `Auth migration complete: ${linked} existing identities linked, ${invited} invitations sent.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
