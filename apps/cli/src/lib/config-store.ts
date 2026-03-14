/**
 * Config store — reads and writes ~/.neip/config.json.
 *
 * All filesystem operations are synchronous so they can be called at the
 * top of any command before async work begins. The file is written atomically
 * (write-to-tmp, then rename) to prevent corruption on interrupted writes.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of ~/.neip/config.json */
export interface NeipConfig {
  /** Base URL of the nEIP API server, e.g. "http://localhost:3000" */
  apiUrl?: string | undefined;
  /** Active organisation ID used by default for all commands */
  orgId?: string | undefined;
  /** JWT access token obtained from neip auth login */
  accessToken?: string | undefined;
  /** JWT refresh token for transparent token renewal */
  refreshToken?: string | undefined;
  /** ISO-8601 expiry timestamp of the access token */
  tokenExpiresAt?: string | undefined;
  /**
   * BYOK LLM API key (Story 6.4).
   * Stored in plain text on disk (same security model as accessToken) but
   * always masked in human-readable output via maskSensitive().
   */
  'llm-api-key'?: string | undefined;
  /** Arbitrary user-defined key/value pairs from neip config set */
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Sensitive key registry
// ---------------------------------------------------------------------------

/**
 * Keys whose values are never shown in plain text by any output command.
 * `neip config list` and `neip config get` will display "[redacted]" instead.
 *
 * Auth keys are managed exclusively by `neip auth` commands.
 * User-managed sensitive keys (e.g. llm-api-key) can be written with
 * `neip config set` but are still masked on read.
 */
export const SENSITIVE_KEYS = new Set<string>([
  'accessToken',
  'refreshToken',
  'tokenExpiresAt',
  'llm-api-key',
]);

/**
 * Return the display value for a config key.
 *
 * - Keys in SENSITIVE_KEYS → "[redacted]"
 * - All others             → the raw value
 */
export function maskSensitive(key: string, value: string): string {
  return SENSITIVE_KEYS.has(key) ? '[redacted]' : value;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Directory that holds all nEIP CLI state files. */
export function neipDir(): string {
  return path.join(os.homedir(), '.neip');
}

/** Absolute path to the config file. */
export function configFilePath(): string {
  return path.join(neipDir(), 'config.json');
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Load the current config.  Returns an empty object when the file does not
 * exist yet so callers never need to handle "first run" edge cases.
 */
export function readConfig(): NeipConfig {
  const filePath = configFilePath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as NeipConfig;
  } catch {
    // Corrupt / unreadable file — treat as empty rather than crashing.
    return {};
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Persist a config object to disk.  The parent directory is created when it
 * does not yet exist.
 */
export function writeConfig(config: NeipConfig): void {
  const dir = neipDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const filePath = configFilePath();
  const tmpPath = `${filePath}.tmp`;
  const json = JSON.stringify(config, null, 2);

  fs.writeFileSync(tmpPath, json, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Merge partial updates into the existing config and persist.
 * Supports removing a key by passing `undefined` as the value.
 * We use a looser record type so callers can pass `undefined` for deletion
 * (exactOptionalPropertyTypes bars `undefined` in Partial<NeipConfig>).
 */
export function patchConfig(updates: Record<string, string | undefined>): NeipConfig {
  const current = readConfig();
  const next: NeipConfig = { ...current };

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      // Remove the key when explicitly set to undefined
      delete next[key];
    } else {
      next[key] = value;
    }
  }

  writeConfig(next);
  return next;
}

/**
 * Remove all authentication-related keys from the config (logout helper).
 */
export function clearAuth(): void {
  const authKeys: Record<string, undefined> = {
    accessToken: undefined,
    refreshToken: undefined,
    tokenExpiresAt: undefined,
  };
  patchConfig(authKeys);
}

/**
 * Retrieve a single config value by key, or undefined when absent.
 */
export function getConfigValue(key: string): string | undefined {
  return readConfig()[key];
}

/**
 * Set a single config value by key and persist.
 */
export function setConfigValue(key: string, value: string): void {
  patchConfig({ [key]: value });
}
