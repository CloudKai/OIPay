import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ jobs: vi.fn(), process: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { accountDeletionJob: { findMany: mocks.jobs } } }));
vi.mock("@/lib/server/account-deletion", () => ({ processAccountDeletion: mocks.process }));

import { GET } from "./route";

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("CRON_SECRET", "secret".repeat(8)); });
afterEach(() => vi.unstubAllEnvs());

it.each([undefined, "Bearer wrong"])("rejects an unauthorized worker request (%s)", async (authorization) => {
  const response = await GET(new Request("http://localhost/api/cron/account-deletions", {
    headers: authorization ? { authorization } : {}
  }));
  expect(response.status).toBe(401);
  expect(mocks.jobs).not.toHaveBeenCalled();
});

it("rejects requests if the recovery secret is missing", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(new Request("http://localhost"))).status).toBe(401);
  expect(mocks.jobs).not.toHaveBeenCalled();
});

it("processes a bounded batch and surfaces failures without disclosing identities", async () => {
  mocks.jobs.mockResolvedValue([{ authUserId: "first" }, { authUserId: "second" }]);
  mocks.process.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("Database offline"));
  const response = await GET(new Request("http://localhost", {
    headers: { authorization: `Bearer ${"secret".repeat(8)}` }
  }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ attempted: 2, completed: 1, pending: 1 });
  expect(mocks.jobs).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
});
