/**
 * neip auth — authentication commands.
 *
 * Commands:
 *   neip auth login   — prompt for credentials, obtain JWT, store in config
 *   neip auth logout  — clear stored JWT tokens
 *   neip whoami       — print current user and connection info
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import type { LoginResponse } from '../lib/api-client.js';
import { ApiError, api } from '../lib/api-client.js';
import { clearAuth, getConfigValue, patchConfig, readConfig } from '../lib/config-store.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Data shape printed by `neip whoami`. */
interface WhoamiData {
  email: string;
  name: string;
  id: string;
  apiUrl: string;
  orgId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Prompt the user for a value on stdin and return what they typed.
 * When `hidden` is true the input is masked (used for passwords).
 */
async function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    if (hidden) {
      // Write the prompt manually so we can suppress echoing
      process.stdout.write(question);
      process.stdin.setRawMode(true);

      let input = '';
      process.stdin.on('data', function onData(buf: Buffer) {
        const char = buf.toString();
        if (char === '\n' || char === '\r' || char === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u007f') {
          // Backspace
          input = input.slice(0, -1);
        } else {
          input += char;
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

async function login(): Promise<void> {
  const currentApiUrl = getConfigValue('apiUrl') ?? 'http://localhost:3000';

  const apiUrlInput = await prompt(`API URL [${currentApiUrl}]: `);
  const apiUrl = apiUrlInput.trim() === '' ? currentApiUrl : apiUrlInput.trim();

  const email = await prompt('Email: ');
  const password = await prompt('Password: ', true);

  if (email.trim() === '' || password.trim() === '') {
    printError('Email and password are required.');
    process.exit(1);
  }

  // Persist API URL before making the call so api-client can read it
  patchConfig({ apiUrl });

  const result = await api.post<LoginResponse>('/api/v1/auth/login', { email, password }, true);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { accessToken, refreshToken, expiresIn, user } = result.data;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  patchConfig({
    apiUrl,
    accessToken,
    refreshToken,
    tokenExpiresAt: expiresAt,
  });

  printSuccess(
    { email: user.email, name: user.name, id: user.id, apiUrl },
    `Logged in as ${user.email}`,
  );
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

function logout(): void {
  clearAuth();
  printSuccess({}, 'Logged out. Credentials cleared.');
}

// ---------------------------------------------------------------------------
// whoami
// ---------------------------------------------------------------------------

async function whoami(): Promise<void> {
  const token = getConfigValue('accessToken');

  if (token === undefined || token === '') {
    printError('Not authenticated. Run `neip auth login` first.');
    process.exit(1);
  }

  const result = await api.get<{ data: { id: string; email: string; name: string } }>(
    '/api/v1/users/me',
  );

  if (!result.ok) {
    if (result.error instanceof ApiError && result.error.status === 401) {
      printError('Session expired. Run `neip auth login` to authenticate again.');
    } else {
      printError(result.error.detail, result.error.status);
    }
    process.exit(1);
  }

  const config = readConfig();
  const user = result.data.data;

  const data: WhoamiData = {
    email: user.email,
    name: user.name,
    id: user.id,
    apiUrl: config.apiUrl ?? 'http://localhost:3000',
    orgId: config.orgId ?? '(none)',
  };

  printSuccess(data);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `auth` sub-command group.
 * Also exports the standalone `whoami` command for registration on root.
 */
export function buildAuthCommand(): Command {
  const auth = new Command('auth').description('Authentication commands');

  auth
    .command('login')
    .description('Authenticate with the nEIP API and store credentials locally')
    .action(async () => {
      await login();
    });

  auth
    .command('logout')
    .description('Clear stored credentials')
    .action(() => {
      logout();
    });

  return auth;
}

/**
 * Build the standalone `neip whoami` command.
 */
export function buildWhoamiCommand(): Command {
  return new Command('whoami')
    .description('Show current user, organisation, and API URL')
    .action(async () => {
      await whoami();
    });
}
