import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.js';

/**
 * Vitest config for @neip/core.
 * Extends the root shared config and scopes tests to this package.
 *
 * The `env` block provides stub values required by @neip/shared's env.ts
 * module-load-time validation so tests can import shared types without a
 * real DATABASE_URL / JWT_SECRET in CI.
 */
export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      env: {
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'test-secret-at-least-32-characters-long',
        NODE_ENV: 'test',
      },
    },
  }),
);
