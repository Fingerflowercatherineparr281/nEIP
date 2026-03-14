import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for accessibility tests (Stories 9.1–9.3).
 *
 * Separate from the main E2E config so `pnpm test:a11y` only runs
 * the a11y suite under apps/web/tests/a11y/.
 */
export default defineConfig({
  testDir: './apps/web/tests/a11y',

  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report-a11y' }],
    ['list'],
  ],

  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
