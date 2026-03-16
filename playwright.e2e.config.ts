import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

/**
 * Playwright E2E configuration for the comprehensive nEIP test suite.
 *
 * Tests live in apps/web/tests/e2e/
 * Server must already be running on port 3100 (web) and 5400 (API).
 */
export default defineConfig({
  testDir: './apps/web/tests/e2e',

  // Sequential execution: Next.js dev server compiles routes on-demand and
  // cannot handle concurrent compilation requests reliably.
  fullyParallel: false,
  workers: 1,

  // Global setup: fetch auth token + save browser storage state
  globalSetup: resolve('./apps/web/tests/e2e/global-setup.ts'),

  // No retries — honest first-run results
  retries: 0,

  forbidOnly: Boolean(process.env['CI']),

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-e2e', open: 'never' }],
    ['json', { outputFile: 'apps/web/test-results/results.json' }],
  ],

  // Per-test timeout: 180 seconds — allows for route compilation (90s) +
  // reinjectAuth overhead (40s) + assertions (20s).
  timeout: 180000,

  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:3100',

    // Restore the authenticated browser state from global-setup.
    // This means every test starts already logged in — no form submission needed.
    storageState: 'apps/web/test-results/.auth-storage-state.json',

    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: process.env['HEADED'] !== '1',
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 90000,
    actionTimeout: 20000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  outputDir: 'apps/web/test-results/playwright-artifacts',
});
