import { describe, expect, it } from "vitest";

import {
  errorLogRecords,
  isDatabaseConnectionError
} from "@/lib/error-reporting";

describe("errorLogRecords", () => {
  it("flattens aggregate errors and preserves error codes", () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED"
    });
    const records = errorLogRecords(
      new AggregateError([refused], "Database attempts failed")
    );

    expect(records).toEqual([
      { name: "AggregateError", message: "Database attempts failed" },
      {
        name: "Error",
        message: "connect ECONNREFUSED",
        code: "ECONNREFUSED"
      }
    ]);
  });

  it("recognizes connection failures without classifying business errors", () => {
    expect(
      isDatabaseConnectionError(
        Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" })
      )
    ).toBe(true);
    expect(isDatabaseConnectionError(new Error("Email already linked"))).toBe(
      false
    );
  });
});
