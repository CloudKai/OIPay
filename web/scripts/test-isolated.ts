import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { assertLocalE2eServices } from "../tests/e2e/environment";

config({ path: ".env.e2e.local", quiet: true });
assertLocalE2eServices(process.env);
for (const script of ["prisma:deploy", "test", "test:e2e"]) {
  const result = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    env: { ...process.env, RUN_DATABASE_TESTS: "true", E2E_REQUIRE_AUTH: "true" }
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
