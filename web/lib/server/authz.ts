import "server-only";

import { Prisma, type GroupMember } from "@/generated/prisma/client";
import { principalMembershipWhere } from "@/lib/member-identity";
import { prisma } from "@/lib/prisma";
import { getSessionPrincipal, getSessionUser } from "@/lib/session";

export class ActionFailure extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message);
  }
}

export async function requireActionUser(): Promise<
  NonNullable<Awaited<ReturnType<typeof getSessionPrincipal>>>
> {
  const user = await getSessionPrincipal();
  if (!user) throw new ActionFailure("Your session expired. Please sign in again.");
  return user;
}

export async function requireMembership(
  groupId: string,
  userId: string
): Promise<GroupMember & { group: { id: string; name: string; currency: string; archivedAt: Date | null } }> {
  const membership = await prisma.groupMember.findFirst({
    where: { groupId, ...principalMembershipWhere(userId), status: "ACTIVE" },
    include: {
      group: {
        select: { id: true, name: true, currency: true, archivedAt: true }
      }
    }
  });

  if (!membership) {
    throw new ActionFailure("You do not have access to this group.");
  }
  return membership;
}

export function requireOwner(membership: GroupMember): void {
  if (membership.role !== "OWNER") {
    throw new ActionFailure("Only a group owner can do that.");
  }
}

export function requireWritableGroup(group: { archivedAt: Date | null }): void {
  if (group.archivedAt) {
    throw new ActionFailure("This group is archived and cannot be changed.");
  }
}

export function requireRecordPermission(input: {
  membership: GroupMember;
  createdByMemberId: string;
}): void {
  if (
    input.membership.role !== "OWNER" &&
    input.membership.id !== input.createdByMemberId
  ) {
    throw new ActionFailure(
      "Only the record creator or a group owner can change this record."
    );
  }
}

export function publicActionError(error: unknown): {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string[]>;
} {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && JSON.stringify(error.meta?.target ?? "").includes("displayNameKey")) {
    return { ok: false, message: "That member name is already in use. Add a surname or initial to make it distinguishable." };
  }
  if (error instanceof ActionFailure) {
    return {
      ok: false,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {})
    };
  }

  console.error("Server action failed", error);
  return {
    ok: false,
    message: "Something went wrong. Please try again."
  };
}

export async function requireAccountActionUser() {
  const user = await getSessionUser();
  if (!user) throw new ActionFailure("Sign in or create an account to do that. Your guest group records will be kept.");
  return user;
}
