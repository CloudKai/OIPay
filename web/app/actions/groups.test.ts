import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  email: vi.fn(),
  revalidate: vi.fn(),
  transaction: vi.fn(),
  member: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  activity: { count: vi.fn(), create: vi.fn() },
  group: { update: vi.fn() }, expense: { count: vi.fn() }, settlement: { count: vi.fn() }, lock: vi.fn(),
  user: { findUnique: vi.fn() }
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/session", () => ({ getSessionUser: mocks.session, getSessionPrincipal: mocks.session }));
vi.mock("@/lib/email", () => ({ sendTransactionalEmail: mocks.email }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: mocks.transaction, groupMember: mocks.member, activityLog: mocks.activity, user: mocks.user
} }));

import { claimInvitationAction, inviteMemberAction, resendInvitationAction, revokeInvitationAction, updateGroupAction } from "./groups";

const owner = { id: "owner", role: "OWNER", group: { name: "Trip", currency: "USD", archivedAt: null } };
const pending = {
  id: "pending", groupId: "group", email: "person@example.com", displayName: "Person",
  status: "INVITED", invitationTokenHash: "old-hash", invitationSentAt: new Date(0),
  invitationExpiresAt: new Date(Date.now() + 86400_000),
  group: { name: "Trip", archivedAt: null }
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ id: "user", name: "Person", email: pending.email, emailVerified: true });
  mocks.member.findFirst.mockImplementation(async (args) => args.where.id ? pending : owner);
  mocks.member.findUnique.mockResolvedValue(null);
  mocks.member.create.mockImplementation(async (args) => ({ id: "pending", ...args.data }));
  mocks.member.updateMany.mockResolvedValue({ count: 1 });
  mocks.activity.count.mockResolvedValue(0);
  mocks.email.mockResolvedValue("SENT");
  mocks.lock.mockResolvedValue([{ id: "group", currency: "USD", archivedAt: null }]);
  mocks.expense.count.mockResolvedValue(0);
  mocks.settlement.count.mockResolvedValue(0);
  mocks.transaction.mockImplementation(async (operation) => operation({
    groupMember: mocks.member, activityLog: mocks.activity, group: mocks.group,
    expense: mocks.expense, settlement: mocks.settlement, $queryRaw: mocks.lock
  }));
});

describe("group accounting currency", () => {
  it("checks financial history after locking the group", async () => {
    mocks.expense.count.mockResolvedValue(1);
    expect(await updateGroupAction({ groupId: "group", name: "Trip", currency: "SGD" })).toMatchObject({
      ok: false, message: expect.stringContaining("cannot be changed")
    });
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.expense.count.mock.invocationCallOrder[0]!);
    expect(mocks.expense.count).toHaveBeenCalledWith({ where: { groupId: "group" } });
    expect(mocks.group.update).not.toHaveBeenCalled();
  });
  it("uses current locked currency when the earlier settings snapshot is stale", async () => {
    mocks.lock.mockResolvedValue([{ id: "group", currency: "SGD", archivedAt: null }]);
    expect(await updateGroupAction({ groupId: "group", name: "New trip name", currency: "SGD" })).toMatchObject({ ok: true });
    expect(mocks.expense.count).not.toHaveBeenCalled();
    expect(mocks.group.update).toHaveBeenCalledOnce();
  });
  it("includes repayment history when deciding whether currency is fixed", async () => {
    mocks.settlement.count.mockResolvedValue(1);
    expect(await updateGroupAction({ groupId: "group", name: "Trip", currency: "SGD" })).toMatchObject({ ok: false });
    expect(mocks.group.update).not.toHaveBeenCalled();
  });
  it("rejects settings changes queued behind archiving", async () => {
    mocks.lock.mockResolvedValue([{ id: "group", currency: "USD", archivedAt: new Date() }]);
    expect(await updateGroupAction({ groupId: "group", name: "Trip", currency: "USD" })).toMatchObject({
      ok: false, message: expect.stringContaining("archived")
    });
    expect(mocks.group.update).not.toHaveBeenCalled();
  });
});

describe("invitation recovery", () => {
  it("preserves a failed invitation and explains how to resend", async () => {
    mocks.email.mockRejectedValue(new Error("Provider failed"));
    const result = await inviteMemberAction({ groupId: "group", displayName: "Person", email: pending.email });
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/use Resend/i) });
    expect(mocks.member.create).toHaveBeenCalledTimes(1);
    expect(mocks.member.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "pending", status: "INVITED", invitationTokenHash: expect.any(String) }),
      data: { invitationDeliveryStatus: "FAILED" }
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/groups/group");
  });

  it("records successful resend only against the current token", async () => {
    const result = await resendInvitationAction({ groupId: "group", memberId: "pending" });
    expect(result.ok).toBe(true);
    const changedToken = mocks.member.updateMany.mock.calls[0]?.[0].data.invitationTokenHash;
    expect(changedToken).not.toBe("old-hash");
    expect(mocks.member.updateMany).toHaveBeenLastCalledWith({
      where: { id: "pending", status: "INVITED", invitationTokenHash: changedToken },
      data: { invitationDeliveryStatus: "SENT" }
    });
  });

  it("applies the hourly limit to resends as well as new invitations", async () => {
    mocks.activity.count.mockResolvedValue(10);
    const result = await resendInvitationAction({ groupId: "group", memberId: "pending" });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("limit reached") });
    expect(mocks.member.updateMany).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("does not send a new link if the invitation was accepted during resend", async () => {
    mocks.member.updateMany.mockResolvedValue({ count: 0 });
    const result = await resendInvitationAction({ groupId: "group", memberId: "pending" });
    expect(result.ok).toBe(false);
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.activity.create).not.toHaveBeenCalled();
  });

  it("does not remove a member if the invitation was accepted during revocation", async () => {
    mocks.member.updateMany.mockResolvedValue({ count: 0 });
    const result = await revokeInvitationAction({ groupId: "group", memberId: "pending" });
    expect(result.ok).toBe(false);
    expect(mocks.member.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "pending", status: "INVITED", invitationTokenHash: "old-hash" }
    }));
    expect(mocks.activity.create).not.toHaveBeenCalled();
  });
});

describe("invitation acceptance", () => {
  it("rejects an unverified email", async () => {
    mocks.session.mockResolvedValue({ id: "user", email: pending.email, emailVerified: false });
    expect(await claimInvitationAction({ token: "t".repeat(40) })).toMatchObject({ ok: false, message: expect.stringContaining("Verify") });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not accept a link revoked after the initial read", async () => {
    mocks.member.findUnique.mockResolvedValue(pending);
    mocks.member.updateMany.mockResolvedValue({ count: 0 });
    const result = await claimInvitationAction({ token: "t".repeat(40) });
    expect(result.ok).toBe(false);
    expect(mocks.member.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "INVITED", invitationTokenHash: expect.any(String),
        invitationExpiresAt: { gt: expect.any(Date) }, group: { archivedAt: null }
      })
    }));
    expect(mocks.activity.create).not.toHaveBeenCalled();
  });

  it("rejects an archived group's invitation", async () => {
    mocks.member.findUnique.mockResolvedValue({ ...pending, group: { ...pending.group, archivedAt: new Date() } });
    const result = await claimInvitationAction({ token: "t".repeat(40) });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("archived") });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
