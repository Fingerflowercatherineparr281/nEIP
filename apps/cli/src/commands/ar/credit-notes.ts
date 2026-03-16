/**
 * neip ar cn — Credit Note commands (ใบลดหนี้).
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../../lib/api-client.js';
import { printError, printSuccess } from '../../output/formatter.js';

interface CnListOptions {
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

async function cnList(options: CnListOptions): Promise<void> {
  const params: Record<string, string> = { limit: options.pageSize, offset: String((parseInt(options.page) - 1) * parseInt(options.pageSize)) };
  if (options.status) params['status'] = options.status;
  if (options.customerId) params['customerId'] = options.customerId;

  const result = await api.get<{ items: unknown[]; total: number }>('/api/v1/credit-notes', params);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data.items, `${String(result.data.items.length)} of ${String(result.data.total)} credit notes`);
}

async function cnCreate(): Promise<void> {
  const invoiceId = await promptLine('Original Invoice ID: ');
  const customerId = await promptLine('Customer ID: ');
  const customerName = await promptLine('Customer Name: ');
  const reason = await promptLine('Reason: ');
  const notes = await promptLine('Notes (optional): ');

  if (!invoiceId || !customerId || !customerName || !reason) {
    printError('Invoice ID, customer, and reason are required.'); process.exit(1);
  }

  const lines: Array<{ description: string; quantity: number; unitPriceSatang: string }> = [];
  process.stdout.write('\nEnter credit lines (leave Description blank to finish):\n');
  for (;;) {
    const description = await promptLine(`  Line ${String(lines.length + 1)} — Description: `);
    if (!description) break;
    const qtyStr = await promptLine('  Quantity: ');
    const priceStr = await promptLine('  Unit price (THB): ');
    lines.push({ description, quantity: Number(qtyStr || '1'), unitPriceSatang: String(Math.round(Number(priceStr || '0') * 100)) });
  }
  if (lines.length === 0) { printError('At least one line is required.'); process.exit(1); }

  const result = await api.post<{ documentNumber: string }>('/api/v1/credit-notes', {
    invoiceId, customerId, customerName, reason, notes: notes || undefined, lines,
  });
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Credit note ${result.data.documentNumber} created.`);
}

async function cnGet(id: string): Promise<void> {
  if (!id) { printError('Credit note ID is required.'); process.exit(1); }
  const result = await api.get<unknown>(`/api/v1/credit-notes/${id}`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Credit note ${id}:`);
}

async function cnIssue(id: string): Promise<void> {
  if (!id) { printError('Credit note ID is required.'); process.exit(1); }
  const result = await api.post<{ documentNumber: string }>(`/api/v1/credit-notes/${id}/issue`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Credit note ${id} issued.`);
}

async function cnVoid(id: string): Promise<void> {
  if (!id) { printError('Credit note ID is required.'); process.exit(1); }
  const result = await api.post<{ documentNumber: string }>(`/api/v1/credit-notes/${id}/void`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Credit note ${id} voided.`);
}

export function buildArCnCommand(): Command {
  const cmd = new Command('cn')
    .description('จัดการใบลดหนี้ — Credit Note operations (ใบลดหนี้)')
    .addHelpText('after', `
Examples:
  $ neip ar cn list                          # แสดงใบลดหนี้ทั้งหมด
  $ neip ar cn create                        # สร้างใบลดหนี้ใหม่ (interactive)
  $ neip ar cn get <id>                      # ดูรายละเอียด
  $ neip ar cn issue <id>                    # ออกใบลดหนี้ (draft → issued)
  $ neip ar cn void <id>                     # ยกเลิกใบลดหนี้
  `);

  cmd.command('list')
    .description('แสดงรายการใบลดหนี้ — List credit notes')
    .option('--page <n>', 'หน้าที่ — Page number', '1')
    .option('--page-size <n>', 'จำนวนต่อหน้า — Items per page', '20')
    .option('--status <status>', 'กรองตามสถานะ: draft/issued/voided — Filter by status')
    .option('--customer-id <id>', 'กรองตาม customer ID — Filter by customer ID')
    .action(async (options: CnListOptions) => { await cnList(options); });

  cmd.command('create').description('สร้างใบลดหนี้ใหม่ (interactive) — Create a new credit note interactively').action(async () => { await cnCreate(); });
  cmd.command('get <id>').description('ดูรายละเอียดใบลดหนี้ — Get credit note by ID').action(async (id: string) => { await cnGet(id); });
  cmd.command('issue <id>').description('ออกใบลดหนี้ (draft → issued) — Issue a draft credit note').action(async (id: string) => { await cnIssue(id); });
  cmd.command('void <id>').description('ยกเลิกใบลดหนี้ — Void a credit note').action(async (id: string) => { await cnVoid(id); });

  return cmd;
}
