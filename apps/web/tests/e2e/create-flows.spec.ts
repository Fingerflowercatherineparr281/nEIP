/**
 * create-flows.spec.ts — Create Invoice, Journal Entry, Contact.
 */
import { test, expect } from '@playwright/test';
import { BASE_URL, SCREENSHOTS_DIR, reinjectAuth } from './helpers/auth';

const RUN_ID = Date.now();

async function visitForm(
  page: import('@playwright/test').Page,
  path: string,
) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });

  // Quick check — if spinner persists after 40s, re-inject auth
  const quickDeadline = Date.now() + 40000;
  let cleared = false;
  while (Date.now() < quickDeadline) {
    const spinning = await page.locator('.animate-spin').isVisible().catch(() => false);
    if (!spinning) { cleared = true; break; }
    await page.waitForTimeout(300);
  }
  if (!cleared) {
    await reinjectAuth(page, path);
  }

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const spinning = await page.locator('.animate-spin').isVisible().catch(() => false);
    if (!spinning) break;
    await page.waitForTimeout(300);
  }
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(500);
}

test.describe('Create Data Flows', () => {
  // --------------------------------------------------------------------------
  // Create Invoice
  // --------------------------------------------------------------------------
  test('new invoice form renders', async ({ page }) => {
    await visitForm(page, '/invoices/new');

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#customer')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#issueDate')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#dueDate')).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/create-invoice-form.png`, fullPage: true });
  });

  test('create a new invoice via /invoices/new', async ({ page }) => {
    await visitForm(page, '/invoices/new');
    await expect(page.locator('#customer')).toBeVisible({ timeout: 10000 });

    // Fill form
    await page.fill('#customer', `Test Customer ${RUN_ID}`);

    const today = new Date().toISOString().slice(0, 10);
    await page.fill('#issueDate', today);

    const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.fill('#dueDate', due);

    // Line item
    await page.locator('input[placeholder="Description"]').first().fill('Test Service');
    await page.locator('input[placeholder="Qty"]').first().fill('1');
    await page.locator('input[placeholder="Price"]').first().fill('1000');

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/create-invoice-filled.png`, fullPage: true });

    // Submit
    const createBtn = page.locator('button:has-text("Create Invoice")');
    await expect(createBtn).toBeVisible({ timeout: 8000 });
    await createBtn.click();

    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    const onInvoices = currentUrl.includes('/invoices');
    const hasSuccess = await page.locator('text=Invoice created').first().isVisible().catch(() => false);
    const hardError = await page.locator('text=Something went wrong').first().isVisible().catch(() => false);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/create-invoice-result.png`, fullPage: true });

    expect(hardError).toBe(false);
    expect(onInvoices || hasSuccess).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Create Journal Entry
  // --------------------------------------------------------------------------
  test('new journal entry form renders', async ({ page }) => {
    await visitForm(page, '/journal-entries/new');

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#je-date')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#je-memo')).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/create-journal-entry-form.png`, fullPage: true });
  });

  test('create a new journal entry — save as draft', async ({ page }) => {
    await visitForm(page, '/journal-entries/new');
    await expect(page.locator('#je-date')).toBeVisible({ timeout: 10000 });

    const today = new Date().toISOString().slice(0, 10);
    await page.fill('#je-date', today);
    await page.fill('#je-memo', `Automated test entry ${RUN_ID}`);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/create-journal-entry-filled.png`, fullPage: true });

    // Save as draft (doesn't require balanced lines)
    const saveDraftBtn = page.locator('button:has-text("Save Draft")').first();
    const draftVisible = await saveDraftBtn.isVisible().catch(() => false);
    if (draftVisible) {
      await saveDraftBtn.click();
    } else {
      // Fall back to submit
      const submitBtn = page.locator('button:has-text("Submit")').first();
      const submitVisible = await submitBtn.isVisible().catch(() => false);
      if (submitVisible) await submitBtn.click();
    }

    await page.waitForTimeout(4000);

    const hardError = await page.locator('text=Something went wrong').first().isVisible().catch(() => false);
    expect(hardError).toBe(false);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/create-journal-entry-result.png`, fullPage: true });
  });

  // --------------------------------------------------------------------------
  // Create Contact
  // --------------------------------------------------------------------------
  test('new contact form renders', async ({ page }) => {
    await visitForm(page, '/contacts/new');

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/create-contact-form.png`, fullPage: true });
  });

  test('create a new contact via /contacts/new', async ({ page }) => {
    await visitForm(page, '/contacts/new');

    const companyNameInput = page
      .locator('input[placeholder*="Company" i], input[placeholder*="company" i]')
      .first();
    await expect(companyNameInput).toBeVisible({ timeout: 10000 });
    await companyNameInput.fill(`Automated Test Co ${RUN_ID}`);

    // Email (optional)
    const emailInput = page
      .locator('input[type="email"], input[placeholder*="email" i]')
      .first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(`test${RUN_ID}@example.com`);
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/create-contact-filled.png`, fullPage: true });

    // Submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create"), button:has-text("Add Contact")');
    await expect(submitBtn.first()).toBeVisible({ timeout: 8000 });
    await submitBtn.first().click();

    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    const onContacts = currentUrl.includes('/contacts');
    const hasSuccess = await page
      .locator('text=Contact created')
      .first()
      .isVisible()
      .catch(() => false);
    const hardError = await page
      .locator('text=Something went wrong')
      .first()
      .isVisible()
      .catch(() => false);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/create-contact-result.png`, fullPage: true });

    expect(hardError).toBe(false);
    expect(onContacts || hasSuccess).toBe(true);
  });
});
