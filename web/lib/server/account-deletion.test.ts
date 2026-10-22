import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn() }));
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  lock: vi.fn(),
  job: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  member: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  user: { delete: vi.fn() },
  deleteAuthUser: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: mocks.transaction,
  accountDeletionJob: mocks.job
} }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ auth: { admin: { deleteUser: mocks.deleteAuthUser } } })
}));

import { processAccountDeletion, requestAccountDeletion } from "./account-deletion";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "a".repeat(32));
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.transaction.mockImplementation(async (operation) => operation({
    $executeRaw: mocks.lock,
    accountDeletionJob: mocks.job,
    groupMember: mocks.member,
    user: mocks.user
  }));
  mocks.job.findUnique.mockResolvedValue(null);
  mocks.member.findMany.mockResolvedValue([]);
  mocks.job.updateMany.mockResolvedValue({ count: 1 });
  mocks.deleteAuthUser.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("deletion request", () => {
  it("saves recovery work in the same transaction as profile removal, before calling any provider", async () => {
    mocks.member.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "member" }]);
    await requestAccountDeletion("user", "auth-user");
    expect(mocks.job.create).toHaveBeenCalledWith({ data: { authUserId: "auth-user" } });
    expect(mocks.member.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: null, status: "REMOVED", email: null, displayNameKey: null, guestSessionId: null, guestRecoveryTokenHash: null })
    }));
    expect(mocks.user.delete).toHaveBeenCalledWith({ where: { id: "user" } });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("does not remove the profile when the recovery job cannot be persisted", async () => {
    mocks.job.create.mockRejectedValue(new Error("Database unavailable"));
    await expect(requestAccountDeletion("user", "auth-user")).rejects.toThrow("Database unavailable");
    expect(mocks.user.delete).not.toHaveBeenCalled();
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("requires recovery configuration before changing app data", async () => {
    vi.stubEnv("CRON_SECRET", "");
    await expect(requestAccountDeletion("user", "auth-user")).rejects.toThrow("temporarily unavailable");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks the last owner's deletion", async () => {
    mocks.member.findMany.mockResolvedValueOnce([{ id: "owner", groupId: "group", group: { name: "Trip" } }]);
    mocks.member.count.mockResolvedValue(0);
    await expect(requestAccountDeletion("user", "auth-user")).rejects.toThrow("Transfer ownership of Trip");
    expect(mocks.job.create).not.toHaveBeenCalled();
    expect(mocks.user.delete).not.toHaveBeenCalled();
  });
});

describe("deletion recovery", () => {
  beforeEach(() => {
    mocks.job.findUnique.mockResolvedValue({ completedAt: null });
  });

  it("keeps failed cleanup eligible for another worker", async () => {
    mocks.deleteAuthUser.mockRejectedValue(new Error("Provider timeout"));
    await expect(processAccountDeletion("auth-user")).resolves.toBe(false);
    expect(mocks.job.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ attempts: { increment: 1 }, nextAttemptAt: expect.any(Date) })
    }));
    expect(mocks.job.update).not.toHaveBeenCalled();
  });

  it("completes a retry after the provider deleted the user but lost the response", async () => {
    mocks.deleteAuthUser.mockResolvedValue({ error: { code: "user_not_found" } });
    await expect(processAccountDeletion("auth-user")).resolves.toBe(true);
    expect(mocks.job.update).toHaveBeenCalledWith({
      where: { authUserId: "auth-user" }, data: { completedAt: expect.any(Date) }
    });
  });

  it("does not mistake other provider failures for successful deletion", async () => {
    mocks.deleteAuthUser.mockResolvedValue({ error: { status: 404, code: "unexpected_failure" } });
    await expect(processAccountDeletion("auth-user")).resolves.toBe(false);
    expect(mocks.job.update).not.toHaveBeenCalled();
  });

  it("does not duplicate work already leased to another worker", async () => {
    mocks.job.updateMany.mockResolvedValue({ count: 0 });
    await expect(processAccountDeletion("auth-user")).resolves.toBe(false);
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("does not call the provider for completed jobs", async () => {
    mocks.job.findUnique.mockResolvedValue({ completedAt: new Date() });
    await expect(processAccountDeletion("auth-user")).resolves.toBe(true);
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
  });
});
