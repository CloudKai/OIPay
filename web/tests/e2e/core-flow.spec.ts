import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const e2eEmail = process.env.E2E_USER_EMAIL;
const e2ePassword = process.env.E2E_USER_PASSWORD;

if (process.env.E2E_REQUIRE_AUTH === "true" && (!e2eEmail || !e2ePassword)) {
  throw new Error("Required authenticated browser tests have no test-user credentials.");
}

test("protected pages redirect and authentication is accessible", async ({
  page
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("seeded user can create a group and split an expense", async ({ page }) => {
  test.skip(
    !e2eEmail || !e2ePassword,
    "Set E2E_USER_EMAIL and E2E_USER_PASSWORD for the authenticated flow."
  );

  const unique = Date.now().toString();
  const groupName = `Playwright trip ${unique}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(e2eEmail!);
  await page.locator("#login-password").fill(e2ePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill(groupName);
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: groupName })).toBeVisible();

  await page.getByRole("button", { name: "Invite member" }).first().click();
  await page.getByLabel("Display name").fill("Pending Friend");
  await page.getByLabel("Email").last().fill(`pending-${unique}@example.com`);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add expense" }).first().click();
  await page.getByLabel("Description").fill("Shared lunch");
  await page.getByLabel("Amount (USD)").fill("10.01");
  await page.getByRole("button", { name: "Add expense" }).last().click();
  await page.getByRole("tab", { name: "Expenses" }).click();
  const expensesPanel = page.getByRole("tabpanel", { name: "Expenses" });
  await expect(expensesPanel).toContainText("Shared lunch");
  await expect(expensesPanel).toContainText("$10.01");

  await page.getByRole("tab", { name: "Balances" }).click();
  await expect(page.getByText("Simplified payments")).toBeVisible();
  await expect(page.getByRole("button", { name: "Settle" })).toBeVisible();
  await page.getByRole("button", { name: "Settle", exact: true }).click();
  const paymentDialog = page.getByRole("dialog");
  await paymentDialog.getByLabel("Amount (USD)").fill("2.00");
  await paymentDialog.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(paymentDialog).not.toBeVisible();
  await expect(page.getByText("$2.00", { exact: true })).toBeVisible();
});

test("offline fallback explains that financial data is not cached", async ({
  page
}) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await expect(page.getByText(/never caches private group data/i)).toBeVisible();
});
