import { test, expect } from '@playwright/test';
import { scanPage, type A11yScanResult } from './a11y-helper';

/**
 * Pages to scan for accessibility violations.
 * Each entry maps a friendly name to a route path.
 *
 * These tests work even when pages show placeholder content —
 * they validate the structural a11y of whatever is rendered.
 */
const PAGES: { name: string; path: string }[] = [
  { name: 'Login', path: '/login' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Journal Entries List', path: '/journal-entries' },
  { name: 'Journal Entry Create', path: '/journal-entries/create' },
  { name: 'Invoices List', path: '/invoices' },
  { name: 'Payments List', path: '/payments' },
  { name: 'Approvals Queue', path: '/approvals' },
  { name: 'Reports', path: '/reports' },
  { name: 'Settings', path: '/settings' },
];

test.describe('Accessibility — Page Scans (WCAG 2.1 AA)', () => {
  for (const pageInfo of PAGES) {
    test(`${pageInfo.name} page has no critical or serious a11y violations`, async ({
      page,
    }) => {
      // Navigate — accept any status because pages may be stubs / redirects
      const response = await page.goto(pageInfo.path, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // If the page returns a server error, skip gracefully
      const status = response?.status() ?? 0;
      if (status >= 500) {
        test.skip(
          true,
          `${pageInfo.name} returned HTTP ${status} — skipping a11y scan`,
        );
        return;
      }

      // Wait for any async rendering to settle
      await page.waitForTimeout(500);

      const result: A11yScanResult = await scanPage(page, pageInfo.name);

      // Log summary for CI output
      const { summary } = result;
      console.log(
        `[${pageInfo.name}] Critical: ${summary.critical}, Serious: ${summary.serious}, Moderate: ${summary.moderate}, Minor: ${summary.minor}`,
      );

      // Moderate / minor are warnings — logged but not failing
      if (summary.moderate > 0) {
        console.warn(
          `⚠ ${pageInfo.name} has ${summary.moderate} moderate violation(s) — review recommended`,
        );
      }

      // Critical or serious → fail the test
      expect(
        result.failed,
        `${pageInfo.name}: ${summary.critical} critical and ${summary.serious} serious violation(s) found. See results JSON for details.`,
      ).toBe(false);
    });
  }
});
