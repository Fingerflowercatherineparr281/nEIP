/**
 * neip ar invoice — Accounts Receivable invoice commands.
 *
 * Commands:
 *   neip ar invoice create       — create a new invoice interactively
 *   neip ar invoice list         — list invoices (paginated)
 *   neip ar invoice void <id>    — void an existing invoice
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../../lib/api-client.js';
import { printError, printSuccess } from '../../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single line item on an invoice. */
interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  accountId: string;
}

/** Payload sent to create an invoice. */
interface CreateInvoicePayload {
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  reference: string;
  notes: string;
  lines: InvoiceLine[];
}

/** Response shape for an invoice resource. */
interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: 'draft' | 'sent' | 'paid' | 'voided' | 'overdue';
  invoiceDate: string;
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

/** Options accepted by `ar invoice list`. */
interface InvoiceListOptions {
  page: string;
  pageSize: string;
  status?: string;
  customerId?: string;
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

async function invoiceCreate(): Promise<void> {
  process.stdout.write('Creating a new invoice. Enter details below.\n');

  const customerId = await promptLine('Customer ID: ');
  const reference = await promptLine('Reference / PO number (optional): ');
  const invoiceDateInput = await promptLine(`Invoice date (YYYY-MM-DD) [${today()}]: `);
  const dueDateInput = await promptLine(`Due date (YYYY-MM-DD) [${daysFromToday(30)}]: `);
  const notes = await promptLine('Notes (optional): ');

  if (customerId === '') {
    printError('Customer ID is required.');
    process.exit(1);
  }

  const invoiceDate = invoiceDateInput === '' ? today() : invoiceDateInput;
  const dueDate = dueDateInput === '' ? daysFromToday(30) : dueDateInput;

  // Collect at least one line
  const lines: InvoiceLine[] = [];
  process.stdout.write('\nEnter line items (leave Description blank to finish):\n');

  for (;;) {
    const description = await promptLine(`  Line ${String(lines.length + 1)} — Description: `);
    if (description === '') break;

    const qtyStr = await promptLine('  Quantity: ');
    const unitPriceStr = await promptLine('  Unit price: ');
    const accountId = await promptLine('  Revenue account ID: ');

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
      printError('Revenue account ID is required for each line.');
      process.exit(1);
    }

    lines.push({ description, quantity, unitPrice, accountId });
  }

  if (lines.length === 0) {
    printError('At least one line item is required.');
    process.exit(1);
  }

  const payload: CreateInvoicePayload = {
    customerId,
    invoiceDate,
    dueDate,
    reference,
    notes,
    lines,
  };

  const result = await api.post<{ data: Invoice }>(
    '/api/v1/ar/invoices',
    payload,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Invoice ${result.data.data.invoiceNumber} created.`);
}

async function invoiceList(options: InvoiceListOptions): Promise<void> {
  const params: Record<string, string> = {
    page: options.page,
    pageSize: options.pageSize,
  };

  if (options.status !== undefined && options.status !== '') {
    params['status'] = options.status;
  }
  if (options.customerId !== undefined && options.customerId !== '') {
    params['customerId'] = options.customerId;
  }

  const result = await api.get<PaginatedResponse<Invoice>>(
    '/api/v1/ar/invoices',
    params,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data, total, page, pageSize } = result.data;

  printSuccess(
    data,
    `Showing ${String(data.length)} of ${String(total)} invoices (page ${String(page)}/${String(Math.ceil(total / pageSize))})`,
  );
}

async function invoiceVoid(id: string): Promise<void> {
  if (id === '') {
    printError('Invoice ID is required.');
    process.exit(1);
  }

  const result = await api.post<{ data: Invoice }>(
    `/api/v1/ar/invoices/${id}/void`,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Invoice ${id} has been voided.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `ar invoice` sub-command group.
 */
export function buildInvoiceCommand(): Command {
  const invoice = new Command('invoice')
    .description('จัดการใบแจ้งหนี้ลูกหนี้ (AR) — Accounts Receivable invoice operations')
    .addHelpText('after', `
Examples:
  $ neip ar invoice create                       # สร้างใบแจ้งหนี้ใหม่ (interactive)
  $ neip ar invoice list                         # แสดงใบแจ้งหนี้ทั้งหมด
  $ neip ar invoice list --status overdue        # เฉพาะที่เกินกำหนด
  $ neip ar invoice list --customer-id <id>      # กรองตามลูกค้า
  $ neip ar invoice void <id>                    # ยกเลิกใบแจ้งหนี้

Status flow: draft → sent → paid | voided | overdue
  `);

  invoice
    .command('create')
    .description('สร้างใบแจ้งหนี้ใหม่ (interactive) — Create a new invoice interactively')
    .action(async () => {
      await invoiceCreate();
    });

  invoice
    .command('list')
    .description('แสดงรายการใบแจ้งหนี้ — List invoices with optional pagination and filters')
    .option('--page <number>', 'หน้าที่ — Page number', '1')
    .option('--page-size <number>', 'จำนวนต่อหน้า — Number of invoices per page', '20')
    .option('--status <status>', 'กรองตามสถานะ: draft/sent/paid/voided/overdue — Filter by status')
    .option('--customer-id <id>', 'กรองตาม customer ID — Filter by customer ID')
    .action(async (options: InvoiceListOptions) => {
      await invoiceList(options);
    });

  invoice
    .command('void <id>')
    .description('ยกเลิกใบแจ้งหนี้ (ป้องกันการชำระเงินเพิ่ม) — Void an invoice, preventing further payment')
    .action(async (id: string) => {
      await invoiceVoid(id);
    });

  return invoice;
}
