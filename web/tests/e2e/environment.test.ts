import { expect, it } from "vitest";
import { assertLocalE2eServices } from "./environment";

const local = {
  E2E_LOCAL_SERVICES: "true",
  DATABASE_URL: "postgresql://test:test@127.0.0.1:54322/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321"
};

it("permits test-user provisioning only on the dedicated local services", () => {
  expect(() => assertLocalE2eServices(local)).not.toThrow();
  expect(() => assertLocalE2eServices({ ...local, E2E_LOCAL_SERVICES: "false" })).toThrow();
  expect(() => assertLocalE2eServices({ ...local, DATABASE_URL: "postgresql://test:test@localhost:5433/app" })).toThrow();
  expect(() => assertLocalE2eServices({ ...local, NEXT_PUBLIC_SUPABASE_URL: "https://shared.supabase.co" })).toThrow();
});
