import type { User } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), lock: vi.fn(), deletion: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { AccountDeletionRequested, AppUserSynchronizer } from "./session";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (operation) => operation({
    $executeRaw: mocks.lock,
    accountDeletionJob: { findUnique: mocks.deletion },
    user: { findUnique: mocks.user }
  }));
});

it.each([null, new Date()])("blocks profile recreation for pending and completed deletion jobs (%s)", async (completedAt) => {
  mocks.deletion.mockResolvedValue({ completedAt });
  await expect(new AppUserSynchronizer().synchronize({
    id: "auth-user", email: "deleted@example.com"
  } as User)).rejects.toBeInstanceOf(AccountDeletionRequested);
  expect(mocks.lock).toHaveBeenCalledTimes(1);
  expect(mocks.user).not.toHaveBeenCalled();
});
