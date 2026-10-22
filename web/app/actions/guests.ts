"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { credentialHash, guestSessionExpiry, getGuestSession, newGuestCredential, setGuestCookie, clearGuestCookie } from "@/lib/guest-session";
import { memberNameKey } from "@/lib/member-identity";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/result";
import { ActionFailure, publicActionError, requireAccountActionUser, requireActionUser, requireMembership, requireOwner, requireWritableGroup } from "@/lib/server/authz";
import { getSessionUser } from "@/lib/session";
import { getSiteUrl } from "@/lib/site-url";
import { groupIdSchema, memberMutationSchema } from "@/lib/validation";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const joinSchema = z.object({ token: tokenSchema, name: z.string().trim().min(1).max(60) });
function guestError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return publicActionError(new ActionFailure("That name or account is already in this group. Use a distinguishable name, such as Alex Tan."));
  }
  return publicActionError(error);
}

async function assertGuestCredential(tx: Prisma.TransactionClient, session: { id: string; tokenHash: string }) {
  await tx.$executeRaw`SELECT "id" FROM "GuestSession" WHERE "id" = ${session.id} FOR UPDATE`;
  const current = await tx.guestSession.findUnique({ where: { id: session.id } });
  if (!current || current.tokenHash !== session.tokenHash || current.expiresAt.getTime() <= Date.now()) {
    throw new ActionFailure("Your guest access was replaced or expired. Ask the group owner for a private recovery link.");
  }
}
async function assertCurrentOwner(tx: Prisma.TransactionClient, memberId: string, userId: string) {
  await tx.$executeRaw`SELECT "id" FROM "GroupMember" WHERE "id" = ${memberId} FOR UPDATE`;
  const current = await tx.groupMember.findFirst({ where: { id: memberId, userId, status: "ACTIVE", role: "OWNER" } });
  if (!current) throw new ActionFailure("Only a current group owner can do that. Refresh and try again.");
}

export async function manageJoinLinkAction(input: unknown): Promise<ActionResult<{ url: string | null }>> {
  try {
    const parsed = groupIdSchema.extend({ enabled: z.boolean() }).safeParse(input);
    if (!parsed.success) throw new ActionFailure("Choose a valid group.");
    const actor = await requireAccountActionUser();
    const owner = await requireMembership(parsed.data.groupId, actor.id);
    requireOwner(owner); requireWritableGroup(owner.group);
    const token = parsed.data.enabled ? newGuestCredential() : null;
    await prisma.$transaction(async (tx) => {
      await assertCurrentOwner(tx, owner.id, actor.id);
      await tx.group.update({ where: { id: owner.groupId }, data: { joinEnabled: Boolean(token), joinTokenHash: token ? credentialHash(token) : null } });
      await tx.activityLog.create({ data: { groupId: owner.groupId, actorMemberId: owner.id, type: "GROUP_UPDATED", message: `${actor.name} ${token ? "created a new" : "disabled the"} group joining link` } });
    });
    revalidatePath(`/groups/${owner.groupId}`);
    return { ok: true, data: { url: token ? new URL(`/join/${token}`, getSiteUrl()).toString() : null }, message: token ? "Link ready. Save it now; creating another link replaces this one." : "Joining link disabled." };
  } catch (error) { return guestError(error); }
}

export async function joinGroupAction(input: unknown): Promise<ActionResult<{ groupId: string }>> {
  try {
    const parsed = joinSchema.safeParse(input);
    if (!parsed.success) throw new ActionFailure("Enter your name using 1–60 characters.");
    const account = await getSessionUser();
    const guest = await getGuestSession();
    const token = !account && !guest ? newGuestCredential() : null;
    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({ where: { joinTokenHash: credentialHash(parsed.data.token) } });
      if (!group?.joinEnabled || group.archivedAt) throw new ActionFailure("This joining link was disabled or replaced. Ask the owner for a new link.");
      // Lock the group so joins, recoveries, and account linking cannot claim a name twice.
      await tx.$executeRaw`SELECT "id" FROM "Group" WHERE "id" = ${group.id} FOR UPDATE`;
      const fresh = await tx.group.findUnique({ where: { id: group.id } });
      if (!fresh?.joinEnabled || fresh.joinTokenHash !== credentialHash(parsed.data.token) || fresh.archivedAt) throw new ActionFailure("This joining link is no longer active.");
      if (guest && !account) await assertGuestCredential(tx, guest);
      const previous = await tx.groupMember.findFirst({ where: { groupId: group.id, status: "ACTIVE", ...(account ? { userId: account.id } : guest ? { guestSessionId: guest.id, userId: null } : { id: "__new_guest__" }) } });
      if (previous) return { groupId: group.id };
      const key = memberNameKey(parsed.data.name);
      const duplicate = await tx.groupMember.findFirst({ where: { groupId: group.id, displayNameKey: key } });
      if (duplicate) throw new ActionFailure("Someone already uses that name. Add a surname or initial, such as Alex Tan.");
      const session = !account ? guest ?? await tx.guestSession.create({ data: { tokenHash: credentialHash(token!), expiresAt: guestSessionExpiry() } }) : null;
      const member = await tx.groupMember.create({ data: {
        groupId: group.id, userId: account?.id ?? null, guestSessionId: session?.id ?? null,
        displayName: parsed.data.name, displayNameKey: key, email: account?.email ?? null,
        status: "ACTIVE", invitationAcceptedAt: new Date()
      } });
      await tx.activityLog.create({ data: { groupId: group.id, actorMemberId: member.id, type: "MEMBER_JOINED", message: `${member.displayName} joined ${group.name}` } });
      return { groupId: group.id };
    });
    if (token) await setGuestCookie(token);
    revalidatePath("/dashboard"); revalidatePath(`/groups/${result.groupId}`);
    return { ok: true, data: result, message: "You joined the group." };
  } catch (error) { return guestError(error); }
}

export async function issueGuestRecoveryAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  try {
    const parsed = memberMutationSchema.safeParse(input);
    if (!parsed.success) throw new ActionFailure("Choose a guest to recover.");
    const user = await requireAccountActionUser();
    const owner = await requireMembership(parsed.data.groupId, user.id);
    requireOwner(owner);
    const token = newGuestCredential();
    const updated = await prisma.$transaction(async (tx) => {
      await assertCurrentOwner(tx, owner.id, user.id);
      const target = await tx.groupMember.findFirst({ where: { id: parsed.data.memberId, groupId: owner.groupId, status: "ACTIVE", userId: null, guestSessionId: { not: null } } });
      if (!target) throw new ActionFailure("Only an active guest can receive a recovery link.");
      await tx.groupMember.update({ where: { id: target.id }, data: { guestRecoveryTokenHash: credentialHash(token), guestRecoveryExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
      await tx.activityLog.create({ data: { groupId: owner.groupId, actorMemberId: owner.id, type: "GROUP_UPDATED", message: `${user.name} issued a private recovery link for ${target.displayName}`, metadata: { memberId: target.id } } });
      return target;
    });
    revalidatePath(`/groups/${updated.groupId}`);
    return { ok: true, data: { url: new URL(`/recover-guest/${token}`, getSiteUrl()).toString() }, message: "Send this privately to the guest. It expires in 24 hours and works once." };
  } catch (error) { return guestError(error); }
}

export async function recoverGuestAction(input: unknown): Promise<ActionResult<{ groupId: string }>> {
  try {
    const parsed = z.object({ token: tokenSchema }).safeParse(input);
    if (!parsed.success) throw new ActionFailure("This recovery link is invalid.");
    const account = await getSessionUser();
    if (account) throw new ActionFailure("Sign out of your account before recovering guest access, or use a separate browser.");
    const existingSession = await getGuestSession();
    const token = newGuestCredential();
    const member = await prisma.$transaction(async (tx) => {
      if (existingSession) await assertGuestCredential(tx, existingSession);
      const hash = credentialHash(parsed.data.token);
      const target = await tx.groupMember.findUnique({ where: { guestRecoveryTokenHash: hash } });
      if (!target || target.userId || target.status !== "ACTIVE" || !target.guestRecoveryExpiresAt || target.guestRecoveryExpiresAt.getTime() <= Date.now()) throw new ActionFailure("This recovery link expired or was already used. Ask the owner for another.");
      const session = existingSession
        ? await tx.guestSession.update({ where: { id: existingSession.id }, data: { tokenHash: credentialHash(token), expiresAt: guestSessionExpiry() } })
        : await tx.guestSession.create({ data: { tokenHash: credentialHash(token), expiresAt: guestSessionExpiry() } });
      const existing = await tx.groupMember.findFirst({ where: { groupId: target.groupId, guestSessionId: session.id, status: "ACTIVE", id: { not: target.id } } });
      if (existing) throw new ActionFailure("This browser already belongs to another member in this group. Use a separate browser to recover this guest.");
      const claimed = await tx.groupMember.updateMany({ where: { id: target.id, userId: null, status: "ACTIVE", guestRecoveryTokenHash: hash, guestRecoveryExpiresAt: { gt: new Date() } }, data: { guestSessionId: session.id, guestRecoveryTokenHash: null, guestRecoveryExpiresAt: null } });
      if (claimed.count !== 1) throw new ActionFailure("This recovery link was already used or replaced.");
      await tx.activityLog.create({ data: { groupId: target.groupId, actorMemberId: target.id, type: "MEMBER_JOINED", message: `${target.displayName} recovered guest access` } });
      return target;
    });
    await setGuestCookie(token);
    revalidatePath(`/groups/${member.groupId}`);
    return { ok: true, data: { groupId: member.groupId }, message: "Guest access recovered. Previous browser access has been replaced." };
  } catch (error) { return guestError(error); }
}

export async function linkGuestAccountAction(): Promise<ActionResult<{ linked: number }>> {
  try {
    const account = await requireAccountActionUser();
    if (!account.emailVerified) throw new ActionFailure("Verify your account email before linking guest records.");
    const guest = await getGuestSession();
    if (!guest) throw new ActionFailure("No guest membership was found in this browser.");
    const linked = await prisma.$transaction(async (tx) => {
      await assertGuestCredential(tx, guest);
      const memberships = await tx.groupMember.findMany({ where: { guestSessionId: guest.id, userId: null, status: "ACTIVE" } });
      for (const membership of memberships) {
        const conflict = await tx.groupMember.findFirst({ where: { groupId: membership.groupId, OR: [{ userId: account.id }, { email: account.email }], id: { not: membership.id } } });
        if (conflict) throw new ActionFailure(`Your account already has a membership or invitation in this group. Ask its owner to resolve the duplicate before linking.`);
        const updated = await tx.groupMember.updateMany({ where: { id: membership.id, guestSessionId: guest.id, userId: null, status: "ACTIVE" }, data: { userId: account.id, email: account.email, guestSessionId: null, guestRecoveryTokenHash: null, guestRecoveryExpiresAt: null } });
        if (updated.count !== 1) throw new ActionFailure("Guest access changed. Refresh before linking your records.");
        await tx.activityLog.create({ data: { groupId: membership.groupId, actorMemberId: membership.id, type: "GROUP_UPDATED", message: `${membership.displayName} linked their guest membership to an account` } });
      }
      // The old guest credential must stop resolving after upgrade.
      await tx.guestSession.delete({ where: { id: guest.id } });
      return memberships.length;
    });
    await clearGuestCookie(); revalidatePath("/dashboard"); revalidatePath("/account"); revalidatePath("/groups", "layout");
    return { ok: true, data: { linked }, message: `${linked} guest membership${linked === 1 ? "" : "s"} linked. Your expenses and balances are preserved.` };
  } catch (error) { return guestError(error); }
}

export async function forgetGuestAction(): Promise<ActionResult<{ forgotten: true }>> {
  try {
    const actor = await requireActionUser();
    if (!actor.isGuest) throw new ActionFailure("Use account sign out for this session.");
    await clearGuestCookie();
    return { ok: true, data: { forgotten: true } };
  } catch (error) { return guestError(error); }
}
