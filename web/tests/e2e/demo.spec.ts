import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("guest demo changes expenses and payments locally, survives refresh, and resets", async ({ page, context }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
      new URL(request.url()).origin === new URL(page.url()).origin &&
      !request.url().includes("/_vercel/")) writes.push(request.url());
  });
  await page.goto("/login");
  const cookiesBefore = await context.cookies();
  await page.getByRole("link", { name: "Try demo as a guest" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("heading", { name: "Weekend in Singapore", exact: true })).toBeVisible();
  await expect(page.getByText(/3 members · you owe.*10\.00/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const directory = path.resolve(process.cwd(), "..", ".impeccable", "review");
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${test.info().project.name}-demo-overview.png`), fullPage: true, animations: "disabled" });

  await page.getByRole("button", { name: "Add expense", exact: true }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description", { exact: true }).fill("Demo coffee");
  await dialog.getByLabel("Amount (SGD)", { exact: true }).fill("12.00");
  await dialog.getByRole("button", { name: "Add expense", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(/3 members · you owe.*2\.00/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Demo coffee", { exact: true })).toBeVisible();
  await expect(page.getByText(/3 members · you owe.*2\.00/)).toBeVisible();

  await page.getByRole("tab", { name: "Expenses", exact: true }).click();
  await page.getByRole("button", { name: "Edit Demo coffee", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (SGD)", { exact: true }).fill("15.00");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("3 members · you are settled up", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search expenses", exact: true }).fill("Demo coffee");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByText("1 of 1 matching expenses", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(directory, `${test.info().project.name}-demo-expenses.png`), fullPage: true, animations: "disabled" });

  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page.getByText(/3 members · you owe.*10\.00/)).toBeVisible();
  await expect(page.getByText("Demo coffee", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Debt to settle", { exact: true }).selectOption("demo-you:demo-maya");
  await dialog.getByLabel("Amount (SGD)", { exact: true }).fill("5.00");
  await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(/3 members · you owe.*5\.00/)).toBeVisible();
  await expect(page.getByText("You paid Maya", { exact: true })).toBeVisible();

  await page.getByLabel("Also show balances in", { exact: true }).selectOption("EUR");
  await expect(page.getByText(/Sample demo rate/)).toBeVisible();
  await page.getByRole("button", { name: "Add expense", exact: true }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description", { exact: true }).fill("Demo foreign lunch");
  await dialog.getByLabel("Currency", { exact: true }).selectOption("EUR");
  await dialog.getByLabel("Amount (EUR)", { exact: true }).fill("10.00");
  await expect(dialog.getByText(/Demo rates are illustrative, not live/)).toBeVisible();
  await expect(dialog.getByText(/Group amount:.*15\.00/)).toBeVisible();
  await dialog.getByRole("button", { name: "Add expense", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(page.getByText("You added Demo foreign lunch", { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  expect((await context.cookies()).filter((cookie) => cookie.name.includes("guest"))).toEqual(
    cookiesBefore.filter((cookie) => cookie.name.includes("guest"))
  );
  await page.getByRole("link", { name: "Exit demo", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("demo recovers from damaged browser storage without granting group access", async ({ page }) => {
  await page.goto("/demo");
  await page.evaluate(() => sessionStorage.setItem("splittogether:demo:v1", '{"expenses":[{}]}'));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Weekend in Singapore", exact: true })).toBeVisible();
  await expect(page.getByText(/3 members · you owe.*10\.00/)).toBeVisible();
  await page.goto("/groups/demo-weekend");
  await expect(page).toHaveURL(/\/login\?callbackURL=/);
});
