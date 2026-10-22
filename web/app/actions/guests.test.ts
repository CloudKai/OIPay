import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  account: vi.fn(), guest: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn(), transaction: vi.fn(),
  group: { findUnique: vi.fn(), update: vi.fn() },
  member: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  session: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() }, activity: { create: vi.fn() }, lock: vi.fn()
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionUser: mocks.account, getSessionPrincipal: mocks.account }));
vi.mock("@/lib/guest-session", async (original) => {
  const actual = await original<typeof import("@/lib/guest-session")>();
  return { ...actual, getGuestSession: mocks.guest, setGuestCookie: mocks.cookie, clearGuestCookie: mocks.clearCookie };
});
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: mocks.transaction, group: mocks.group, groupMember: mocks.member,
  guestSession: mocks.session, activityLog: mocks.activity
} }));
import { joinGroupAction, recoverGuestAction, linkGuestAccountAction, manageJoinLinkAction, issueGuestRecoveryAction } from "./guests";
import { credentialHash } from "@/lib/guest-session";
const token = "t".repeat(43);
const group = { id: "group", name: "Trip", currency: "SGD", joinEnabled: true, joinTokenHash: credentialHash(token), archivedAt: null };
const guestMember = { id: "guest-member", groupId: "group", displayName: "Alex", userId: null, guestSessionId: "old-session", status: "ACTIVE", guestRecoveryTokenHash: credentialHash(token), guestRecoveryExpiresAt: new Date(Date.now() + 60000) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.account.mockResolvedValue(null); mocks.guest.mockResolvedValue(null);
  mocks.group.findUnique.mockResolvedValue(group); mocks.member.findFirst.mockResolvedValue(null);
  mocks.member.create.mockImplementation(async ({ data }) => ({ id: "new-member", ...data }));
  mocks.session.create.mockResolvedValue({ id: "new-session" });
  mocks.session.findUnique.mockResolvedValue({ id: "old-session", tokenHash: "active-hash", expiresAt: new Date(Date.now() + 60000) });
  mocks.session.update.mockImplementation(async ({ where }) => ({ id: where.id }));
  mocks.member.findUnique.mockResolvedValue(guestMember); mocks.member.updateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (op) => op({ group: mocks.group, groupMember: mocks.member, guestSession: mocks.session, activityLog: mocks.activity, $executeRaw: mocks.lock }));
});
describe("guest joining", () => {
  it("creates membership with a hashed credential and no invented user or email", async () => {
    const result = await joinGroupAction({ token, name: "Alex Tan" });
    expect(result).toMatchObject({ ok: true, data: { groupId: "group" } });
    expect(mocks.member.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: null, email: null, guestSessionId: "new-session", displayNameKey: "alex tan" }) });
    const credential = mocks.cookie.mock.calls[0]![0];
    expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.session.create).toHaveBeenCalledWith({ data: { tokenHash: credentialHash(credential), expiresAt: expect.any(Date) } });
    expect(mocks.lock).toHaveBeenCalledOnce();
  });
  it("rejects a name collision rather than granting the existing person's access", async () => {
    mocks.member.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(guestMember);
    const result = await joinGroupAction({ token, name: "Alex" });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("already uses") });
    expect(mocks.member.create).not.toHaveBeenCalled(); expect(mocks.cookie).not.toHaveBeenCalled();
  });
  it("rejects a joining link replaced after initial lookup", async () => {
    mocks.group.findUnique.mockResolvedValueOnce(group).mockResolvedValueOnce({ ...group, joinTokenHash: "replaced" });
    expect(await joinGroupAction({ token, name: "Alex" })).toMatchObject({ ok: false });
    expect(mocks.member.create).not.toHaveBeenCalled();
  });
  it("reuses the browser identity for another group without creating an account", async () => {
    mocks.guest.mockResolvedValue({ id: "browser-session", tokenHash: "active-hash" });
    expect(await joinGroupAction({ token, name: "Alex" })).toMatchObject({ ok: true });
    expect(mocks.member.create).toHaveBeenCalledWith({ data: expect.objectContaining({ guestSessionId: "browser-session" }) });
    expect(mocks.session.create).not.toHaveBeenCalled();
  });
});
describe("guest recovery", () => {
  it("moves the original membership to a new browser and consumes recovery once", async () => {
    expect(await recoverGuestAction({ token })).toMatchObject({ ok: true });
    expect(mocks.member.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ id: "guest-member", userId: null, guestRecoveryTokenHash: credentialHash(token), guestRecoveryExpiresAt: { gt: expect.any(Date) } }), data: { guestSessionId: "new-session", guestRecoveryTokenHash: null, guestRecoveryExpiresAt: null } });
    expect(mocks.member.create).not.toHaveBeenCalled();
  });
  it("rotates credentials even when recovering in a browser with the same guest identity", async () => {
    mocks.guest.mockResolvedValue({ id: "old-session", tokenHash: "active-hash" });
    expect(await recoverGuestAction({ token })).toMatchObject({ ok: true });
    const credential = mocks.cookie.mock.calls[0]![0];
    expect(mocks.session.update).toHaveBeenCalledWith({ where: { id: "old-session" }, data: { tokenHash: credentialHash(credential), expiresAt: expect.any(Date) } });
  });
  it("rejects a replay lost to a concurrent recovery", async () => {
    mocks.member.updateMany.mockResolvedValue({ count: 0 });
    expect(await recoverGuestAction({ token })).toMatchObject({ ok: false });
    expect(mocks.cookie).not.toHaveBeenCalled(); expect(mocks.activity.create).not.toHaveBeenCalled();
  });
  it("rejects an expired recovery link", async () => {
    mocks.member.findUnique.mockResolvedValue({ ...guestMember, guestRecoveryExpiresAt: new Date(0) });
    expect(await recoverGuestAction({ token })).toMatchObject({ ok: false });
    expect(mocks.member.updateMany).not.toHaveBeenCalled();
  });
});
describe("linking and owner controls", () => {
  it("refuses to merge a guest into an account already represented in its group", async () => {
    mocks.account.mockResolvedValue({ id: "account", email: "alex@example.com", emailVerified: true });
    mocks.guest.mockResolvedValue({ id: "old-session", tokenHash: "active-hash" }); mocks.member.findMany.mockResolvedValue([guestMember]);
    mocks.member.findFirst.mockResolvedValue({ id: "existing-member" });
    expect(await linkGuestAccountAction()).toMatchObject({ ok: false, message: expect.stringContaining("already has") });
    expect(mocks.member.updateMany).not.toHaveBeenCalled(); expect(mocks.clearCookie).not.toHaveBeenCalled();
  });
  it("links the same membership without moving any financial records", async () => {
    mocks.account.mockResolvedValue({ id: "account", email: "alex@example.com", emailVerified: true });
    mocks.guest.mockResolvedValue({ id: "old-session", tokenHash: "active-hash" }); mocks.member.findMany.mockResolvedValue([guestMember]);
    expect(await linkGuestAccountAction()).toMatchObject({ ok: true, data: { linked: 1 } });
    expect(mocks.member.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ id: "guest-member", guestSessionId: "old-session", userId: null }), data: expect.objectContaining({ userId: "account", guestSessionId: null, email: "alex@example.com" }) });
    expect(mocks.clearCookie).toHaveBeenCalledOnce();
    expect(mocks.session.delete).toHaveBeenCalledWith({ where: { id: "old-session" } });
  });
  it("rejects account linking from a credential rotated after request authentication", async () => {
    mocks.account.mockResolvedValue({ id: "account", email: "alex@example.com", emailVerified: true });
    mocks.guest.mockResolvedValue({ id: "old-session", tokenHash: "active-hash" });
    mocks.session.findUnique.mockResolvedValue({ tokenHash: "replacement-hash", expiresAt: new Date(Date.now() + 60000) });
    expect(await linkGuestAccountAction()).toMatchObject({ ok: false, message: expect.stringContaining("replaced or expired") });
    expect(mocks.member.updateMany).not.toHaveBeenCalled(); expect(mocks.clearCookie).not.toHaveBeenCalled();
  });
  it("rejects a guest session that expires during a join", async () => {
    mocks.guest.mockResolvedValue({ id: "old-session", tokenHash: "active-hash" });
    mocks.session.findUnique.mockResolvedValue({ tokenHash: "active-hash", expiresAt: new Date(0) });
    expect(await joinGroupAction({ token, name: "Alex" })).toMatchObject({ ok: false, message: expect.stringContaining("replaced or expired") });
    expect(mocks.member.create).not.toHaveBeenCalled();
  });
  it("allows owners to restore guest access to archived read-only history", async () => {
    mocks.account.mockResolvedValue({ id: "account", name: "Owner" });
    const owner = { id: "owner", groupId: "group", role: "OWNER", group: { name: "Trip", archivedAt: new Date() } };
    mocks.member.findFirst.mockResolvedValueOnce(owner).mockResolvedValueOnce(owner).mockResolvedValueOnce(guestMember);
    expect(await issueGuestRecoveryAction({ groupId: "group", memberId: "guest-member" })).toMatchObject({ ok: true });
    expect(mocks.member.update).toHaveBeenCalledWith({ where: { id: "guest-member" }, data: expect.objectContaining({ guestRecoveryTokenHash: expect.any(String) }) });
  });
  it("rejects link management after ownership changed during the request", async () => {
    mocks.account.mockResolvedValue({ id: "account", name: "Owner" });
    mocks.member.findFirst.mockResolvedValueOnce({ id: "owner", groupId: "group", role: "OWNER", group: { archivedAt: null } }).mockResolvedValueOnce(null);
    expect(await manageJoinLinkAction({ groupId: "group", enabled: true })).toMatchObject({ ok: false, message: expect.stringContaining("current group owner") });
    expect(mocks.group.update).not.toHaveBeenCalled();
  });
  it("refuses owner controls without an account", async () => {
    expect(await manageJoinLinkAction({ groupId: "group", enabled: true })).toMatchObject({ ok: false });
    expect(await issueGuestRecoveryAction({ groupId: "group", memberId: "guest-member" })).toMatchObject({ ok: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
