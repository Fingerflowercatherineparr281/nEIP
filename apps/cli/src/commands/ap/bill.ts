/**
 * neip ap bill — Accounts Payable bill commands.
 *
 * Commands:
 *   neip ap bill list            — list bills (paginated)
 *   neip ap bill create          — create a new bill interactively
 *   neip ap bill get <id>        — get a single bill by ID
 *   neip ap bill post <id>       — post a draft bill
 *   neip ap bill void <id>       — void an existing bill
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../../lib/api-client.js';
import { printError, printSuccess } from '../../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single line item on a bill. */
interface BillLine {
  description: string;
  quantity: number;
  unitPrice: number;
  accountId: string;
}

/** Payload sent to create a bill. */
interface CreateBillPayload {
  vendorId: string;
  billDate: string;
  dueDate: string;
  reference: string;
  notes: string;
  lines: BillLine[];
}

/** Response shape for a bill resource. */
interface Bill {
  id: string;
  billNumber: string;
  vendorId: string;
  status: 'draft' | 'posted' | 'paid' | 'voided' | 'overdue';
  billDate: string;
  dueDate: string;
  reference: string;
  subtotal: number;
  tax: number;
  total: number;
  amountDue: number;
  createdAt: string;
}

/** Paginated list response wrapper. */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Options accepted by `ap bill list`. */
interface BillListOptions {
  page: string;
  pageSize: string;
  status?: string;
  vendorId?: string;
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

/** Return today's date in YYYY-MM-DD format. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Return a date N days from today in YYYY-MM-DD format. */
function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function billList(options: BillListOptions): Promise<void> {
  const params: Record<string, string> = {
    page: options.page,
    pageSize: options.pageSize,
  };

  if (options.status !== undefined && options.status !== '') {
    params['status'] = options.status;
  }
  if (options.vendorId !== undefined && options.vendorId !== '') {
    params['vendorId'] = options.vendorId;
  }

  const result = await api.get<PaginatedResponse<Bill>>('/api/v1/bills', params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data, total, page, pageSize } = result.data;

  printSuccess(
    data,
    `Showing ${String(data.length)} of ${String(total)} bills (page ${String(page)}/${String(Math.ceil(total / pageSize))})`,
  );
}

async function billCreate(): Promise<void> {
  process.stdout.write('Creating a new bill. Enter details below.\n');

  const vendorId = await promptLine('Vendor ID: ');
  const reference = await promptLine('Reference / PO number (optional): ');
  const billDateInput = await promptLine(`Bill date (YYYY-MM-DD) [${today()}]: `);
  const dueDateInput = await promptLine(`Due date (YYYY-MM-DD) [${daysFromToday(30)}]: `);
  const notes = await promptLine('Notes (optional): ');

  if (vendorId === '') {
    printError('Vendor ID is required.');
    process.exit(1);
  }

  const billDate = billDateInput === '' ? today() : billDateInput;
  const dueDate = dueDateInput === '' ? daysFromToday(30) : dueDateInput;

  // Collect at least one line
  const lines: BillLine[] = [];
  process.stdout.write('\nEnter line items (leave Description blank to finish):\n');

  for (;;) {
    const description = await promptLine(`  Line ${String(lines.length + 1)} — Description: `);
    if (description === '') break;

    const qtyStr = await promptLine('  Quantity: ');
    const unitPriceStr = await promptLine('  Unit price: ');
    const accountId = await promptLine('  Expense account ID: ');

    const quantity = Number(qtyStr === '' ? '1' : qtyStr);
    const unitPrice = Number(unitPriceStr === '' ? '0' : unitPriceStr);

    if (Number.isNaN(quantity) || quantity <= 0) {
      printError('Quantity must be a positive number.');
      process.exit(1);
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      printError('Unit price must be a non-negative number.');
      process.exit(1);
    }
    if (accountId === '') {
      printError('Expense account ID is required for each line.');
      process.exit(1);
    }

    lines.push({ description, quantity, unitPrice, accountId });
  }

  if (lines.length === 0) {
    printError('At least one line item is required.');
    process.exit(1);
  }

  const payload: CreateBillPayload = {
    vendorId,
    billDate,
    dueDate,
    reference,
    notes,
    lines,
  };

  const result = await api.post<{ data: Bill }>('/api/v1/bills', payload);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Bill ${result.data.data.billNumber} created.`);
}

async function billGet(id: string): Promise<void> {
  if (id === '') {
    printError('Bill ID is required.');
    process.exit(1);
  }

  const result = await api.get<{ data: Bill }>(`/api/v1/bills/${id}`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Bill ${id}:`);
}

async function billPost(id: string): Promise<void> {
  if (id === '') {
    printError('Bill ID is required.');
    process.exit(1);
  }

  const result = await api.post<{ data: Bill }>(`/api/v1/bills/${id}/post`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Bill ${id} has been posted.`);
}

async function billVoid(id: string): Promise<void> {
  if (id === '') {
    printError('Bill ID is required.');
    process.exit(1);
  }

  const result = await api.post<{ data: Bill }>(`/api/v1/bills/${id}/void`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Bill ${id} has been voided.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `ap bill` sub-command group.
 */
export function buildApBillCommand(): Command {
  const bill = new Command('bill')
    .description('จัดการบิลค่าใช้จ่าย (AP) — Accounts Payable bill operations')
    .addHelpText('after', `
Examples:
  $ neip ap bill list                            # แสดงบิลทั้งหมด
  $ neip ap bill list --status overdue           # เฉพาะที่เกินกำหนด
  $ neip ap bill list --vendor-id <id>           # กรองตามผู้ขาย
  $ neip ap bill create                          # สร้างบิลใหม่ (interactive)
  $ neip ap bill get <id>                        # ดูรายละเอียดบิล
  $ neip ap bill post <id>                       # post บิล (draft → posted)
  $ neip ap bill void <id>                       # ยกเลิกบิล

Status flow: draft → posted → paid | voided | overdue
  `);

  bill
    .command('list')
    .description('แสดงรายการบิลค่าใช้จ่าย — List bills with optional pagination and filters')
    .option('--page <number>', 'หน้าที่ — Page number', '1')
    .option('--page-size <number>', 'จำนวนต่อหน้า — Number of bills per page', '20')
    .option('--status <status>', 'กรองตามสถานะ: draft/posted/paid/voided/overdue — Filter by status')
    .option('--vendor-id <id>', 'กรองตาม vendor ID — Filter by vendor ID')
    .action(async (options: BillListOptions) => {
      await billList(options);
    });

  bill
    .command('create')
    .description('สร้างบิลค่าใช้จ่ายใหม่ (interactive) — Create a new bill interactively')
    .action(async () => {
      await billCreate();
    });

  bill
    .command('get <id>')
    .description('ดูรายละเอียดบิล — Get a single bill by ID')
    .action(async (id: string) => {
      await billGet(id);
    });

  bill
    .command('post <id>')
    .description('Post บิล draft ให้เป็น open payable — Post a draft bill, making it an open payable')
    .action(async (id: string) => {
      await billPost(id);
    });

  bill
    .command('void <id>')
    .description('ยกเลิกบิล (ป้องกันการชำระเงิน) — Void a bill, preventing further payment')
    .action(async (id: string) => {
      await billVoid(id);
    });

  return bill;
}
