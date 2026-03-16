/**
 * neip budgets — Budget Management commands.
 *
 * Commands:
 *   neip budgets list          — GET /api/v1/budgets
 *   neip budgets create        — POST /api/v1/budgets
 *   neip budgets update <id>   — PUT /api/v1/budgets/:id
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single budget line allocation for an account. */
interface BudgetLine {
  accountId: string;
  amount: number;
  period: number;
}

/** Response shape for a budget resource. */
interface Budget {
  id: string;
  name: string;
  fiscalYearId: string;
  year: number;
  status: 'draft' | 'approved' | 'archived';
  lines: BudgetLine[];
  createdAt: string;
}

/** Paginated list response wrapper. */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Options accepted by `budgets list`. */
interface BudgetsListOptions {
  page: string;
  pageSize: string;
  year?: string;
  status?: string;
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

async function budgetsList(options: BudgetsListOptions): Promise<void> {
  const params: Record<string, string> = {
    page: options.page,
    pageSize: options.pageSize,
  };

  if (options.year !== undefined && options.year !== '') params['year'] = options.year;
  if (options.status !== undefined && options.status !== '') params['status'] = options.status;

  const result = await api.get<PaginatedResponse<Budget>>('/api/v1/budgets', params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data, total, page, pageSize } = result.data;

  printSuccess(
    data,
    `Showing ${String(data.length)} of ${String(total)} budgets (page ${String(page)}/${String(Math.ceil(total / pageSize))})`,
  );
}

async function budgetsCreate(): Promise<void> {
  process.stdout.write('Creating a new budget. Enter details below.\n');

  const name = await promptLine('Budget name: ');
  const fiscalYearId = await promptLine('Fiscal year ID: ');
  const yearStr = await promptLine('Calendar year (e.g. 2026): ');

  if (name === '') {
    printError('Budget name is required.');
    process.exit(1);
  }
  if (fiscalYearId === '') {
    printError('Fiscal year ID is required.');
    process.exit(1);
  }

  const year = Number(yearStr);
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    printError('Year must be a valid 4-digit number.');
    process.exit(1);
  }

  // Collect budget lines
  const lines: BudgetLine[] = [];
  process.stdout.write('\nEnter budget lines (leave Account ID blank to finish):\n');

  for (;;) {
    const accountId = await promptLine(`  Line ${String(lines.length + 1)} — Account ID: `);
    if (accountId === '') break;

    const periodStr = await promptLine('  Period number (1-12): ');
    const amountStr = await promptLine('  Budgeted amount: ');

    const period = Number(periodStr);
    const amount = Number(amountStr);

    if (Number.isNaN(period) || period < 1 || period > 13) {
      printError('Period must be between 1 and 13.');
      process.exit(1);
    }
    if (Number.isNaN(amount) || amount < 0) {
      printError('Amount must be a non-negative number.');
      process.exit(1);
    }

    lines.push({ accountId, period, amount });
  }

  const result = await api.post<{ data: Budget }>('/api/v1/budgets', {
    name,
    fiscalYearId,
    year,
    lines,
  });

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Budget "${result.data.data.name}" created.`);
}

async function budgetsUpdate(id: string): Promise<void> {
  if (id === '') {
    printError('Budget ID is required.');
    process.exit(1);
  }

  process.stdout.write(`Updating budget ${id}. Leave fields blank to keep existing values.\n`);

  const name = await promptLine('New name (blank to skip): ');
  const statusInput = await promptLine('New status (draft/approved/archived, blank to skip): ');

  const body: Record<string, unknown> = {};
  if (name !== '') body['name'] = name;
  if (statusInput !== '') {
    const validStatuses = ['draft', 'approved', 'archived'];
    if (!validStatuses.includes(statusInput)) {
      printError(`Status must be one of: ${validStatuses.join(', ')}`);
      process.exit(1);
    }
    body['status'] = statusInput;
  }

  if (Object.keys(body).length === 0) {
    printError('No fields to update.');
    process.exit(1);
  }

  const result = await api.put<{ data: Budget }>(`/api/v1/budgets/${id}`, body);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Budget ${id} updated.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `budgets` command group.
 */
export function buildBudgetsCommand(): Command {
  const budgets = new Command('budgets')
    .description('จัดการงบประมาณ — Budget management')
    .addHelpText('after', `
Examples:
  $ neip budgets list                           # แสดงงบประมาณทั้งหมด
  $ neip budgets list --year 2026 --status approved
  $ neip budgets create                         # สร้างงบประมาณใหม่ (interactive)
  $ neip budgets update <id>                    # แก้ไขงบประมาณ
  `);

  budgets
    .command('list')
    .description('แสดงงบประมาณทั้งหมด — List all budgets with optional filters')
    .option('--page <number>', 'หน้าที่ — Page number', '1')
    .option('--page-size <number>', 'จำนวนต่อหน้า — Number of budgets per page', '20')
    .option('--year <year>', 'กรองตามปี — Filter by calendar year')
    .option('--status <status>', 'กรองตามสถานะ: draft, approved, archived — Filter by status')
    .action(async (options: BudgetsListOptions) => {
      await budgetsList(options);
    });

  budgets
    .command('create')
    .description('สร้างงบประมาณใหม่ (interactive) — Create a new budget interactively')
    .action(async () => {
      await budgetsCreate();
    });

  budgets
    .command('update <id>')
    .description('แก้ไขงบประมาณ (interactive) — Update an existing budget interactively')
    .action(async (id: string) => {
      await budgetsUpdate(id);
    });

  return budgets;
}
