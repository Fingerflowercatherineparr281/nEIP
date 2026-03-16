/**
 * neip quotations — Quotation (ใบเสนอราคา) commands.
 *
 * Commands:
 *   neip quotations list [--status draft] [--limit 20]
 *   neip quotations create       — interactive
 *   neip quotations get <id>
 *   neip quotations send <id>
 *   neip quotations approve <id>
 *   neip quotations reject <id> [--reason "..."]
 *   neip quotations convert <id> — convert to invoice
 *   neip quotations duplicate <id>
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuotationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'converted' | 'expired';

interface QuotationLineInput {
  description: string;
  quantity: number;
  unitPriceSatang: string;
}

interface Quotation {
  id: string;
  documentNumber: string;
  customerId: string;
  customerName: string;
  subject: string;
  notes: string | null;
  status: QuotationStatus;
  validUntil: string;
  totalSatang: string;
  convertedInvoiceId: string | null;
  lines: Array<{
    id: string;
    lineNumber: number;
    description: string;
    quantity: number;
    unitPriceSatang: string;
    amountSatang: string;
  }>;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

interface QuotationListResponse {
  items: Quotation[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface ListOptions {
  status?: string;
  customerId?: string;
  limit: string;
  offset: string;
}

interface RejectOptions {
  reason?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Prompt for a single line of input. */
function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Return a date N days from today as YYYY-MM-DD. */
function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Format a satang bigint string as Thai Baht. */
function formatBaht(satang: string): string {
  const baht = parseInt(satang, 10) / 100;
  return `฿${baht.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function listQuotations(options: ListOptions): Promise<void> {
  const params: Record<string, string> = {
    limit: options.limit,
    offset: options.offset,
  };
  if (options.status) params['status'] = options.status;
  if (options.customerId) params['customerId'] = options.customerId;

  const result = await api.get<QuotationListResponse>('/api/v1/quotations', params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { items, total } = result.data;

  if (items.length === 0) {
    printSuccess([], 'No quotations found.');
    return;
  }

  // Print as table rows
  const tableData = items.map((q) => ({
    'Doc Number': q.documentNumber,
    Customer: q.customerName,
    Subject: q.subject.slice(0, 30) + (q.subject.length > 30 ? '...' : ''),
    Amount: formatBaht(q.totalSatang),
    'Valid Until': q.validUntil,
    Status: q.status,
  }));

  printSuccess(tableData, `Showing ${String(items.length)} of ${String(total)} quotations`);
}

async function createQuotation(): Promise<void> {
  process.stdout.write('Creating a new quotation (ใบเสนอราคา). Enter details below.\n\n');

  const customerName = await promptLine('Customer name (ชื่อลูกค้า): ');
  if (!customerName) {
    printError('Customer name is required.');
    process.exit(1);
  }

  const customerId = await promptLine('Customer ID (optional): ');
  const subject = await promptLine('Subject (หัวข้อ): ');
  if (!subject) {
    printError('Subject is required.');
    process.exit(1);
  }

  const validUntilInput = await promptLine(
    `Valid until (YYYY-MM-DD) [${daysFromToday(30)}]: `,
  );
  const validUntil = validUntilInput || daysFromToday(30);

  const notes = await promptLine('Notes (optional): ');

  // Collect line items
  const lines: QuotationLineInput[] = [];
  process.stdout.write('\nEnter line items (leave Description blank to finish):\n');

  for (;;) {
    const description = await promptLine(`  Line ${String(lines.length + 1)} — Description: `);
    if (!description) break;

    const qtyStr = await promptLine('  Quantity [1]: ');
    const unitPriceStr = await promptLine('  Unit price (฿): ');

    const quantity = parseInt(qtyStr || '1', 10);
    const unitPriceBaht = parseFloat(unitPriceStr || '0');

    if (isNaN(quantity) || quantity < 1) {
      printError('Quantity must be a positive integer.');
      process.exit(1);
    }
    if (isNaN(unitPriceBaht) || unitPriceBaht < 0) {
      printError('Unit price must be a non-negative number.');
      process.exit(1);
    }

    const unitPriceSatang = String(Math.round(unitPriceBaht * 100));
    lines.push({ description, quantity, unitPriceSatang });
  }

  if (lines.length === 0) {
    printError('At least one line item is required.');
    process.exit(1);
  }

  const result = await api.post<Quotation>('/api/v1/quotations', {
    customerId: customerId || crypto.randomUUID(),
    customerName,
    subject,
    notes: notes || undefined,
    validUntil,
    lines,
  });

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, `Quotation ${result.data.documentNumber} created.`);
}

async function getQuotation(id: string): Promise<void> {
  const result = await api.get<Quotation>(`/api/v1/quotations/${id}`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const q = result.data;
  const display = {
    id: q.id,
    documentNumber: q.documentNumber,
    customerName: q.customerName,
    subject: q.subject,
    status: q.status,
    validUntil: q.validUntil,
    totalSatang: formatBaht(q.totalSatang),
    convertedInvoiceId: q.convertedInvoiceId,
    lines: q.lines.map((l) => ({
      lineNumber: l.lineNumber,
      description: l.description,
      quantity: l.quantity,
      unitPrice: formatBaht(l.unitPriceSatang),
      amount: formatBaht(l.amountSatang),
    })),
    notes: q.notes,
    sentAt: q.sentAt,
    approvedAt: q.approvedAt,
    rejectedAt: q.rejectedAt,
    createdAt: q.createdAt,
  };

  printSuccess(display, `Quotation ${q.documentNumber}`);
}

async function sendQuotation(id: string): Promise<void> {
  const result = await api.post<Quotation>(`/api/v1/quotations/${id}/send`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, `Quotation ${result.data.documentNumber} marked as sent.`);
}

async function approveQuotation(id: string): Promise<void> {
  const result = await api.post<Quotation>(`/api/v1/quotations/${id}/approve`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, `Quotation ${result.data.documentNumber} approved.`);
}

async function rejectQuotation(id: string, options: RejectOptions): Promise<void> {
  const body = options.reason ? { reason: options.reason } : undefined;
  const result = await api.post<Quotation>(`/api/v1/quotations/${id}/reject`, body);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, `Quotation ${result.data.documentNumber} rejected.`);
}

async function convertQuotation(id: string): Promise<void> {
  const result = await api.post<{ quotation: Quotation; invoiceId: string; invoiceNumber: string }>(
    `/api/v1/quotations/${id}/convert`,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { quotation, invoiceId, invoiceNumber } = result.data;
  printSuccess(
    { quotationId: quotation.id, invoiceId, invoiceNumber, status: quotation.status },
    `Quotation converted. Invoice ${invoiceNumber} created (ID: ${invoiceId}).`,
  );
}

async function duplicateQuotation(id: string): Promise<void> {
  const result = await api.post<Quotation>(`/api/v1/quotations/${id}/duplicate`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, `Quotation duplicated as ${result.data.documentNumber}.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `quotations` command group.
 */
export function buildQuotationsCommand(): Command {
  const quotations = new Command('quotations')
    .description('จัดการใบเสนอราคา — Quotation management')
    .addHelpText('after', `
Examples:
  $ neip quotations list                          # แสดงใบเสนอราคาทั้งหมด
  $ neip quotations list --status draft           # เฉพาะ draft
  $ neip quotations create                        # สร้างใบเสนอราคาใหม่ (interactive)
  $ neip quotations get <id>                      # ดูรายละเอียด
  $ neip quotations send <id>                     # ส่งให้ลูกค้า (draft → sent)
  $ neip quotations approve <id>                  # อนุมัติ (sent → approved)
  $ neip quotations reject <id> --reason "..."   # ปฏิเสธ
  $ neip quotations convert <id>                  # แปลงเป็น invoice (approved → converted)
  $ neip quotations duplicate <id>                # คัดลอกเป็น draft ใหม่

Status flow: draft → sent → approved → converted
  `);

  quotations
    .command('list')
    .description('แสดงรายการใบเสนอราคา — List quotations with optional filters')
    .option('--status <status>', 'กรองตามสถานะ: draft/sent/approved/rejected/converted/expired — Filter by status')
    .option('--customer-id <id>', 'กรองตาม customer ID — Filter by customer ID')
    .option('--limit <number>', 'จำนวนต่อหน้า — Number of results', '20')
    .option('--offset <number>', 'ข้าม N รายการแรก — Pagination offset', '0')
    .action(async (options: ListOptions) => {
      await listQuotations(options);
    });

  quotations
    .command('create')
    .description('สร้างใบเสนอราคาใหม่ (interactive) — Create a new quotation interactively')
    .action(async () => {
      await createQuotation();
    });

  quotations
    .command('get <id>')
    .description('ดูรายละเอียดใบเสนอราคา — Get quotation details by ID')
    .action(async (id: string) => {
      await getQuotation(id);
    });

  quotations
    .command('send <id>')
    .description('ทำเครื่องหมายส่งให้ลูกค้าแล้ว (draft → sent) — Mark quotation as sent to customer')
    .action(async (id: string) => {
      await sendQuotation(id);
    });

  quotations
    .command('approve <id>')
    .description('อนุมัติใบเสนอราคา (sent → approved) — Mark quotation as approved')
    .action(async (id: string) => {
      await approveQuotation(id);
    });

  quotations
    .command('reject <id>')
    .description('ปฏิเสธใบเสนอราคา (sent → rejected) — Mark quotation as rejected')
    .option('--reason <reason>', 'เหตุผลที่ปฏิเสธ — Rejection reason')
    .action(async (id: string, options: RejectOptions) => {
      await rejectQuotation(id, options);
    });

  quotations
    .command('convert <id>')
    .description('แปลงใบเสนอราคาเป็น invoice (approved → converted) — Convert approved quotation to invoice')
    .action(async (id: string) => {
      await convertQuotation(id);
    });

  quotations
    .command('duplicate <id>')
    .description('คัดลอกใบเสนอราคาเป็น draft ใหม่ — Duplicate a quotation as a new draft')
    .action(async (id: string) => {
      await duplicateQuotation(id);
    });

  return quotations;
}
