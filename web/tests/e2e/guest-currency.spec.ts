import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

async function signIn(page: Page, loginEmail = email!, loginPassword = password!) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(loginEmail);
  await page.locator("#login-password").fill(loginPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function addExpense(page: Page, description: string, amount: string) {
  await page.getByRole("button", { name: "Add expense", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description", { exact: true }).fill(description);
  await dialog.getByLabel("Amount (USD)", { exact: true }).fill(amount);
  return dialog;
}

function expenseRecord(page: Page, description: string): Locator {
  // History renders a table on computers and cards on phones.
  return page.locator("tr:visible, article:visible").filter({
    has: page.getByText(description, { exact: true })
  }).filter({ hasNot: page.locator("tr") }).last();
}

async function capture(page: Page, state: string, fullPage = true) {
  const directory = path.resolve(process.cwd(), "..", ".impeccable", "review");
  await mkdir(directory, { recursive: true });
  if (fullPage) await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(directory, `${test.info().project.name}-${state}.png`), fullPage, animations: "disabled" });
}

test("guests join, convert expenses and repayments, and recover their own membership", async ({ page, browser }) => {
  test.skip(!email || !password, "Authenticated test-user credentials are required.");
  test.setTimeout(120_000);
  const groupName = `Guest currency ${Date.now()}`;
  const guestName = "Alex Guest";
  const contextOptions = {
    baseURL: test.info().project.use.baseURL,
    viewport: page.viewportSize()
  };
  const contexts = await Promise.all([
    browser.newContext(contextOptions),
    browser.newContext(contextOptions),
    browser.newContext(contextOptions)
  ]);
  const [guestContext, strangerContext, recoveredContext] = contexts;
  try {
    await signIn(page);
    await page.getByRole("button", { name: "New group", exact: true }).click();
    await page.getByLabel("Group name", { exact: true }).fill(groupName);
    await page.getByLabel("Currency", { exact: true }).selectOption("USD");
    await page.getByRole("button", { name: "Create group", exact: true }).click();
    await expect(page.getByRole("heading", { name: groupName, exact: true })).toBeVisible();
    const currentUrl = new URL(page.url());
    const groupUrl = `${currentUrl.origin}${currentUrl.pathname}`;
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Create joining link", exact: true }).click();
    const joiningInput = page.getByLabel("Group joining link", { exact: true });
    await expect(joiningInput).toHaveValue(/\/join\//);
    const joinUrl = await joiningInput.inputValue();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await capture(page, "joining-link-settings");
    await capture(page, "joining-link-settings-viewport", false);

    const guest = await guestContext.newPage();
    await guest.goto(joinUrl);
    await guest.getByLabel("Your name", { exact: true }).fill(guestName);
    expect((await new AxeBuilder({ page: guest }).analyze()).violations).toEqual([]);
    await capture(guest, "guest-join");
    await guest.getByRole("button", { name: "Join group", exact: true }).click();
    await expect(guest.getByRole("heading", { name: groupName, exact: true })).toBeVisible();
    await guest.reload();
    await expect(guest.getByRole("heading", { name: groupName, exact: true })).toBeVisible();

    const stranger = await strangerContext.newPage();
    await stranger.goto(joinUrl);
    await stranger.getByLabel("Your name", { exact: true }).fill(guestName);
    await stranger.getByRole("button", { name: "Join group", exact: true }).click();
    await expect(stranger.getByText(/already.*name|name.*already/i)).toBeVisible();
    await expect(stranger).toHaveURL(/\/join\//);

    // Only the rate response is substituted; membership and financial mutations use the real server.
    await guest.route("**/api/exchange-rate?*", (route) => {
      const query = new URL(route.request().url()).searchParams;
      const from = query.get("from");
      const to = query.get("to");
      return route.fulfill({ json: {
        from, to, rate: from === "USD" ? "0.8" : "1.25",
        rateDate: "2026-10-22", source: "Frankfurter"
      } });
    });
    let dialog = await addExpense(guest, "Foreign guest lunch", "8.00");
    await dialog.getByLabel("Paid by", { exact: true }).selectOption({ label: guestName });
    const guestMemberId = await dialog.getByLabel("Paid by", { exact: true }).inputValue();
    await dialog.getByLabel("Currency", { exact: true }).selectOption("EUR");
    await expect(dialog.getByLabel("Exchange rate: 1 EUR in USD", { exact: true })).toHaveValue("1.25");
    await expect(dialog.getByText("Group amount: $10.00", { exact: true })).toBeVisible();
    await capture(guest, "foreign-expense-dialog");
    await dialog.getByText("Group amount: $10.00", { exact: true }).scrollIntoViewIfNeeded();
    await capture(guest, "foreign-expense-conversion", false);
    expect((await new AxeBuilder({ page: guest }).include('[role="dialog"]').analyze()).violations).toEqual([]);
    await dialog.getByRole("button", { name: "Add expense", exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await page.goto(`${groupUrl}?tab=expenses`);
    const foreignExpense = expenseRecord(page, "Foreign guest lunch");
    await expect(foreignExpense).toContainText("$10.00");
    await expect(foreignExpense).toContainText("€8.00");
    await expect(foreignExpense.getByRole("button", { name: "Edit Foreign guest lunch", exact: true })).toBeVisible();
    await capture(page, "foreign-expense-history");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    dialog = await addExpense(page, "Owner shared dinner", "30.00");
    await dialog.getByRole("button", { name: "Add expense", exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await guest.goto(`${groupUrl}?tab=expenses`);
    const ownerExpense = expenseRecord(guest, "Owner shared dinner");
    await expect(ownerExpense).toBeVisible();
    await expect(ownerExpense.getByRole("button", { name: "Edit Owner shared dinner", exact: true })).toHaveCount(0);
    await expect(ownerExpense.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
    await expect(expenseRecord(guest, "Foreign guest lunch").getByRole("button", { name: "Edit Foreign guest lunch", exact: true })).toBeVisible();

    await guest.getByRole("tab", { name: "Balances", exact: true }).click();
    await expect(guest).toHaveURL(/tab=balances/);
    await expect(guest.getByRole("tabpanel", { name: "Balances", exact: true })).toBeVisible();
    await guest.getByLabel("Also show balances in", { exact: true }).selectOption("EUR");
    await expect(guest.getByText(/Estimates at 1 USD = 0\.8 EUR/)).toBeVisible();
    await expect(guest.getByText("≈ €8.00", { exact: true }).first()).toBeVisible();
    await expect(guest.getByText(/you owe \$10\.00/i)).toBeVisible();
    await guest.reload();
    await expect(guest.getByLabel("Also show balances in", { exact: true })).toHaveValue("EUR");
    await expect(guest.getByText(/Estimates at 1 USD = 0\.8 EUR/)).toBeVisible();
    await capture(guest, "balance-display-currency");
    await guest.getByLabel("Also show balances in", { exact: true }).selectOption("USD");

    // A lookup failure still permits a confirmed manual rate and partial repayment.
    await guest.unroute("**/api/exchange-rate?*");
    await guest.route("**/api/exchange-rate?*", (route) => route.fulfill({ status: 503, json: { message: "Rate unavailable" } }));
    await guest.getByLabel("Also show balances in", { exact: true }).selectOption("EUR");
    await expect(guest.getByText("Conversion is unavailable. Your group balances are still shown below.", { exact: true })).toBeVisible();
    await expect(guest.getByText(/you owe \$10\.00/i)).toBeVisible();
    await guest.getByLabel("Also show balances in", { exact: true }).selectOption("USD");
    await expect(guest.getByRole("button", { name: "Settle", exact: true })).toBeVisible();
    await guest.getByRole("button", { name: "Settle", exact: true }).click();
    dialog = guest.getByRole("dialog");
    await dialog.getByLabel("Currency", { exact: true }).selectOption("EUR");
    await expect(dialog.getByText(/couldn’t load today’s rate/i)).toBeVisible();
    await dialog.getByLabel("Amount (EUR)", { exact: true }).fill("4.00");
    await dialog.getByLabel("Exchange rate: 1 EUR in USD", { exact: true }).fill("1.25");
    await expect(dialog.getByText("Group amount: $5.00", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(guest.getByText(/you owe \$5\.00/i)).toBeVisible();
    await expect(guest.getByText(/Originally €4\.00/)).toBeVisible();

    await page.goto(`${groupUrl}?tab=settings`);
    await page.getByRole("button", { name: "Create private recovery link", exact: true }).click();
    const recoveryInput = page.getByLabel(`Private recovery link for ${guestName}`, { exact: true });
    await expect(recoveryInput).toHaveValue(/\/recover-guest\//);
    const recoveryUrl = await recoveryInput.inputValue();
    const recovered = await recoveredContext.newPage();
    await recovered.goto(recoveryUrl);
    await recovered.getByRole("button", { name: "Recover my guest access", exact: true }).click();
    await expect(recovered.getByRole("heading", { name: groupName, exact: true })).toBeVisible();
    await expect(recovered.getByText(/you owe \$5\.00/i)).toBeVisible();
    const recoveredCredential = (await recoveredContext.cookies()).find((cookie) => cookie.name === "splittogether-guest");
    expect(recoveredCredential).toBeDefined();
    await guest.goto(groupUrl);
    await expect(guest.getByRole("heading", { name: groupName, exact: true })).not.toBeVisible();
    await stranger.goto(recoveryUrl);
    await expect(stranger.getByRole("heading", { name: "This recovery link is no longer active", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Replace joining link", exact: true }).click();
    await expect(page.getByLabel("Group joining link", { exact: true })).not.toHaveValue(joinUrl);
    await stranger.goto(joinUrl);
    await expect(stranger.getByRole("heading", { name: "This joining link is no longer active", exact: true })).toBeVisible();

    if (process.env.E2E_LOCAL_SERVICES === "true" && process.env.E2E_GUEST_EMAIL && process.env.E2E_GUEST_PASSWORD) {
      // An owner account already in the group must not absorb a second guest membership.
      await page.context().addCookies([recoveredCredential!]);
      await page.goto("/account");
      await page.getByRole("button", { name: "Link my guest records", exact: true }).click();
      await expect(page.getByText(/account already has a membership or invitation/i)).toBeVisible();
      await recovered.reload();
      await expect(recovered.getByRole("heading", { name: groupName, exact: true })).toBeVisible();

      await signIn(recovered, process.env.E2E_GUEST_EMAIL, process.env.E2E_GUEST_PASSWORD);
      await recovered.goto("/account");
      await recovered.getByRole("button", { name: "Link my guest records", exact: true }).click();
      // Successful linking refreshes this page and removes the guest-only card.
      // Check that durable result rather than its brief message before refresh.
      await expect(recovered.getByRole("heading", { name: "Keep your guest records", exact: true })).not.toBeVisible();
      await expect.poll(async () => (await recoveredContext.cookies()).find((cookie) => cookie.name === "splittogether-guest")).toBeUndefined();
      await recovered.goto(groupUrl);
      await expect(recovered.getByRole("heading", { name: groupName, exact: true })).toBeVisible();
      await expect(recovered.getByText(/you owe \$5\.00/i)).toBeVisible();
      await recovered.getByRole("button", { name: "Add expense", exact: true }).first().click();
      await expect(recovered.getByRole("dialog").getByRole("option", { name: guestName, exact: true })).toHaveAttribute("value", guestMemberId);
      await recovered.getByRole("button", { name: "Close dialog", exact: true }).click();
      await strangerContext.addCookies([recoveredCredential!]);
      await stranger.goto(groupUrl);
      await expect(stranger.getByRole("heading", { name: groupName, exact: true })).not.toBeVisible();
      await strangerContext.clearCookies();
      // The newly linked account can return from a browser without the guest cookie.
      await signIn(stranger, process.env.E2E_GUEST_EMAIL, process.env.E2E_GUEST_PASSWORD);
      await stranger.goto(groupUrl);
      await expect(stranger.getByRole("heading", { name: groupName, exact: true })).toBeVisible();
      await expect(stranger.getByText(/you owe \$5\.00/i)).toBeVisible();
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
