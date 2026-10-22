"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { memberNameKey } from "@/lib/member-identity";
import { sendTransactionalEmail } from "@/lib/email";
import { isSupportedCurrency } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import { retryTransaction } from "@/lib/server/retry-transaction";
import { lockWritableGroup } from "@/lib/server/group-write-lock";
import type { ActionResult } from "@/lib/result";
import {
  ActionFailure,
  publicActionError,
  requireActionUser,
  requireAccountActionUser,
  requireMembership,
  requireOwner,
  requireWritableGroup
} from "@/lib/server/authz";
import { getSiteUrl } from "@/lib/site-url";
import {
  claimInvitationSchema,
  createGroupSchema,
  groupIdSchema,
  inviteMemberSchema,
  memberMutationSchema,
  updateGroupSchema,
  zodFieldErrors
} from "@/lib/validation";

function invitationHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function invitationUrl(token: string): string {
  return new URL(`/invite/${token}`, getSiteUrl()).toString();
}

async function assertInvitationLimit(client: Pick<PrismaClient, "activityLog">, actorMemberId: string) {
  const recentInvites = await client.activityLog.count({
    where: {
      actorMemberId,
      type: "MEMBER_INVITED",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
    }
  });
  if (recentInvites >= 10) {
    throw new ActionFailure("Invitation limit reached. Try again in an hour.");
  }
}

async function deliverInvitation(input: {
  email: string;
  displayName: string;
  groupName: string;
  groupId: string;
  inviterName: string;
  token: string;
  memberId: string;
}) {
  let status: "SENT" | "DISABLED" | "FAILED";
  try {
    status = await sendTransactionalEmail({
      to: input.email,
      subject: `Join ${input.groupName} on SplitTogether`,
      preview: `${input.inviterName} invited you to split expenses`,
      heading: `Join ${input.groupName}`,
      body: `${input.inviterName} invited ${input.displayName} to share expenses and balances in SplitTogether. This invitation expires in seven days.`,
      actionLabel: "Accept invitation",
      actionUrl: invitationUrl(input.token),
      idempotencyKey: `group-invite-${input.memberId}-${invitationHash(input.token)}`
    });
  } catch {
    status = "FAILED";
  }
  // An earlier delivery must not overwrite a newer resend or accepted invite.
  await prisma.groupMember.updateMany({
    where: { id: input.memberId, status: "INVITED", invitationTokenHash: invitationHash(input.token) },
    data: { invitationDeliveryStatus: status }
  });
  revalidatePath(`/groups/${input.groupId}`);
  if (status === "FAILED") {
    throw new ActionFailure("The invitation was saved, but email sending failed. Open Settings and use Resend to try again.");
  }
  return status;
}

export async function createGroupAction(
  input: unknown
): Promise<ActionResult<{ groupId: string }>> {
  try {
    const parsed = createGroupSchema.safeParse(input);
    if (!parsed.success) {
      throw new ActionFailure("Check the group details.", zodFieldErrors(parsed.error));
    }
    if (!isSupportedCurrency(parsed.data.currency)) {
      throw new ActionFailure("Choose a supported currency.", {
        currency: ["Choose a supported currency."]
      });
    }

    const user = await requireAccountActionUser();
    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.group.create({ data: parsed.data });
      const owner = await tx.groupMember.create({
        data: {
          groupId: created.id,
          userId: user.id,
          displayName: user.name,
          displayNameKey: memberNameKey(user.name),
          email: user.email.toLowerCase(),
          role: "OWNER",
          status: "ACTIVE",
          invitationAcceptedAt: new Date()
        }
      });
      await tx.activityLog.create({
        data: {
          groupId: created.id,
          actorMemberId: owner.id,
          type: "GROUP_CREATED",
          message: `${user.name} created ${created.name}`,
          metadata: { currency: created.currency }
        }
      });
      return created;
    });

    revalidatePath("/dashboard");
    revalidatePath("/groups");
    return { ok: true, data: { groupId: group.id }, message: "Group created." };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function updateGroupAction(
  input: unknown
): Promise<ActionResult<{ groupId: string }>> {
  try {
    const parsed = updateGroupSchema.safeParse(input);
    if (!parsed.success) {
      throw new ActionFailure("Check the group details.", zodFieldErrors(parsed.error));
    }
    if (!isSupportedCurrency(parsed.data.currency)) {
      throw new ActionFailure("Choose a supported currency.");
    }

    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireOwner(membership);
    requireWritableGroup(membership.group);
    await prisma.$transaction(async (tx) => {
      const group = await lockWritableGroup(tx, parsed.data.groupId);
      if (parsed.data.currency !== group.currency) {
        const [expenseCount, settlementCount] = await Promise.all([
          tx.expense.count({ where: { groupId: parsed.data.groupId } }),
          tx.settlement.count({ where: { groupId: parsed.data.groupId } })
        ]);
        if (expenseCount + settlementCount > 0) {
          throw new ActionFailure("Currency cannot be changed after an expense or payment has been recorded.");
        }
      }
      await tx.group.update({
        where: { id: parsed.data.groupId },
        data: { name: parsed.data.name, currency: parsed.data.currency }
      });
      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "GROUP_UPDATED",
          message: `${membership.displayName} updated the group settings`,
          metadata: {
            name: parsed.data.name,
            currency: parsed.data.currency
          }
        }
      });
    });

    revalidatePath(`/groups/${parsed.data.groupId}`);
    revalidatePath("/dashboard");
    return {
      ok: true,
      data: { groupId: parsed.data.groupId },
      message: "Group settings updated."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function inviteMemberAction(
  input: unknown
): Promise<ActionResult<{ memberId: string }>> {
  try {
    const parsed = inviteMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw new ActionFailure("Check the invitation details.", zodFieldErrors(parsed.error));
    }

    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireOwner(membership);
    requireWritableGroup(membership.group);

    const existing = await prisma.groupMember.findUnique({
      where: {
        groupId_email: {
          groupId: parsed.data.groupId,
          email: parsed.data.email
        }
      }
    });
    if (existing?.status === "ACTIVE") {
      throw new ActionFailure("That person is already an active member.");
    }
    if (existing?.status === "INVITED") {
      throw new ActionFailure("An invitation is already pending. Use resend instead.");
    }

    const invitedUser = await prisma.user.findUnique({
      where: { email: parsed.data.email }
    });
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const invited = await retryTransaction(() => prisma.$transaction(async (tx) => {
      await assertInvitationLimit(tx, membership.id);
      const member = existing
        ? await tx.groupMember.update({
            where: { id: existing.id, status: "REMOVED" },
            data: {
              userId: invitedUser?.id ?? null,
              displayName: parsed.data.displayName,
              displayNameKey: memberNameKey(parsed.data.displayName),
              email: parsed.data.email,
              role: "MEMBER",
              status: "INVITED",
              invitationTokenHash: invitationHash(token),
              invitationExpiresAt: expiresAt,
              invitationSentAt: now,
              invitationDeliveryStatus: "PENDING",
              invitationAcceptedAt: null
            }
          })
        : await tx.groupMember.create({
            data: {
              groupId: parsed.data.groupId,
              userId: invitedUser?.id,
              displayName: parsed.data.displayName,
              displayNameKey: memberNameKey(parsed.data.displayName),
              email: parsed.data.email,
              status: "INVITED",
              invitationTokenHash: invitationHash(token),
              invitationExpiresAt: expiresAt,
              invitationSentAt: now,
              invitationDeliveryStatus: "PENDING"
            }
          });

      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "MEMBER_INVITED",
          message: `${membership.displayName} invited ${parsed.data.displayName}`,
          metadata: { memberId: member.id }
        }
      });
      return member;
    }, { isolationLevel: "Serializable" }));

    const deliveryStatus = await deliverInvitation({
      email: invited.email!,
      displayName: invited.displayName,
      groupName: membership.group.name,
      groupId: parsed.data.groupId,
      inviterName: membership.displayName,
      token,
      memberId: invited.id
    });

    revalidatePath(`/groups/${parsed.data.groupId}`);
    return {
      ok: true,
      data: { memberId: invited.id },
      message: deliveryStatus === "DISABLED" ? "Invitation saved. Email sending is disabled in this environment." : "Invitation sent."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function resendInvitationAction(
  input: unknown
): Promise<ActionResult<{ memberId: string }>> {
  try {
    const parsed = memberMutationSchema.safeParse(input);
    if (!parsed.success) {
      throw new ActionFailure("Invalid invitation.", zodFieldErrors(parsed.error));
    }
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireOwner(membership);
    requireWritableGroup(membership.group);

    const pending = await prisma.groupMember.findFirst({
      where: {
        id: parsed.data.memberId,
        groupId: parsed.data.groupId,
        status: "INVITED"
      }
    });
    if (!pending) throw new ActionFailure("This invitation is no longer pending.");
    if (
      pending.invitationSentAt &&
      Date.now() - pending.invitationSentAt.getTime() < 60_000
    ) {
      throw new ActionFailure("Wait a minute before resending this invitation.");
    }

    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await retryTransaction(() => prisma.$transaction(async (tx) => {
      await assertInvitationLimit(tx, membership.id);
      const updated = await tx.groupMember.updateMany({
        where: { id: pending.id, status: "INVITED", invitationTokenHash: pending.invitationTokenHash },
        data: {
          invitationTokenHash: invitationHash(token),
          invitationExpiresAt: expiresAt,
          invitationSentAt: now,
          invitationDeliveryStatus: "PENDING"
        }
      });
      if (updated.count !== 1) throw new ActionFailure("This invitation changed. Refresh and try again.");
      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "MEMBER_INVITED",
          message: `${membership.displayName} resent ${pending.displayName}'s invitation`,
          metadata: { memberId: pending.id, resent: true }
        }
      });
    }, { isolationLevel: "Serializable" }));

    const deliveryStatus = await deliverInvitation({
      email: pending.email!,
      displayName: pending.displayName,
      groupName: membership.group.name,
      groupId: parsed.data.groupId,
      inviterName: membership.displayName,
      token,
      memberId: pending.id
    });
    revalidatePath(`/groups/${parsed.data.groupId}`);
    return {
      ok: true,
      data: { memberId: pending.id },
      message: deliveryStatus === "DISABLED" ? "Invitation saved. Email sending is disabled in this environment." : "Invitation resent."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function revokeInvitationAction(
  input: unknown
): Promise<ActionResult<{ memberId: string }>> {
  try {
    const parsed = memberMutationSchema.safeParse(input);
    if (!parsed.success) throw new ActionFailure("Invalid invitation.");
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireOwner(membership);
    requireWritableGroup(membership.group);

    const pending = await prisma.groupMember.findFirst({
      where: {
        id: parsed.data.memberId,
        groupId: parsed.data.groupId,
        status: "INVITED"
      }
    });
    if (!pending) throw new ActionFailure("This invitation is no longer pending.");

    await prisma.$transaction(async (tx) => {
      const updated = await tx.groupMember.updateMany({
        where: { id: pending.id, status: "INVITED", invitationTokenHash: pending.invitationTokenHash },
        data: {
          status: "REMOVED",
          displayNameKey: null,
          invitationTokenHash: null,
          invitationExpiresAt: null
        }
      });
      if (updated.count !== 1) throw new ActionFailure("This invitation changed. Refresh and try again.");
      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "MEMBER_INVITATION_REVOKED",
          message: `${membership.displayName} revoked ${pending.displayName}'s invitation`,
          metadata: { memberId: pending.id }
        }
      });
    });

    revalidatePath(`/groups/${parsed.data.groupId}`);
    return {
      ok: true,
      data: { memberId: pending.id },
      message: "Invitation revoked."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function claimInvitationAction(
  input: unknown
): Promise<ActionResult<{ groupId: string }>> {
  try {
    const parsed = claimInvitationSchema.safeParse(input);
    if (!parsed.success) throw new ActionFailure("This invitation link is invalid.");
    const user = await requireAccountActionUser();
    if (!user.emailVerified) throw new ActionFailure("Verify your email before accepting an invitation.");
    const tokenHash = invitationHash(parsed.data.token);
    const pending = await prisma.groupMember.findUnique({
      where: { invitationTokenHash: tokenHash },
      include: { group: { select: { name: true, archivedAt: true } } }
    });

    if (
      !pending ||
      pending.status !== "INVITED" ||
      !pending.invitationExpiresAt ||
      pending.invitationExpiresAt.getTime() <= Date.now()
    ) {
      throw new ActionFailure("This invitation has expired or was revoked.");
    }
    requireWritableGroup(pending.group);
    if (pending.email !== user.email.toLowerCase()) {
      throw new ActionFailure(
        `Sign in with ${pending.email} to accept this invitation.`
      );
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.groupMember.updateMany({
        where: {
          id: pending.id,
          status: "INVITED",
          invitationTokenHash: tokenHash,
          invitationExpiresAt: { gt: new Date() },
          group: { archivedAt: null }
        },
        data: {
          userId: user.id,
          // Preserve the distinct group name from the invitation.
          status: "ACTIVE",
          invitationTokenHash: null,
          invitationExpiresAt: null,
          invitationAcceptedAt: new Date()
        }
      });
      if (claimed.count !== 1) throw new ActionFailure("This invitation has expired, changed, or was revoked.");
      await tx.activityLog.create({
        data: {
          groupId: pending.groupId,
          actorMemberId: pending.id,
          type: "MEMBER_JOINED",
          message: `${pending.displayName} joined ${pending.group.name}`,
          metadata: { memberId: pending.id }
        }
      });
    });

    revalidatePath("/dashboard");
    revalidatePath(`/groups/${pending.groupId}`);
    return {
      ok: true,
      data: { groupId: pending.groupId },
      message: "Invitation accepted."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function removeMemberAction(
  input: unknown
): Promise<ActionResult<{ memberId: string }>> {
  try {
    const parsed = memberMutationSchema.safeParse(input);
    if (!parsed.success) throw new ActionFailure("Invalid member.");
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireOwner(membership);
    requireWritableGroup(membership.group);
    if (membership.id === parsed.data.memberId) {
      throw new ActionFailure("Use Leave group to remove yourself.");
    }

    const target = await prisma.groupMember.findFirst({
      where: {
        id: parsed.data.memberId,
        groupId: parsed.data.groupId,
        status: "ACTIVE"
      }
    });
    if (!target) throw new ActionFailure("That member is no longer active.");
    if (target.role === "OWNER") {
      const ownerCount = await prisma.groupMember.count({
        where: { groupId: parsed.data.groupId, status: "ACTIVE", role: "OWNER" }
      });
      if (ownerCount <= 1) {
        throw new ActionFailure("Transfer ownership before removing the last owner.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupMember.update({
        where: { id: target.id },
        data: { status: "REMOVED", displayNameKey: null, guestSessionId: null, guestRecoveryTokenHash: null, guestRecoveryExpiresAt: null }
      });
      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "MEMBER_REMOVED",
          message: `${membership.displayName} removed ${target.displayName}`,
          metadata: { memberId: target.id }
        }
      });
    });
    revalidatePath(`/groups/${parsed.data.groupId}`);
    return {
      ok: true,
      data: { memberId: target.id },
      message: "Member removed."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function transferOwnershipAction(
  input: unknown
): Promise<ActionResult<{ memberId: string }>> {
  try {
    const parsed = memberMutationSchema.safeParse(input);
    if (!parsed.success) throw new ActionFailure("Invalid member.");
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireOwner(membership);
    requireWritableGroup(membership.group);
    if (membership.id === parsed.data.memberId) {
      throw new ActionFailure("You already own this group.");
    }

    const target = await prisma.groupMember.findFirst({
      where: {
        id: parsed.data.memberId,
        groupId: parsed.data.groupId,
        status: "ACTIVE"
      }
    });
    if (!target) throw new ActionFailure("Choose an active member.");
    if (!target.userId) throw new ActionFailure("The new owner must link their membership to an account first.");

    await prisma.$transaction(async (tx) => {
      await tx.groupMember.update({
        where: { id: target.id },
        data: { role: "OWNER" }
      });
      await tx.groupMember.update({
        where: { id: membership.id },
        data: { role: "MEMBER" }
      });
      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "OWNER_TRANSFERRED",
          message: `${membership.displayName} transferred ownership to ${target.displayName}`,
          metadata: { newOwnerMemberId: target.id }
        }
      });
    });
    revalidatePath(`/groups/${parsed.data.groupId}`);
    return {
      ok: true,
      data: { memberId: target.id },
      message: "Ownership transferred."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function archiveGroupAction(
  input: unknown
): Promise<ActionResult<{ groupId: string }>> {
  try {
    const parsed = groupIdSchema.safeParse(input);
    if (!parsed.success) throw new ActionFailure("Invalid group.");
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireOwner(membership);
    if (membership.group.archivedAt) {
      throw new ActionFailure("This group is already archived.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id: parsed.data.groupId },
        data: { archivedAt: new Date() }
      });
      await tx.activityLog.create({
        data: {
          groupId: parsed.data.groupId,
          actorMemberId: membership.id,
          type: "GROUP_ARCHIVED",
          message: `${membership.displayName} archived ${membership.group.name}`
        }
      });
    });
    revalidatePath("/dashboard");
    revalidatePath(`/groups/${parsed.data.groupId}`);
    return {
      ok: true,
      data: { groupId: parsed.data.groupId },
      message: "Group archived. Its financial history is preserved."
    };
  } catch (error) {
    return publicActionError(error);
  }
}

export async function permanentlyDeleteGroupAction(input: {
  groupId: string;
  confirmation: string;
}): Promise<ActionResult<{ groupId: string }>> {
  try {
    const parsed = groupIdSchema.safeParse(input);
    if (!parsed.success) throw new ActionFailure("Invalid group.");
    const user = await requireActionUser();
    const membership = await requireMembership(parsed.data.groupId, user.id);
    requireOwner(membership);
    if (!membership.group.archivedAt) {
      throw new ActionFailure("Archive the group before permanently deleting it.");
    }
    if (input.confirmation !== membership.group.name) {
      throw new ActionFailure("Enter the exact group name to confirm deletion.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.expenseShare.deleteMany({
        where: { expense: { groupId: parsed.data.groupId } }
      });
      await tx.activityLog.deleteMany({
        where: { groupId: parsed.data.groupId }
      });
      await tx.settlement.deleteMany({
        where: { groupId: parsed.data.groupId }
      });
      await tx.expense.deleteMany({
        where: { groupId: parsed.data.groupId }
      });
      await tx.groupMember.deleteMany({
        where: { groupId: parsed.data.groupId }
      });
      await tx.group.delete({ where: { id: parsed.data.groupId } });
    });
    revalidatePath("/dashboard");
    return {
      ok: true,
      data: { groupId: parsed.data.groupId },
      message: "Group permanently deleted."
    };
  } catch (error) {
    return publicActionError(error);
  }
}
