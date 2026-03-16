/**
 * neip ar so — Sales Order commands (ใบสั่งขาย).
 *
 * Commands:
 *   neip ar so list            — list sales orders
 *   neip ar so create          — create a new sales order
 *   neip ar so get <id>        — get a single sales order
 *   neip ar so confirm <id>    — confirm a draft sales order
 *   neip ar so cancel <id>     — cancel a sales order
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../../lib/api-client.js';
import { printError, printSuccess } from '../../output/formatter.js';

interface SoLine {
  description: string;
  quantity: number;
  unitPriceSatang: string;
}

interface SoListOptions {
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function soList(options: SoListOptions): Promise<void> {
  const params: Record<string, string> = { limit: options.pageSize, offset: String((parseInt(options.page) - 1) * parseInt(options.pageSize)) };
  if (options.status) params['status'] = options.status;
  if (options.customerId) params['customerId'] = options.customerId;

  const result = await api.get<{ items: unknown[]; total: number }>('/api/v1/sales-orders', params);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data.items, `${String(result.data.items.length)} of ${String(result.data.total)} sales orders`);
}

async function soCreate(): Promise<void> {
  process.stdout.write('Creating a new sales order.\n');
  const customerId = await promptLine('Customer ID: ');
  const customerName = await promptLine('Customer Name: ');
  const orderDate = await promptLine(`Order date (YYYY-MM-DD) [${today()}]: `);
  const expectedDeliveryDate = await promptLine('Expected delivery date (YYYY-MM-DD, optional): ');
  const quotationId = await promptLine('Quotation ID (optional): ');
  const notes = await promptLine('Notes (optional): ');

  if (!customerId || !customerName) { printError('Customer ID and name are required.'); process.exit(1); }

  const lines: SoLine[] = [];
  process.stdout.write('\nEnter line items (leave Description blank to finish):\n');
  for (;;) {
    const description = await promptLine(`  Line ${String(lines.length + 1)} — Description: `);
    if (!description) break;
    const qtyStr = await promptLine('  Quantity: ');
    const priceStr = await promptLine('  Unit price (THB): ');
    const qty = Number(qtyStr || '1');
    const price = Number(priceStr || '0');
    if (isNaN(qty) || qty <= 0) { printError('Quantity must be positive.'); process.exit(1); }
    lines.push({ description, quantity: qty, unitPriceSatang: String(Math.round(price * 100)) });
  }
  if (lines.length === 0) { printError('At least one line item is required.'); process.exit(1); }

  const result = await api.post<{ id: string; documentNumber: string }>('/api/v1/sales-orders', {
    customerId, customerName,
    orderDate: orderDate || today(),
    expectedDeliveryDate: expectedDeliveryDate || undefined,
    quotationId: quotationId || undefined,
    notes: notes || undefined,
    lines,
  });

  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Sales order ${result.data.documentNumber} created.`);
}

async function soGet(id: string): Promise<void> {
  if (!id) { printError('Sales order ID is required.'); process.exit(1); }
  const result = await api.get<unknown>(`/api/v1/sales-orders/${id}`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Sales order ${id}:`);
}

async function soConfirm(id: string): Promise<void> {
  if (!id) { printError('Sales order ID is required.'); process.exit(1); }
  const result = await api.post<{ documentNumber: string }>(`/api/v1/sales-orders/${id}/confirm`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Sales order ${id} confirmed.`);
}

async function soCancel(id: string): Promise<void> {
  if (!id) { printError('Sales order ID is required.'); process.exit(1); }
  const result = await api.post<{ documentNumber: string }>(`/api/v1/sales-orders/${id}/cancel`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Sales order ${id} cancelled.`);
}

export function buildArSoCommand(): Command {
  const so = new Command('so')
    .description('จัดการใบสั่งขาย — Sales Order operations (ใบสั่งขาย)')
    .addHelpText('after', `
Examples:
  $ neip ar so list                          # แสดงใบสั่งขายทั้งหมด
  $ neip ar so list --status confirmed       # เฉพาะที่ confirm แล้ว
  $ neip ar so create                        # สร้างใบสั่งขายใหม่ (interactive)
  $ neip ar so get <id>                      # ดูรายละเอียด
  $ neip ar so confirm <id>                  # ยืนยันใบสั่งขาย
  $ neip ar so cancel <id>                   # ยกเลิกใบสั่งขาย

Status flow: draft → confirmed → delivered | cancelled
  `);

  so.command('list')
    .description('แสดงรายการใบสั่งขาย — List sales orders')
    .option('--page <n>', 'หน้าที่ — Page number', '1')
    .option('--page-size <n>', 'จำนวนต่อหน้า — Items per page', '20')
    .option('--status <status>', 'กรองตามสถานะ — Filter by status')
    .option('--customer-id <id>', 'กรองตาม customer ID — Filter by customer ID')
    .action(async (options: SoListOptions) => { await soList(options); });

  so.command('create').description('สร้างใบสั่งขายใหม่ (interactive) — Create a new sales order').action(async () => { await soCreate(); });
  so.command('get <id>').description('ดูรายละเอียดใบสั่งขาย — Get sales order by ID').action(async (id: string) => { await soGet(id); });
  so.command('confirm <id>').description('ยืนยันใบสั่งขาย draft — Confirm a draft sales order').action(async (id: string) => { await soConfirm(id); });
  so.command('cancel <id>').description('ยกเลิกใบสั่งขาย — Cancel a sales order').action(async (id: string) => { await soCancel(id); });

  return so;
}
