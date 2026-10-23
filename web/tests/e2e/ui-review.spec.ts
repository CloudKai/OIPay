import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("neutral interface stays accessible and fits public and account screens", async ({ page }) => {
  test.setTimeout(120_000);
  const directory = path.resolve(process.cwd(), "..", ".impeccable", "review", "neutral");
  await mkdir(directory, { recursive: true });
  async function capture(name: string, target: Page = page) {
    await expect(target.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(target).toHaveTitle(/OIPay/);
    await expect(target.getByRole("link", { name: "OIPay", exact: true }).first()).toBeVisible();
    expect(await target.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page: target }).analyze()).violations).toEqual([]);
    await target.evaluate(() => window.scrollTo(0, 0));
    await target.screenshot({ path: path.join(directory, `${test.info().project.name}-${name}.png`), fullPage: true, animations: "disabled" });
  }
  for (const route of ["login", "signup", "forgot-password", "demo"]) {
    await page.goto(`/${route}`);
    await capture(route);
  }
  for (const tab of ["Expenses", "Balances", "Settings"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await capture(`demo-${tab.toLowerCase()}`);
  }
  await page.getByRole("button", { name: "Add expense", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
  await page.screenshot({ path: path.join(directory, `${test.info().project.name}-expense-form.png`), animations: "disabled" });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();

  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) throw new Error("Account credentials are required to verify all redesigned screens.");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  for (const route of ["dashboard", "groups", "activity", "account"]) {
    await page.goto(`/${route}`);
    await capture(route);
  }
  if (test.info().project.name === "desktop") {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto("/dashboard");
    await capture("tablet-dashboard");
  }
});
