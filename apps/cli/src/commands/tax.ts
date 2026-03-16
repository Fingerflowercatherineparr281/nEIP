/**
 * neip tax — Tax Rate management commands.
 *
 * Commands:
 *   neip tax list          — GET  /api/v1/tax-rates
 *   neip tax create        — POST /api/v1/tax-rates
 *   neip tax update <id>   — PUT  /api/v1/tax-rates/:id
 *   neip tax delete <id>   — DELETE /api/v1/tax-rates/:id
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for a tax rate resource. */
interface TaxRate {
  id: string;
  name: string;
  rate: number;
  description: string;
  isActive: boolean;
  createdAt: string;
}

/** List response wrapper (API returns { data: [...] }). */
interface ListResponse<T> {
  data: T[];
}

/** Options accepted by `tax list`. */
interface TaxListOptions {
  limit: string;
  active?: string;
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

async function taxList(options: TaxListOptions): Promise<void> {
  const params: Record<string, string> = {
    limit: options.limit,
  };

  if (options.active !== undefined && options.active !== '') {
    params['active'] = options.active;
  }

  const result = await api.get<ListResponse<TaxRate>>('/api/v1/tax-rates', params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data } = result.data;

  printSuccess(
    data,
    `Showing ${String(data.length)} tax rates`,
  );
}

async function taxCreate(): Promise<void> {
  process.stdout.write('Creating a new tax rate. Enter details below.\n');

  const name = await promptLine('Tax rate name (e.g. GST 10%): ');
  const rateStr = await promptLine('Rate percentage (e.g. 10 for 10%): ');
  const description = await promptLine('Description (optional): ');

  if (name === '') {
    printError('Tax rate name is required.');
    process.exit(1);
  }

  const rate = Number(rateStr);
  if (Number.isNaN(rate) || rate < 0 || rate > 100) {
    printError('Rate must be a number between 0 and 100.');
    process.exit(1);
  }

  const result = await api.post<{ data: TaxRate }>('/api/v1/tax-rates', {
    name,
    rate,
    description,
  });

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Tax rate "${result.data.data.name}" created (${String(result.data.data.rate)}%).`);
}

async function taxUpdate(id: string): Promise<void> {
  if (id === '') {
    printError('Tax rate ID is required.');
    process.exit(1);
  }

  process.stdout.write(`Updating tax rate ${id}. Leave fields blank to keep existing values.\n`);

  const name = await promptLine('New name (blank to skip): ');
  const rateStr = await promptLine('New rate percentage (blank to skip): ');
  const description = await promptLine('New description (blank to skip): ');
  const activeInput = await promptLine('Active? (true/false, blank to skip): ');

  const body: Record<string, unknown> = {};
  if (name !== '') body['name'] = name;
  if (rateStr !== '') {
    const rate = Number(rateStr);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      printError('Rate must be a number between 0 and 100.');
      process.exit(1);
    }
    body['rate'] = rate;
  }
  if (description !== '') body['description'] = description;
  if (activeInput !== '') {
    if (activeInput !== 'true' && activeInput !== 'false') {
      printError('Active must be "true" or "false".');
      process.exit(1);
    }
    body['isActive'] = activeInput === 'true';
  }

  if (Object.keys(body).length === 0) {
    printError('No fields to update.');
    process.exit(1);
  }

  const result = await api.put<{ data: TaxRate }>(`/api/v1/tax-rates/${id}`, body);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Tax rate ${id} updated.`);
}

async function taxDelete(id: string): Promise<void> {
  if (id === '') {
    printError('Tax rate ID is required.');
    process.exit(1);
  }

  const result = await api.delete<void>(`/api/v1/tax-rates/${id}`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess({ id }, `Tax rate ${id} deleted.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `tax` command group.
 */
export function buildTaxCommand(): Command {
  const tax = new Command('tax')
    .description('จัดการอัตราภาษี (VAT, WHT) — Tax rate management')
    .addHelpText('after', `
Examples:
  $ neip tax list                        # แสดงอัตราภาษีทั้งหมด
  $ neip tax list --active true          # เฉพาะที่ active
  $ neip tax create                      # สร้างอัตราภาษีใหม่ (interactive)
  $ neip tax update <id>                 # แก้ไขอัตราภาษี
  $ neip tax delete <id>                 # ลบอัตราภาษี
  `);

  tax
    .command('list')
    .description('แสดงอัตราภาษีทั้งหมด — List all tax rates')
    .option('--limit <number>', 'จำนวนสูงสุด — Maximum number of tax rates to return', '50')
    .option('--active <bool>', 'กรองตาม active status: true หรือ false — Filter by active status')
    .action(async (options: TaxListOptions) => {
      await taxList(options);
    });

  tax
    .command('create')
    .description('สร้างอัตราภาษีใหม่ (interactive) — Create a new tax rate interactively')
    .action(async () => {
      await taxCreate();
    });

  tax
    .command('update <id>')
    .description('แก้ไขอัตราภาษี (interactive) — Update an existing tax rate interactively')
    .action(async (id: string) => {
      await taxUpdate(id);
    });

  tax
    .command('delete <id>')
    .description('ลบอัตราภาษี — Delete a tax rate by ID')
    .action(async (id: string) => {
      await taxDelete(id);
    });

  return tax;
}
