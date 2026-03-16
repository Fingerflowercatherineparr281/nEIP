import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3100';

test.describe('nEIP Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'admin@neip.app');
    await page.fill('input[type="password"]', 'SecurePass12345');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  const pages = [
    ['/dashboard', 'Dashboard'],
    ['/accounts', 'Accounts'],
    ['/invoices', 'Invoices'],
    ['/bills', 'Bills'],
    ['/payments', 'Payments'],
    ['/journal-entries', 'Journal'],
    ['/quotations', 'Quotations'],
    ['/contacts', 'Contacts'],
    ['/vendors', 'Vendors'],
    ['/products', 'Products'],
    ['/employees', 'Employees'],
    ['/reports', 'Reports'],
    ['/settings', 'Settings'],
  ];

  for (const [path, name] of pages) {
    test(`${name} page loads with content`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      
      // Should NOT show error page
      const hasError = await page.locator('text=Something went wrong').isVisible().catch(() => false);
      expect(hasError).toBe(false);
      
      // Should NOT be stuck on login
      expect(page.url()).not.toContain('/login');
      
      // Should have some content (not just spinner)
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(50);
      
      // Take screenshot
      await page.screenshot({ path: `test-results/smoke-${name.toLowerCase()}.png`, fullPage: true });
    });
  }
});
