const { chromium, devices } = require('playwright');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const baseUrl = 'http://127.0.0.1:3001';
  const unique = Date.now();
  const testUser = {
    name: 'Flow Tester',
    email: `flow.${unique}@example.com`,
    password: 'password123'
  };
  const roomName = `Flow Room ${unique}`;
  const mobileRoomName = `Mobile Room ${unique}`;

  const browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();

  await page.goto(`${baseUrl}/dashboard`);
  await page.waitForURL((url) => url.pathname.endsWith('/login'));
  assert(page.url().includes('/login'), 'Unauthorized /dashboard should redirect to /login');

  await page.goto(`${baseUrl}/signup`);
  await page.locator('#signup-name').fill('AA');
  await page.locator('#signup-email').fill('bad-email');
  await page.locator('#signup-password').fill(testUser.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByText('Please enter a valid email address.').waitFor();

  await page.locator('#signup-name').fill(testUser.name);
  await page.locator('#signup-email').fill(testUser.email);
  await page.locator('#signup-password').fill(testUser.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/dashboard');
  await page.getByText('Create a new room').waitFor();

  await page.getByPlaceholder('Thailand Food Trip').fill('  ');
  await page.getByRole('button', { name: 'Create room' }).click();
  await page.getByText('Group name must be at least 2 characters.').waitFor();

  await page.getByPlaceholder('Thailand Food Trip').fill(roomName);
  await page.getByRole('button', { name: 'Create room' }).click();
  await page.waitForURL('**/groups/**');
  await page.getByRole('heading', { name: roomName }).waitFor();

  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await page.waitForURL((url) => url.pathname.endsWith('/login'));

  await page.goto(`${baseUrl}/dashboard`);
  await page.waitForURL((url) => url.pathname.endsWith('/login'));
  assert(page.url().includes('/login'), 'Unauthorized /dashboard redirect after signout failed');

  await page.locator('#login-email').fill(testUser.email);
  await page.locator('#login-password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByText('Invalid email or password.').waitFor();

  await page.locator('#login-password').fill(testUser.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard');

  await desktop.close();

  const mobile = await browser.newContext({ ...devices['iPhone 12'] });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${baseUrl}/login`);
  await mobilePage.locator('#login-email').fill(testUser.email);
  await mobilePage.locator('#login-password').fill(testUser.password);
  await mobilePage.getByRole('button', { name: 'Sign In' }).click();
  await mobilePage.waitForURL('**/dashboard');

  await mobilePage.getByPlaceholder('Thailand Food Trip').fill(mobileRoomName);
  await mobilePage.getByRole('button', { name: 'Create room' }).click();
  await mobilePage.waitForURL('**/groups/**');
  await mobilePage.getByRole('heading', { name: mobileRoomName }).waitFor();

  await mobile.close();
  await browser.close();

  console.log(`OK: desktop+mobile flow passed for ${testUser.email}`);
})();
