/**
 * neip config — local configuration management commands.
 *
 * Commands:
 *   neip config set <key> <value>  — store a config value in ~/.neip/config.json
 *   neip config get <key>          — read a config value
 *   neip config list               — print all stored config values
 *   neip config unset <key>        — remove a config key
 *
 * Story 6.4 additions:
 *   neip config set llm-api-key <key>  — stores the BYOK LLM API key
 *   The key is accepted by `config set` (unlike auth tokens which are blocked)
 *   but is always masked ("[redacted]") in `config list` and `config get`.
 */

import { type Command, createCommand } from 'commander';
import {
  SENSITIVE_KEYS,
  getConfigValue,
  maskSensitive,
  patchConfig,
  readConfig,
  setConfigValue,
} from '../lib/config-store.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Protected keys
// ---------------------------------------------------------------------------

/**
 * Keys that are managed exclusively by auth commands and must not be written
 * via `neip config set`.  This is a subset of SENSITIVE_KEYS — user-managed
 * sensitive keys like `llm-api-key` are NOT in this set so that
 * `neip config set llm-api-key <value>` works as expected.
 */
const AUTH_MANAGED_KEYS = new Set(['accessToken', 'refreshToken', 'tokenExpiresAt']);

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function configSet(key: string, value: string): void {
  if (AUTH_MANAGED_KEYS.has(key)) {
    printError(
      `"${key}" is managed by auth commands. Use \`neip auth login\` to update credentials.`,
    );
    process.exit(1);
  }

  setConfigValue(key, value);

  // Never echo back a sensitive value — show [redacted] instead
  const displayValue = maskSensitive(key, value);
  printSuccess({ key, value: displayValue }, `Config "${key}" set.`);
}

function configGet(key: string): void {
  const value = getConfigValue(key);

  if (value === undefined) {
    printError(`Config key "${key}" is not set.`);
    process.exit(1);
  }

  // Mask sensitive values — including llm-api-key — in all output modes
  const displayValue = maskSensitive(key, value);
  printSuccess({ key, value: displayValue });
}

function configList(): void {
  const config = readConfig();

  const sanitised: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) continue;
    sanitised[key] = SENSITIVE_KEYS.has(key) ? '[redacted]' : value;
  }

  if (Object.keys(sanitised).length === 0) {
    printSuccess({}, 'No config values stored yet.');
    return;
  }

  printSuccess(sanitised);
}

function configUnset(key: string): void {
  if (AUTH_MANAGED_KEYS.has(key)) {
    printError(
      `"${key}" is managed by auth commands. Use \`neip auth logout\` to clear credentials.`,
    );
    process.exit(1);
  }

  patchConfig({ [key]: undefined });
  printSuccess({ key }, `Config key "${key}" removed.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `config` sub-command group.
 */
export function buildConfigCommand(): Command {
  const config = createCommand('config').description('Manage local CLI configuration');

  config
    .command('set <key> <value>')
    .description(
      'Set a configuration value. Use "llm-api-key" to store your BYOK LLM API key (stored securely, never displayed in plain text).',
    )
    .action((key: string, value: string) => {
      configSet(key, value);
    });

  config
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string) => {
      configGet(key);
    });

  config
    .command('list')
    .description('List all configuration values (sensitive values are masked)')
    .action(() => {
      configList();
    });

  config
    .command('unset <key>')
    .description('Remove a configuration key')
    .action((key: string) => {
      configUnset(key);
    });

  return config;
}
