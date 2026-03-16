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
import { api } from '../lib/api-client.js';
import { clearAuth, getConfigValue, patchConfig, readConfig } from '../lib/config-store.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Data shape printed by `neip whoami`. */
interface WhoamiData {
  email: string;
  id: string;
  tenantId: string;
  apiUrl: string;
  orgId: string;
}

/** JWT access token payload claims we care about. */
interface JwtClaims {
  sub: string;
  email: string;
  tenantId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Prompt the user for a value on stdin and return what they typed.
 * When `hidden` is true the input is masked (used for passwords).
 * Falls back gracefully to plain readline when stdin is not a TTY
 * (e.g. when input is piped via `printf "email\npass\n" | neip auth login`).
 */
async function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const isTTY = process.stdin.isTTY === true;

    // If not a TTY (piped) or hidden mode not needed, use plain readline
    if (!hidden || !isTTY) {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });
      process.stdout.write(question);
      rl.once('line', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    // TTY hidden mode — suppress echoing with setRawMode
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

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
  });
}

/**
 * Decode the payload of a JWT (no signature verification — we trust our own
 * stored token) and return the claims.  Returns null on any parse error.
 */
function decodeJwtPayload(token: string): JwtClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadB64 = parts[1];
    if (payloadB64 === undefined) return null;
    // Re-pad to a multiple of 4 as required by atob / Buffer
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(decoded) as JwtClaims;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

async function login(): Promise<void> {
  const currentApiUrl = getConfigValue('apiUrl') ?? 'http://localhost:5400';

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

  const { accessToken, refreshToken, expiresIn } = result.data;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  patchConfig({
    apiUrl,
    accessToken,
    refreshToken,
    tokenExpiresAt: expiresAt,
  });

  // Decode user identity from the JWT payload (no round-trip needed)
  const claims = decodeJwtPayload(accessToken);

  printSuccess(
    {
      email: claims?.email ?? email,
      id: claims?.sub ?? '(unknown)',
      tenantId: claims?.tenantId ?? '(unknown)',
      apiUrl,
    },
    `Logged in as ${claims?.email ?? email}`,
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

  // Decode identity directly from the stored JWT — avoids needing a /me endpoint.
  const claims = decodeJwtPayload(token);

  if (claims === null) {
    printError('Stored token is malformed. Run `neip auth login` to re-authenticate.');
    process.exit(1);
  }

  const config = readConfig();

  const data: WhoamiData = {
    email: claims.email,
    id: claims.sub,
    tenantId: claims.tenantId ?? '(none)',
    apiUrl: config.apiUrl ?? 'http://localhost:5400',
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
  const auth = new Command('auth')
    .description('จัดการการเข้าสู่ระบบ — Authentication commands');

  auth
    .command('login')
    .description('เข้าสู่ระบบและบันทึก credentials ไว้ในเครื่อง — Authenticate with the nEIP API and store credentials locally')
    .addHelpText('after', `
Examples:
  $ neip auth login                  # เข้าสู่ระบบแบบ interactive
  `)
    .action(async () => {
      await login();
    });

  auth
    .command('logout')
    .description('ออกจากระบบและลบ credentials ที่เก็บไว้ — Clear stored credentials')
    .addHelpText('after', `
Examples:
  $ neip auth logout                 # ออกจากระบบ
  `)
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
    .description('แสดงข้อมูลผู้ใช้ปัจจุบัน องค์กร และ API URL — Show current user, organisation, and API URL')
    .addHelpText('after', `
Examples:
  $ neip whoami                      # ดูข้อมูลผู้ใช้ปัจจุบัน
  `)
    .action(async () => {
      await whoami();
    });
}
