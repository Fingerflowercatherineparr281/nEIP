/**
 * auth.spec.ts — Login form, wrong password, logout.
 *
 * NOTE: This spec file intentionally clears localStorage before each UI
 * login test so we exercise the actual login form rather than being
 * auto-authenticated by the storageState.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, CREDENTIALS, SCREENSHOTS_DIR } from './helpers/auth';

// ---------------------------------------------------------------------------
// Helper — clears auth from localStorage so the login form is shown
// ---------------------------------------------------------------------------

async function clearAuth(page: import('@playwright/test').Page) {
  // Navigate to app root to establish the origin
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.removeItem('neip-auth-token');
    localStorage.removeItem('neip-auth');
    localStorage.removeItem('neip-refresh-token');
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Authentication', () => {
  test('login form renders with expected elements', async ({ page }) => {
    await clearAuth(page);
    await page.goto(`${BASE_URL}/login`);

    await expect(page.locator('h1')).toContainText('Welcome to nEIP');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/auth-login-page.png`, fullPage: true });
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await clearAuth(page);
    await page.goto(`${BASE_URL}/login`);

    await page.fill('#email', CREDENTIALS.email);
    await page.fill('#password', CREDENTIALS.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 45000 });
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/auth-login-success.png`, fullPage: true });
  });

  test('login with wrong password shows error message', async ({ page }) => {
    await clearAuth(page);
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('#email', { timeout: 15000 });

    await page.fill('#email', CREDENTIALS.email);
    await page.fill('#password', 'WrongPassword999!');
    await page.click('button[type="submit"]');

    // Wait up to 8 seconds for the error to appear — API round-trip may be slow
    // InlineAlert renders a div[role="alert"] with the error text
    let isVisible = false;
    const errorDeadline = Date.now() + 8000;
    while (Date.now() < errorDeadline) {
      isVisible = await page.locator('[role="alert"]').first().isVisible().catch(() => false);
      if (isVisible) break;
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/auth-login-error.png`, fullPage: true });

    // We must still be on /login (not redirected to dashboard)
    expect(page.url()).toContain('/login');
    // The error div must be visible
    expect(isVisible).toBe(true);
  });

  test('logout redirects to login page', async ({ page }) => {
    // Navigate to dashboard (storageState provides auth)
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const spinning = await page.locator('.animate-spin').isVisible().catch(() => false);
      if (!spinning) break;
      await page.waitForTimeout(300);
    }
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`);

    // The sidebar UserMenu button has aria-label="User menu / Sign out"
    // and directly calls logout() — no dropdown needed
    const userMenuBtn = page.locator('[aria-label="User menu / Sign out"]').first();
    await expect(userMenuBtn).toBeVisible({ timeout: 10000 });
    await userMenuBtn.click();

    await page.waitForURL(`${BASE_URL}/login`, { timeout: 25000 });
    await expect(page).toHaveURL(`${BASE_URL}/login`);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/auth-logout.png`, fullPage: true });
  });
});
