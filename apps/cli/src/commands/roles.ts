/**
 * neip roles — Role Management commands.
 *
 * Commands:
 *   neip roles list          — GET    /api/v1/roles
 *   neip roles create        — POST   /api/v1/roles
 *   neip roles update <id>   — PUT    /api/v1/roles/:id
 *   neip roles delete <id>   — DELETE /api/v1/roles/:id
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for a role resource. */
interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
}

/** List response wrapper (API returns { data: [...] }). */
interface ListResponse<T> {
  data: T[];
}

/** Options accepted by `roles list`. */
interface RolesListOptions {
  limit: string;
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

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function rolesList(options: RolesListOptions): Promise<void> {
  const params: Record<string, string> = {
    limit: options.limit,
  };

  const result = await api.get<ListResponse<Role>>('/api/v1/roles', params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data } = result.data;

  printSuccess(
    data,
    `Showing ${String(data.length)} roles`,
  );
}

async function rolesCreate(): Promise<void> {
  process.stdout.write('Creating a new role. Enter details below.\n');

  const name = await promptLine('Role name: ');
  const description = await promptLine('Description (optional): ');
  const permissionsInput = await promptLine('Permissions (comma-separated, e.g. invoices.read,payments.write): ');

  if (name === '') {
    printError('Role name is required.');
    process.exit(1);
  }

  const permissions = permissionsInput
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '');

  const result = await api.post<{ data: Role }>('/api/v1/roles', {
    name,
    description,
    permissions,
  });

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Role "${result.data.data.name}" created.`);
}

async function rolesUpdate(id: string): Promise<void> {
  if (id === '') {
    printError('Role ID is required.');
    process.exit(1);
  }

  process.stdout.write(`Updating role ${id}. Leave fields blank to keep existing values.\n`);

  const name = await promptLine('New name (blank to skip): ');
  const description = await promptLine('New description (blank to skip): ');
  const permissionsInput = await promptLine('New permissions (comma-separated, blank to skip): ');

  const body: Record<string, unknown> = {};
  if (name !== '') body['name'] = name;
  if (description !== '') body['description'] = description;
  if (permissionsInput !== '') {
    body['permissions'] = permissionsInput
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '');
  }

  if (Object.keys(body).length === 0) {
    printError('No fields to update.');
    process.exit(1);
  }

  const result = await api.put<{ data: Role }>(`/api/v1/roles/${id}`, body);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Role ${id} updated.`);
}

async function rolesDelete(id: string): Promise<void> {
  if (id === '') {
    printError('Role ID is required.');
    process.exit(1);
  }

  const result = await api.delete<void>(`/api/v1/roles/${id}`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess({ id }, `Role ${id} deleted.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `roles` command group.
 */
export function buildRolesCommand(): Command {
  const roles = new Command('roles')
    .description('จัดการสิทธิ์และบทบาทผู้ใช้ — Role and permission management')
    .addHelpText('after', `
Examples:
  $ neip roles list                         # แสดง roles ทั้งหมด
  $ neip roles create                       # สร้าง role ใหม่ (interactive)
  $ neip roles update <id>                  # แก้ไข role
  $ neip roles delete <id>                  # ลบ role

Permissions format: invoices.read, payments.write, reports.view, ...
  `);

  roles
    .command('list')
    .description('แสดงรายการ roles ทั้งหมดในองค์กร — List all roles in the organisation')
    .option('--limit <number>', 'จำนวนสูงสุด — Maximum number of roles to return', '50')
    .action(async (options: RolesListOptions) => {
      await rolesList(options);
    });

  roles
    .command('create')
    .description('สร้าง role ใหม่ (interactive) — Create a new role interactively')
    .action(async () => {
      await rolesCreate();
    });

  roles
    .command('update <id>')
    .description('แก้ไข role (interactive) — Update an existing role interactively')
    .action(async (id: string) => {
      await rolesUpdate(id);
    });

  roles
    .command('delete <id>')
    .description('ลบ role ด้วย ID — Delete a role by ID')
    .action(async (id: string) => {
      await rolesDelete(id);
    });

  return roles;
}
