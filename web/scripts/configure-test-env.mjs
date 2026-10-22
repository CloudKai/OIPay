import { readFileSync, appendFileSync } from "node:fs";
import { parse } from "dotenv";
import { randomBytes } from "node:crypto";

// Read local CLI output without printing credentials to the CI log.
const values = parse(readFileSync(process.argv[2], "utf8"));
const mapping = {
  DATABASE_URL: values.DB_URL,
  DIRECT_DATABASE_URL: values.DB_URL,
  NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: values.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  SUPABASE_SECRET_KEY: values.SERVICE_ROLE_KEY,
  E2E_LOCAL_SERVICES: "true",
  E2E_REQUIRE_AUTH: "true",
  EMAIL_DELIVERY_MODE: "disabled",
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
  CRON_SECRET: randomBytes(32).toString("hex"),
  AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex")
};
for (const [key, port] of [["DATABASE_URL", "54322"], ["NEXT_PUBLIC_SUPABASE_URL", "54321"]]) {
  const url = new URL(mapping[key]);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== port) {
    throw new Error("Expected isolated local Supabase test services.");
  }
}
for (const [name, value] of Object.entries(mapping)) {
  if (!value || /[\r\n]/.test(value)) throw new Error(`Missing or invalid local test setting: ${name}`);
}
const destination = process.env.GITHUB_ENV ?? ".env.e2e.local";
appendFileSync(destination, Object.entries(mapping).map(([name, value]) => `${name}=${value}\n`).join(""), { mode: 0o600 });
console.log("Configured isolated database and authentication settings for tests.");
