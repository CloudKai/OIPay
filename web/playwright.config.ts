import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env.e2e.local", quiet: true });

const testBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html"], ["github"]] : "list",
  use: {
    baseURL: testBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    }
  ],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER
    ? undefined
    : {
        command: process.env.E2E_PRODUCTION === "true"
          ? "npm run start -- --hostname 127.0.0.1 --port 3100"
          : "npm run dev -- --hostname 127.0.0.1 --port 3100",
        url: `${testBaseUrl}/login`,
        env: {
          NEXT_PUBLIC_SITE_URL: testBaseUrl,
          NEXT_DIST_DIR: process.env.E2E_PRODUCTION === "true" ? ".next" : ".next-e2e"
        },
        reuseExistingServer: false,
        timeout: 120_000
      }
});
