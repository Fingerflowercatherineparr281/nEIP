/**
 * neip org — Organisation (tenant) management commands.
 *
 * Story 6.4 — BYOK LLM Config + Org Setup
 *
 * Commands:
 *   neip org create <name>   — POST /api/v1/tenants — create a new organisation
 *   neip org list            — GET  /api/v1/tenants — list all accessible organisations
 *   neip org switch <id>     — save the active org to local config (no API call)
 */

import { type Command, createCommand } from 'commander';
import { api } from '../lib/api-client.js';
import { getConfigValue, patchConfig } from '../lib/config-store.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for a tenant / organisation resource. */
interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

/** Paginated list response wrapper. */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function orgCreate(name: string): Promise<void> {
  if (name.trim() === '') {
    printError('Organisation name is required.');
    process.exit(1);
  }

  const result = await api.post<{ data: Tenant }>('/api/v1/tenants', { name: name.trim() });

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Organisation "${result.data.data.name}" created (id: ${result.data.data.id}).`);
}

async function orgList(): Promise<void> {
  const result = await api.get<PaginatedResponse<Tenant>>('/api/v1/tenants');

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data, total } = result.data;

  // Mark the currently active org with an asterisk in table mode
  const activeOrgId = getConfigValue('orgId');

  const display = data.map((t) => ({
    ...t,
    active: t.id === activeOrgId ? '*' : '',
  }));

  printSuccess(display, `${String(total)} organisation(s) found.`);
}

function orgSwitch(id: string): void {
  if (id.trim() === '') {
    printError('Organisation ID is required.');
    process.exit(1);
  }

  patchConfig({ orgId: id.trim() });
  printSuccess({ orgId: id.trim() }, `Active organisation set to "${id.trim()}".`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `org` sub-command group.
 */
export function buildOrgCommand(): Command {
  const org = createCommand('org').description('Organisation (tenant) management');

  org
    .command('create <name>')
    .description('Create a new organisation')
    .action(async (name: string) => {
      await orgCreate(name);
    });

  org
    .command('list')
    .description('List all accessible organisations')
    .action(async () => {
      await orgList();
    });

  org
    .command('switch <id>')
    .description('Set the active organisation for all subsequent commands')
    .action((id: string) => {
      orgSwitch(id);
    });

  return org;
}
