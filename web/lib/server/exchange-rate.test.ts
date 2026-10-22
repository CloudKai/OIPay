import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { lookupExchangeRate } from "./exchange-rate";

const now = new Date("2026-10-22T12:00:00.000Z");
const quote = { date: "2026-10-22", base: "JPY", quote: "SGD", rate: 0.00809 };

afterEach(() => vi.unstubAllGlobals());

describe("daily exchange-rate lookup", () => {
  it("fetches the entry day and preserves the publication day", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...quote, date: "2026-10-21" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await lookupExchangeRate("JPY", "SGD", now)).toEqual({
      from: "JPY", to: "SGD", rate: "0.00809", rateDate: "2026-10-21", requestedDate: "2026-10-22", source: "Frankfurter"
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.frankfurter.dev/v2/rate/jpy/sgd?date=2026-10-22");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ next: { revalidate: 900 }, signal: expect.any(AbortSignal) });
  });

  it("expands small provider rates before exact conversion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...quote, rate: 1.25e-7 }))));
    expect((await lookupExchangeRate("JPY", "SGD", now)).rate).toBe("0.000000125");
  });

  it.each([
    { ...quote, date: "2026-10-10" },
    { ...quote, date: "2026-10-23" },
    { ...quote, date: "2026-02-30" },
    { ...quote, base: "USD" },
    { ...quote, rate: 0 },
    { ...quote, rate: "0.00809" }
  ])("offers manual entry for invalid or stale provider data: %j", async (data) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
    await expect(lookupExchangeRate("JPY", "SGD", now)).rejects.toThrow(/Enter the exchange rate/);
  });

  it("offers manual entry after provider timeout or failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timed out")));
    await expect(lookupExchangeRate("JPY", "SGD", now)).rejects.toThrow(/Enter the exchange rate/);
  });
});
