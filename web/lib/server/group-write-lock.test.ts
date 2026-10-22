import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import type { Prisma } from "@/generated/prisma/client";
import { assertExpectedGroupCurrency, lockWritableGroup } from "./group-write-lock";

function client(rows: unknown[]) {
  const query = vi.fn().mockResolvedValue(rows);
  return { query, tx: { $queryRaw: query } as unknown as Pick<Prisma.TransactionClient, "$queryRaw"> };
}

describe("group financial write lock", () => {
  it("locks the group row and returns its current financial settings", async () => {
    const state = { id: "group", currency: "SGD", archivedAt: null };
    const { tx, query } = client([state]);
    expect(await lockWritableGroup(tx, "group", "SGD")).toEqual(state);
    expect(query.mock.calls[0]?.[0].join("?")).toContain('WHERE "id" = ? FOR UPDATE');
    expect(query.mock.calls[0]?.[1]).toBe("group");
  });

  it("rejects a currency changed since membership authorization", async () => {
    const { tx } = client([{ id: "group", currency: "JPY", archivedAt: null }]);
    await expect(lockWritableGroup(tx, "group", "SGD")).rejects.toThrow("currency changed");
  });

  it("rejects a group archived or removed while an action was queued", async () => {
    await expect(lockWritableGroup(client([{ id: "group", currency: "SGD", archivedAt: new Date() }]).tx, "group", "SGD"))
      .rejects.toThrow("archived");
    await expect(lockWritableGroup(client([]).tx, "group", "SGD")).rejects.toThrow("no longer exists");
  });

  it("rejects stale browser currency but accepts compatible legacy inputs", () => {
    expect(() => assertExpectedGroupCurrency({ currency: "SGD" }, "USD")).toThrow("currency changed");
    expect(() => assertExpectedGroupCurrency({ currency: "SGD" })).not.toThrow();
  });
});
