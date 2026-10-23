import { expect, it } from "vitest";
import { databaseConnectionDiagnostics } from "./database-diagnostics";

const api = "https://expectedproject.supabase.co";

it("distinguishes a matching shared-pooler target from another project", () => {
  const matching = databaseConnectionDiagnostics("postgresql://postgres.expectedproject:privatevalue@aws-0-region.pooler.supabase.com:6543/postgres", api);
  expect(matching).toMatchObject({ endpoint: "supabase-pooler", connectionMode: "transaction", username: "project-postgres", projectMatches: true, passwordPresent: true });
  expect(databaseConnectionDiagnostics("postgresql://postgres.otherproject:privatevalue@aws-0-region.pooler.supabase.com:6543/postgres", api)).toMatchObject({ projectMatches: false, username: "other" });
});

it("never includes credentials or arbitrary URL content, even in the wrong fields", () => {
  for (const value of [
    "postgresql://postgres.expectedproject:NeverLogThis@aws-0-region.pooler.supabase.com:6543/postgres?secret=NeverLogThis",
    "postgresql://NeverLogThis:password@NeverLogThis.example:5432/NeverLogThis#NeverLogThis",
    "postgresql://user:NeverLogThis%ZZ@host/db",
    "NeverLogThis"
  ]) {
    const result = JSON.stringify(databaseConnectionDiagnostics(value, api));
    expect(result).not.toContain("NeverLogThis");
    expect(result).not.toContain("privatevalue");
    expect(result).not.toContain("postgresql://");
  }
});

it("flags placeholders and whitespace without reporting the password", () => {
  expect(databaseConnectionDiagnostics("postgresql://postgres:%5BYOUR-PASSWORD%5D@db.expectedproject.supabase.co/postgres", api)).toMatchObject({ passwordPlaceholder: true, projectMatches: true });
  expect(databaseConnectionDiagnostics("postgresql://postgres:%20privatevalue%20@db.expectedproject.supabase.co/postgres", api)).toMatchObject({ passwordWhitespace: true });
  expect(databaseConnectionDiagnostics()).toEqual({ urlFormat: "missing" });
});
