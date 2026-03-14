import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.js';

/**
 * Vitest config for @neip/shared.
 * Extends the root shared config and scopes tests to this package.
 */
export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  }),
);
