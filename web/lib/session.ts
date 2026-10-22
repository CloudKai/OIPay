import "server-only";

import { Prisma, type User as PrismaUser } from "@/generated/prisma/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getGuestSession } from "@/lib/guest-session";
import type { PublicAuthUser } from "@/lib/auth/types";
import {
  errorLogRecords,
  isDatabaseConnectionError
} from "@/lib/error-reporting";
import { prisma } from "@/lib/prisma";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PublicSessionUser = PublicAuthUser;

export function toPublicSessionUser(
  user: Pick<PrismaUser, "id" | "name" | "email" | "emailVerified" | "image">
): PublicAuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image
  };
}

function stringMetadata(
  metadata: Record<string, unknown>,
  key: string
): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function authDisplayName(user: SupabaseUser): string {
  return (
    stringMetadata(user.user_metadata, "full_name") ??
    stringMetadata(user.user_metadata, "name") ??
    user.email?.split("@")[0] ??
    "SplitTogether member"
  );
}

function authAvatarUrl(user: SupabaseUser): string | null {
  return (
    stringMetadata(user.user_metadata, "avatar_url") ??
    stringMetadata(user.user_metadata, "picture")
  );
}

export class AccountDeletionRequested extends Error {
  constructor() {
    super("This account has been deleted or is being deleted.");
  }
}

export class AppUserSynchronizer {
  async synchronize(authUser: SupabaseUser) {
    const email = authUser.email?.trim().toLowerCase();
    if (!email) {
      throw new Error("The authenticated Supabase user has no email address.");
    }

    try {
      return await this.synchronizeOnce(authUser, email);
    } catch (error) {
      if (error instanceof AccountDeletionRequested) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await prisma.user.findUnique({
          where: { authUserId: authUser.id }
        });
        if (existing) return existing;
      }

      console.error("[auth:user-sync] failed", {
        errors: errorLogRecords(error)
      });
      if (isDatabaseConnectionError(error)) {
        throw new Error(
          "SplitTogether could not connect to its application database. Please try again shortly.",
          { cause: error }
        );
      }
      throw error;
    }
  }

  private async synchronizeOnce(authUser: SupabaseUser, email: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${authUser.id}))`;
      const deletion = await tx.accountDeletionJob.findUnique({
        where: { authUserId: authUser.id }
      });
      if (deletion) throw new AccountDeletionRequested();
      let appUser = await tx.user.findUnique({
        where: { authUserId: authUser.id }
      });

      if (!appUser) {
        const existingByEmail = await tx.user.findUnique({ where: { email } });
        if (
          existingByEmail?.authUserId &&
          existingByEmail.authUserId !== authUser.id
        ) {
          throw new Error(
            "This email is already linked to another Supabase identity."
          );
        }

        appUser = existingByEmail
          ? await tx.user.update({
              where: { id: existingByEmail.id },
              data: { authUserId: authUser.id }
            })
          : await tx.user.create({
              data: {
                authUserId: authUser.id,
                email,
                name: authDisplayName(authUser),
                emailVerified: Boolean(authUser.email_confirmed_at),
                image: authAvatarUrl(authUser)
              }
            });
      }

      const name = authDisplayName(authUser) || appUser.name;
      const image = authAvatarUrl(authUser);
      const emailVerified = Boolean(authUser.email_confirmed_at);
      const profileChanged =
        appUser.email !== email ||
        appUser.name !== name ||
        appUser.image !== image ||
        appUser.emailVerified !== emailVerified;

      if (profileChanged) {
        appUser = await tx.user.update({
          where: { id: appUser.id },
          data: { email, name, image, emailVerified }
        });
        await tx.groupMember.updateMany({
          where: { userId: appUser.id, status: "ACTIVE" },
          data: { email }
        });
      }

      await tx.groupMember.updateMany({
        where: {
          email,
          status: "INVITED",
          userId: null
        },
        data: { userId: appUser.id }
      });

      return appUser;
    });
  }
}

export const appUserSynchronizer = new AppUserSynchronizer();

export async function getAuthenticatedUser() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  return error ? null : user;
}

export async function getAuthContext() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return null;

  try {
    const user = await appUserSynchronizer.synchronize(authUser);
    return { authUser, user };
  } catch (error) {
    if (error instanceof AccountDeletionRequested) return null;
    throw error;
  }
}

export async function getSessionUser() {
  const context = await getAuthContext();
  return context?.user ?? null;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAuthContext() {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  return context;
}

// Guest access is a separate identity. Account APIs continue to require a real user.
export async function getSessionPrincipal() {
  const user = await getSessionUser();
  if (user) return { ...user, isGuest: false as const };
  const guest = await getGuestSession();
  if (!guest?.members.length) return null;
  return {
    id: `guest:${guest.id}`, name: guest.members[0]!.displayName,
    email: null, emailVerified: false, image: null, isGuest: true as const
  };
}

export async function requireSessionPrincipal() {
  const principal = await getSessionPrincipal();
  if (!principal) redirect("/login");
  return principal;
}
