import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3100';

test.describe('nEIP Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'admin@neip.app');
    await page.fill('input[type="password"]', 'SecurePass12345');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  const pages: [string, string][] = [
    ['/dashboard', 'Dashboard'],
    ['/accounts', 'Accounts'],
    ['/invoices', 'Invoices'],
    ['/bills', 'Bills'],
    ['/payments', 'Payments'],
    ['/journal-entries', 'Journal Entries'],
    ['/quotations', 'Quotations'],
    ['/contacts', 'Contacts'],
    ['/vendors', 'Vendors'],
    ['/products', 'Products'],
    ['/employees', 'Employees'],
    ['/sales-orders', 'Sales Orders'],
    ['/delivery-notes', 'Delivery Notes'],
    ['/receipts', 'Receipts'],
    ['/credit-notes', 'Credit Notes'],
    ['/purchase-orders', 'Purchase Orders'],
    ['/fixed-assets', 'Fixed Assets'],
    ['/bank', 'Bank'],
    ['/wht', 'WHT'],
    ['/budgets', 'Budgets'],
    ['/cost-centers', 'Cost Centers'],
    ['/profit-centers', 'Profit Centers'],
    ['/inventory', 'Inventory'],
    ['/departments', 'Departments'],
    ['/payroll', 'Payroll'],
    ['/leave', 'Leave'],
    ['/reports', 'Reports'],
    ['/settings', 'Settings'],
    ['/settings/tax', 'Tax Rates'],
    ['/settings/audit', 'Audit Log'],
  ];

  for (const [path, name] of pages) {
    test(`${name} (${path})`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20000 });
      const error = await page.locator('text=Something went wrong').isVisible().catch(() => false);
      expect(error, `${name} shows error`).toBe(false);
      expect(page.url()).not.toContain('/login');
      await page.screenshot({ path: `test-results/smoke-${name.toLowerCase().replace(/\s+/g,'-')}.png`, fullPage: true });
    });
  }
});
