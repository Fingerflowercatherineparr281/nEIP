/**
 * neip vendors — Vendor management commands.
 *
 * Commands:
 *   neip vendors list            — GET  /api/v1/vendors
 *   neip vendors create          — POST /api/v1/vendors (interactive)
 *   neip vendors update <id>     — PUT  /api/v1/vendors/:id (interactive)
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for a vendor resource. */
interface Vendor {
  id: string;
  name: string;
  taxId: string | null;
  address: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

/** Paginated list response returned by GET /api/v1/vendors. */
interface VendorListResponse {
  items: Vendor[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Options accepted by `vendors list`. */
interface VendorsListOptions {
  limit: string;
  offset: string;
  search: string;
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

async function vendorsList(options: VendorsListOptions): Promise<void> {
  const params: Record<string, string> = {
    limit: options.limit,
    offset: options.offset,
  };
  if (options.search !== '') {
    params['search'] = options.search;
  }

  const result = await api.get<VendorListResponse>('/api/v1/vendors', params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { items, total, limit, offset } = result.data;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;

  printSuccess(
    items,
    `Showing ${String(items.length)} of ${String(total)} vendors (page ${String(page)}/${String(totalPages)})`,
  );
}

async function vendorsCreate(): Promise<void> {
  process.stdout.write('Creating a new vendor. Enter details below.\n');

  const name = await promptLine('Vendor name: ');
  if (name === '') {
    printError('Vendor name is required.');
    process.exit(1);
  }

  const taxId = await promptLine('Tax ID (optional, press Enter to skip): ');
  const address = await promptLine('Address (optional, press Enter to skip): ');

  const body: Record<string, string> = { name };
  if (taxId !== '') body['taxId'] = taxId;
  if (address !== '') body['address'] = address;

  const result = await api.post<Vendor>('/api/v1/vendors', body);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, `Vendor "${result.data.name}" created (ID: ${result.data.id}).`);
}

async function vendorsUpdate(id: string): Promise<void> {
  if (id === '') {
    printError('Vendor ID is required.');
    process.exit(1);
  }

  process.stdout.write(`Updating vendor ${id}. Leave fields blank to keep existing values.\n`);

  const name = await promptLine('New name (blank to skip): ');
  const taxId = await promptLine('New tax ID (blank to skip): ');
  const address = await promptLine('New address (blank to skip): ');

  const body: Record<string, string> = {};
  if (name !== '') body['name'] = name;
  if (taxId !== '') body['taxId'] = taxId;
  if (address !== '') body['address'] = address;

  if (Object.keys(body).length === 0) {
    printError('No fields to update.');
    process.exit(1);
  }

  const result = await api.put<Vendor>(`/api/v1/vendors/${id}`, body);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, `Vendor ${id} updated.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `vendors` command group.
 */
export function buildVendorsCommand(): Command {
  const vendors = new Command('vendors')
    .description('จัดการผู้ขาย (เจ้าหนี้การค้า) — Vendor management for accounts payable')
    .addHelpText('after', `
Examples:
  $ neip vendors list                       # แสดงผู้ขายทั้งหมด
  $ neip vendors list --search "ABC"        # ค้นหาผู้ขาย
  $ neip vendors create                     # สร้างผู้ขายใหม่ (interactive)
  $ neip vendors update <id>                # แก้ไขข้อมูลผู้ขาย
  `);

  vendors
    .command('list')
    .description('แสดงรายการผู้ขายทั้งหมด — List vendors for the current tenant')
    .option('--limit <number>', 'จำนวนสูงสุด — Maximum number of vendors to return', '20')
    .option('--offset <number>', 'ข้ามรายการ N แรก — Number of vendors to skip', '0')
    .option('--search <text>', 'ค้นหาด้วยชื่อหรือ Tax ID — Filter by name or tax ID', '')
    .action(async (options: VendorsListOptions) => {
      await vendorsList(options);
    });

  vendors
    .command('create')
    .description('สร้างผู้ขายใหม่ (interactive) — Create a new vendor interactively')
    .action(async () => {
      await vendorsCreate();
    });

  vendors
    .command('update <id>')
    .description('แก้ไขข้อมูลผู้ขาย (interactive) — Update an existing vendor interactively')
    .action(async (id: string) => {
      await vendorsUpdate(id);
    });

  return vendors;
}
