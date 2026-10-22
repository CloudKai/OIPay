import { describe, expect, it } from "vitest";

import { SubmissionKeys } from "./submission-key";

describe("submission retries", () => {
  it("reuses the key after a lost response, including after editing and reverting", () => {
    const keys = new SubmissionKeys();
    const first = keys.forPayload({ totalMinor: 100, description: "Lunch" });
    expect(keys.forPayload({ totalMinor: 100, description: "Lunch" })).toBe(first);
    expect(keys.forPayload({ totalMinor: 200, description: "Lunch" })).not.toBe(first);
    expect(keys.forPayload({ totalMinor: 100, description: "Lunch" })).toBe(first);
  });

  it("allows a separate identical expense after a confirmed save", () => {
    const keys = new SubmissionKeys();
    const first = keys.forPayload({ amountMinor: 100 });
    keys.clear();
    expect(keys.forPayload({ amountMinor: 100 })).not.toBe(first);
  });
});
