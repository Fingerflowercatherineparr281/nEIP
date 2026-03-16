/**
 * neip ar do — Delivery Note commands (ใบส่งของ).
 *
 * Commands:
 *   neip ar do list         — list delivery notes
 *   neip ar do create       — create a delivery note interactively
 *   neip ar do get <id>     — get delivery note by ID
 *   neip ar do deliver <id> — mark as delivered
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../../lib/api-client.js';
import { printError, printSuccess } from '../../output/formatter.js';

interface DoListOptions {
  page: string;
  pageSize: string;
  status?: string;
  salesOrderId?: string;
}

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function doList(options: DoListOptions): Promise<void> {
  const params: Record<string, string> = { limit: options.pageSize, offset: String((parseInt(options.page) - 1) * parseInt(options.pageSize)) };
  if (options.status) params['status'] = options.status;
  if (options.salesOrderId) params['salesOrderId'] = options.salesOrderId;

  const result = await api.get<{ items: unknown[]; total: number }>('/api/v1/delivery-notes', params);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data.items, `${String(result.data.items.length)} of ${String(result.data.total)} delivery notes`);
}

async function doCreate(): Promise<void> {
  const salesOrderId = await promptLine('Sales Order ID: ');
  const customerId = await promptLine('Customer ID: ');
  const customerName = await promptLine('Customer Name: ');
  const deliveryDate = await promptLine(`Delivery date (YYYY-MM-DD) [${new Date().toISOString().slice(0, 10)}]: `);
  const notes = await promptLine('Notes (optional): ');

  if (!salesOrderId || !customerId || !customerName) { printError('Sales order ID, customer ID, and name are required.'); process.exit(1); }

  const lines: Array<{ salesOrderLineId: string; description: string; quantityDelivered: number }> = [];
  process.stdout.write('\nEnter delivery lines (leave SO Line ID blank to finish):\n');
  for (;;) {
    const soLineId = await promptLine(`  Line ${String(lines.length + 1)} — SO Line ID: `);
    if (!soLineId) break;
    const description = await promptLine('  Description: ');
    const qtyStr = await promptLine('  Quantity delivered: ');
    lines.push({ salesOrderLineId: soLineId, description, quantityDelivered: Number(qtyStr || '1') });
  }
  if (lines.length === 0) { printError('At least one delivery line is required.'); process.exit(1); }

  const result = await api.post<{ documentNumber: string }>('/api/v1/delivery-notes', {
    salesOrderId, customerId, customerName,
    deliveryDate: deliveryDate || new Date().toISOString().slice(0, 10),
    notes: notes || undefined,
    lines,
  });
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Delivery note ${result.data.documentNumber} created.`);
}

async function doGet(id: string): Promise<void> {
  if (!id) { printError('Delivery note ID is required.'); process.exit(1); }
  const result = await api.get<unknown>(`/api/v1/delivery-notes/${id}`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Delivery note ${id}:`);
}

async function doDeliver(id: string): Promise<void> {
  if (!id) { printError('Delivery note ID is required.'); process.exit(1); }
  const result = await api.post<{ documentNumber: string }>(`/api/v1/delivery-notes/${id}/deliver`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Delivery note ${id} marked as delivered.`);
}

export function buildArDoCommand(): Command {
  const cmd = new Command('do')
    .description('จัดการใบส่งของ — Delivery Note operations (ใบส่งของ)')
    .addHelpText('after', `
Examples:
  $ neip ar do list                          # แสดงใบส่งของทั้งหมด
  $ neip ar do create                        # สร้างใบส่งของใหม่ (interactive)
  $ neip ar do get <id>                      # ดูรายละเอียด
  $ neip ar do deliver <id>                  # ทำเครื่องหมายว่าส่งแล้ว
  `);

  cmd.command('list')
    .description('แสดงรายการใบส่งของ — List delivery notes')
    .option('--page <n>', 'หน้าที่ — Page number', '1')
    .option('--page-size <n>', 'จำนวนต่อหน้า — Items per page', '20')
    .option('--status <status>', 'กรองตามสถานะ — Filter by status')
    .option('--sales-order-id <id>', 'กรองตาม sales order ID — Filter by sales order ID')
    .action(async (options: DoListOptions) => { await doList(options); });

  cmd.command('create').description('สร้างใบส่งของใหม่ (interactive) — Create a delivery note interactively').action(async () => { await doCreate(); });
  cmd.command('get <id>').description('ดูรายละเอียดใบส่งของ — Get delivery note by ID').action(async (id: string) => { await doGet(id); });
  cmd.command('deliver <id>').description('ทำเครื่องหมายว่าส่งสินค้าแล้ว — Mark delivery note as delivered').action(async (id: string) => { await doDeliver(id); });

  return cmd;
}
