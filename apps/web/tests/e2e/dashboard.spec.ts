/**
 * dashboard.spec.ts
 * Dashboard: greeting, date, metric cards, quick actions.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, SCREENSHOTS_DIR, reinjectAuth } from './helpers/auth';

async function visitDashboard(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

  // If spinner persists after 40s, re-inject auth
  const quickDeadline = Date.now() + 40000;
  let cleared = false;
  while (Date.now() < quickDeadline) {
    const spinning = await page.locator('.animate-spin').isVisible().catch(() => false);
    if (!spinning) { cleared = true; break; }
    await page.waitForTimeout(300);
  }
  if (!cleared) {
    await reinjectAuth(page, '/dashboard');
  }

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const spinning = await page.locator('.animate-spin').isVisible().catch(() => false);
    if (!spinning) break;
    await page.waitForTimeout(300);
  }
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

test.describe('Dashboard', () => {
  test('dashboard shows greeting and current date', async ({ page }) => {
    await visitDashboard(page);

    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
    const h1Text = await h1.textContent();
    expect(h1Text).toBeTruthy();
    expect(h1Text!.length).toBeGreaterThan(0);

    const dateEl = page.locator('p.text-sm').first();
    await expect(dateEl).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/dashboard-greeting.png`, fullPage: true });
  });

  test('dashboard shows all metric cards', async ({ page }) => {
    await visitDashboard(page);

    await expect(page.locator('text=Total Revenue').first()).toBeVisible({ timeout: 15000 });

    const labels = [
      'Total Revenue', // matches "Total Revenue (MTD)" via partial text
      'Total Expenses',
      'Net Income',
      'Outstanding AR',
      'Pending Approvals',
    ];
    for (const label of labels) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('quick action buttons are visible', async ({ page }) => {
    await visitDashboard(page);

    const heading = page.locator('h2:has-text("Quick Actions")');
    await expect(heading).toBeVisible({ timeout: 10000 });

    const buttons = page.locator(
      'h2:has-text("Quick Actions") ~ div button, h2:has-text("Quick Actions") ~ div a',
    );
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/dashboard.png`, fullPage: true });
  });

  test('no error state on dashboard', async ({ page }) => {
    await visitDashboard(page);
    const errorText = await page.locator('text=Something went wrong').isVisible().catch(() => false);
    expect(errorText).toBe(false);
  });
});
