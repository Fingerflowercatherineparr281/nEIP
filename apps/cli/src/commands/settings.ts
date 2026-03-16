/**
 * neip settings — Organisation Settings commands.
 *
 * Commands:
 *   neip settings get           — GET /api/v1/organizations/:id
 *   neip settings update        — PUT /api/v1/organizations/:id
 *   neip settings ai            — PUT /api/v1/organizations/:id/settings
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { getConfigValue } from '../lib/config-store.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for an organisation resource. */
interface Organisation {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  fiscalYearStart: number;
  settings: Record<string, unknown>;
  createdAt: string;
}

/** AI settings payload shape. */
interface AiSettings {
  provider?: string;
  model?: string;
  apiKey?: string;
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a single line from stdin with a prompt. */
function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function requireOrgId(): string {
  const orgId = getConfigValue('orgId');
  if (orgId === undefined || orgId === '') {
    printError('No active organisation set. Run "neip org switch <id>" first.');
    process.exit(1);
  }
  return orgId;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function settingsGet(): Promise<void> {
  const orgId = requireOrgId();

  const result = await api.get<Organisation>(`/api/v1/organizations/${orgId}`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, 'Organisation settings:');
}

async function settingsUpdate(): Promise<void> {
  const orgId = requireOrgId();

  process.stdout.write('Updating organisation settings. Leave fields blank to keep existing values.\n');

  const name = await promptLine('Organisation name (blank to skip): ');
  const currency = await promptLine('Currency code (e.g. USD, blank to skip): ');
  const timezone = await promptLine('Timezone (e.g. America/New_York, blank to skip): ');
  const fiscalYearStartStr = await promptLine('Fiscal year start month 1-12 (blank to skip): ');

  const body: Record<string, unknown> = {};
  if (name !== '') body['name'] = name;
  if (currency !== '') body['currency'] = currency;
  if (timezone !== '') body['timezone'] = timezone;
  if (fiscalYearStartStr !== '') {
    const month = Number(fiscalYearStartStr);
    if (Number.isNaN(month) || month < 1 || month > 12) {
      printError('Fiscal year start must be a number between 1 and 12.');
      process.exit(1);
    }
    body['fiscalYearStart'] = month;
  }

  if (Object.keys(body).length === 0) {
    printError('No fields to update.');
    process.exit(1);
  }

  const result = await api.put<Organisation>(`/api/v1/organizations/${orgId}`, body);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, 'Organisation settings updated.');
}

async function settingsAi(): Promise<void> {
  const orgId = requireOrgId();

  process.stdout.write('Updating AI/LLM settings. Leave fields blank to keep existing values.\n');

  const provider = await promptLine('LLM provider (e.g. openai, anthropic, blank to skip): ');
  const model = await promptLine('Model (e.g. gpt-4o, claude-3-5-sonnet, blank to skip): ');
  const apiKey = await promptLine('API key (blank to skip): ');
  const enabledInput = await promptLine('AI features enabled? (true/false, blank to skip): ');

  const body: AiSettings = {};
  if (provider !== '') body.provider = provider;
  if (model !== '') body.model = model;
  if (apiKey !== '') body.apiKey = apiKey;
  if (enabledInput !== '') {
    if (enabledInput !== 'true' && enabledInput !== 'false') {
      printError('enabled must be "true" or "false".');
      process.exit(1);
    }
    body.enabled = enabledInput === 'true';
  }

  if (Object.keys(body).length === 0) {
    printError('No fields to update.');
    process.exit(1);
  }

  const result = await api.put<Organisation>(`/api/v1/organizations/${orgId}/settings`, body);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, 'AI settings updated.');
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `settings` command group.
 */
export function buildSettingsCommand(): Command {
  const settings = new Command('settings')
    .description('จัดการการตั้งค่าองค์กร — Organisation settings management')
    .addHelpText('after', `
Examples:
  $ neip settings get                   # ดูการตั้งค่าปัจจุบัน
  $ neip settings update                # แก้ไขการตั้งค่า (interactive)
  $ neip settings ai                    # ตั้งค่า AI/LLM provider
  `);

  settings
    .command('get')
    .description('ดูการตั้งค่าองค์กรปัจจุบัน — Get current organisation settings')
    .action(async () => {
      await settingsGet();
    });

  settings
    .command('update')
    .description('แก้ไขการตั้งค่าองค์กร (interactive) — Update organisation settings interactively')
    .action(async () => {
      await settingsUpdate();
    });

  settings
    .command('ai')
    .description('ตั้งค่า AI/LLM provider (interactive) — Update AI/LLM provider settings for this organisation')
    .action(async () => {
      await settingsAi();
    });

  return settings;
}
