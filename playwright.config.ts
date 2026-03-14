import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 *
 * E2E tests live in apps/web/e2e/ (and other apps as needed).
 * Architecture reference: AR25 — Playwright for E2E testing.
 */
export default defineConfig({
  // Directory where E2E test files live
  testDir: './apps/web/e2e',

  // Run tests inside each file in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: Boolean(process.env['CI']),

  // Retry on CI only
  retries: process.env['CI'] ? 2 : 0,

  // Limit parallelism on CI
  workers: process.env['CI'] ? 1 : undefined,

  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  use: {
    // Base URL for the web app under test
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:3000',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // Start the web dev server before running E2E tests locally
  // webServer is intentionally left out — start apps manually or in CI via a separate step.
});
