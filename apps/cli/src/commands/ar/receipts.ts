/**
 * neip ar receipts — Receipt commands (ใบเสร็จรับเงิน).
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../../lib/api-client.js';
import { printError, printSuccess } from '../../output/formatter.js';

interface ReceiptListOptions {
  page: string;
  pageSize: string;
  status?: string;
  customerId?: string;
}

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function receiptList(options: ReceiptListOptions): Promise<void> {
  const params: Record<string, string> = { limit: options.pageSize, offset: String((parseInt(options.page) - 1) * parseInt(options.pageSize)) };
  if (options.status) params['status'] = options.status;
  if (options.customerId) params['customerId'] = options.customerId;

  const result = await api.get<{ items: unknown[]; total: number }>('/api/v1/receipts', params);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data.items, `${String(result.data.items.length)} of ${String(result.data.total)} receipts`);
}

async function receiptCreate(): Promise<void> {
  const customerId = await promptLine('Customer ID: ');
  const customerName = await promptLine('Customer Name: ');
  const amountBaht = await promptLine('Amount (THB): ');
  const receiptDate = await promptLine(`Receipt date [${new Date().toISOString().slice(0, 10)}]: `);
  const paymentMethod = await promptLine('Payment method (cash/bank_transfer/cheque/promptpay) [cash]: ');
  const reference = await promptLine('Reference (optional): ');
  const invoiceId = await promptLine('Invoice ID (optional): ');

  if (!customerId || !customerName || !amountBaht) { printError('Customer ID, name, and amount are required.'); process.exit(1); }

  const result = await api.post<{ documentNumber: string }>('/api/v1/receipts', {
    customerId, customerName,
    amountSatang: String(Math.round(parseFloat(amountBaht) * 100)),
    receiptDate: receiptDate || new Date().toISOString().slice(0, 10),
    paymentMethod: paymentMethod || 'cash',
    reference: reference || undefined,
    invoiceId: invoiceId || undefined,
  });
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Receipt ${result.data.documentNumber} issued.`);
}

async function receiptGet(id: string): Promise<void> {
  if (!id) { printError('Receipt ID is required.'); process.exit(1); }
  const result = await api.get<unknown>(`/api/v1/receipts/${id}`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Receipt ${id}:`);
}

async function receiptVoid(id: string): Promise<void> {
  if (!id) { printError('Receipt ID is required.'); process.exit(1); }
  const result = await api.post<{ documentNumber: string }>(`/api/v1/receipts/${id}/void`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Receipt ${id} voided.`);
}

export function buildArReceiptsCommand(): Command {
  const cmd = new Command('receipts')
    .description('จัดการใบเสร็จรับเงิน — Receipt operations (ใบเสร็จรับเงิน)')
    .addHelpText('after', `
Examples:
  $ neip ar receipts list                    # แสดงใบเสร็จทั้งหมด
  $ neip ar receipts create                  # ออกใบเสร็จใหม่ (interactive)
  $ neip ar receipts get <id>                # ดูรายละเอียด
  $ neip ar receipts void <id>               # ยกเลิกใบเสร็จ

Payment methods: cash, bank_transfer, cheque, promptpay
  `);

  cmd.command('list')
    .description('แสดงรายการใบเสร็จรับเงิน — List receipts')
    .option('--page <n>', 'หน้าที่ — Page number', '1')
    .option('--page-size <n>', 'จำนวนต่อหน้า — Items per page', '20')
    .option('--status <status>', 'กรองตามสถานะ: issued/voided — Filter by status')
    .option('--customer-id <id>', 'กรองตาม customer ID — Filter by customer ID')
    .action(async (options: ReceiptListOptions) => { await receiptList(options); });

  cmd.command('create').description('ออกใบเสร็จรับเงินใหม่ (interactive) — Issue a new receipt interactively').action(async () => { await receiptCreate(); });
  cmd.command('get <id>').description('ดูรายละเอียดใบเสร็จ — Get receipt by ID').action(async (id: string) => { await receiptGet(id); });
  cmd.command('void <id>').description('ยกเลิกใบเสร็จ — Void a receipt').action(async (id: string) => { await receiptVoid(id); });

  return cmd;
}
