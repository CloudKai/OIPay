import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { Prisma } from "@/generated/prisma/client";
import { createOnce, retryTransaction } from "./retry-transaction";

function databaseError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("Database conflict", {
    code,
    clientVersion: "test"
  });
}

describe("financial transaction retries", () => {
  it("returns a previously committed record without running balance validation again", async () => {
    const saved = { id: "payment", version: 1 };
    const create = vi.fn();
    await expect(createOnce(async () => saved, create)).resolves.toEqual(saved);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the winner when concurrent submissions hit the unique constraint", async () => {
    const saved = { id: "expense", version: 1 };
    const find = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    const create = vi.fn().mockRejectedValue(databaseError("P2002"));
    await expect(createOnce(find, create)).resolves.toEqual(saved);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("checks for a committed duplicate before retrying a serialization conflict", async () => {
    const saved = { id: "payment", version: 1 };
    const find = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    const create = vi.fn().mockRejectedValue(databaseError("P2034"));
    await expect(createOnce(find, create)).resolves.toEqual(saved);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("recovers when the concurrent payment has already settled the debt", async () => {
    const saved = { id: "payment", version: 1 };
    const find = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    const create = vi.fn().mockRejectedValue(new Error("The payer no longer owes money."));
    await expect(createOnce(find, create)).resolves.toEqual(saved);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("reruns a conflicted transaction with a fresh snapshot", async () => {
    const operation = vi.fn().mockRejectedValueOnce(databaseError("P2034")).mockResolvedValue("saved");
    await expect(retryTransaction(operation)).resolves.toBe("saved");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("stops after three attempts", async () => {
    const error = databaseError("P2034");
    const operation = vi.fn().mockRejectedValue(error);
    await expect(retryTransaction(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not hide unrelated constraint failures", async () => {
    const error = databaseError("P2002");
    await expect(createOnce(async () => null, async () => { throw error; })).rejects.toBe(error);
  });

  it("does not retry validation failures", async () => {
    const error = new Error("The payment is larger than the current amount owed.");
    const operation = vi.fn().mockRejectedValue(error);
    await expect(retryTransaction(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
