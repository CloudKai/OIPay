import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), membership: vi.fn(), lookup: vi.fn() }));
vi.mock("@/lib/server/authz", () => ({
  ActionFailure: class ActionFailure extends Error {},
  requireActionUser: mocks.user,
  requireMembership: mocks.membership
}));
vi.mock("@/lib/server/exchange-rate", () => ({ lookupExchangeRate: mocks.lookup }));

import { GET } from "./route";
import { ActionFailure } from "@/lib/server/authz";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "guest:session" });
  mocks.membership.mockResolvedValue({ id: "member" });
  mocks.lookup.mockResolvedValue({ from: "JPY", to: "SGD", rate: "0.00809", rateDate: "2026-10-22", requestedDate: "2026-10-22", source: "Frankfurter" });
});

const request = () => new Request("https://example.com/api/exchange-rate?groupId=trip&from=JPY&to=SGD");

describe("authenticated exchange-rate API", () => {
  it("allows an authenticated guest only after group access is checked", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.membership).toHaveBeenCalledWith("trip", "guest:session");
    expect(await response.json()).toMatchObject({ rate: "0.00809", rateDate: "2026-10-22" });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("never calls the provider for an inaccessible group", async () => {
    mocks.membership.mockRejectedValue(new ActionFailure("You do not have access to this group."));
    expect((await GET(request())).status).toBe(403);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("rejects unbounded or unsupported currency parameters", async () => {
    expect((await GET(new Request("https://example.com/api/exchange-rate?groupId=trip&from=https://evil.com&to=SGD"))).status).toBe(400);
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("returns a manual fallback message after lookup failure", async () => {
    mocks.lookup.mockRejectedValue(new Error("Provider unavailable"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ message: expect.stringMatching(/Enter the exchange rate/) });
  });
});
