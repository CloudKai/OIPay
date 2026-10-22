import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  findUnique: vi.fn()
}));
vi.mock("@/lib/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
});

it("rejects an unauthenticated export without querying account data", async () => {
  mocks.user.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(mocks.findUnique).not.toHaveBeenCalled();
});

it("scopes financial exports to the signed-in user's active memberships", async () => {
  mocks.user.mockResolvedValue({ id: "signed-in-user" });
  mocks.findUnique.mockResolvedValue({ id: "signed-in-user", memberships: [] });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "signed-in-user" },
    select: expect.objectContaining({
      memberships: expect.objectContaining({ where: { status: "ACTIVE" } })
    })
  }));
});
