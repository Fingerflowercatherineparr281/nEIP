import { defineConfig } from 'vitest/config';

/**
 * Root Vitest configuration — shared base for all packages.
 *
 * Packages may extend this config via `vitest.config.ts` with
 * `mergeConfig(rootConfig, defineConfig({ ... }))`.
 *
 * Architecture references:
 *   AR25 — Vitest for unit + integration testing
 *   AR28 — Co-located test files (*.test.ts next to source)
 */
export default defineConfig({
  test: {
    // Co-located test pattern: *.test.ts next to source files (AR28)
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/.next/**'],

    // Coverage with v8 provider — report only, no minimum threshold for MVP
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/e2e/**',
        '**/testing/**',
      ],
    },
  },
});
