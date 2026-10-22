import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const GUEST_COOKIE_NAME = "splittogether-guest";
export const GUEST_SESSION_MAX_AGE = 60 * 60 * 24 * 365;
export function guestSessionExpiry() {
  return new Date(Date.now() + GUEST_SESSION_MAX_AGE * 1000);
}
export function credentialHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function newGuestCredential(): string {
  return randomBytes(32).toString("base64url");
}
export async function getGuestSession() {
  const token = (await cookies()).get(GUEST_COOKIE_NAME)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return prisma.guestSession.findFirst({
    where: { tokenHash: credentialHash(token), expiresAt: { gt: new Date() } },
    include: { members: { where: { status: "ACTIVE", userId: null }, orderBy: { joinedAt: "asc" }, take: 1 } }
  });
}
export async function setGuestCookie(token: string) {
  (await cookies()).set(GUEST_COOKIE_NAME, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: GUEST_SESSION_MAX_AGE
  });
}
export async function clearGuestCookie() {
  (await cookies()).delete(GUEST_COOKIE_NAME);
}

export async function getGuestRecoveryPreview(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return prisma.groupMember.findFirst({
    where: { guestRecoveryTokenHash: credentialHash(token), userId: null, status: "ACTIVE", guestRecoveryExpiresAt: { gt: new Date() } },
    select: { displayName: true }
  });
}
