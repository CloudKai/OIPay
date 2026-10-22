import { describe, expect, it } from "vitest";

import {
  safeLocalRedirectPath,
  safeRedirectPath
} from "@/lib/navigation";

describe("safeRedirectPath", () => {
  const origin = "https://splittogether.example";

  it("accepts local paths", () => {
    expect(safeRedirectPath("/groups/123?tab=expenses", origin)).toBe(
      "/groups/123?tab=expenses"
    );
  });

  it("accepts same-origin absolute URLs", () => {
    expect(
      safeRedirectPath(
        "https://splittogether.example/reset-password?from=email",
        origin
      )
    ).toBe("/reset-password?from=email");
  });

  it("rejects protocol-relative and external redirects", () => {
    expect(safeRedirectPath("//attacker.example", origin)).toBe("/dashboard");
    expect(
      safeRedirectPath("https://attacker.example/steal", origin)
    ).toBe("/dashboard");
  });

  it("parses callback paths without needing an origin", () => {
    expect(safeLocalRedirectPath("/dashboard?view=recent")).toBe(
      "/dashboard?view=recent"
    );
    expect(safeLocalRedirectPath("//attacker.example")).toBeNull();
  });
});
