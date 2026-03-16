/**
 * neip ap po — Purchase Order commands (ใบสั่งซื้อ).
 *
 * Commands:
 *   neip ap po list             — list purchase orders
 *   neip ap po create           — create a new purchase order
 *   neip ap po get <id>         — get a purchase order
 *   neip ap po send <id>        — send to vendor
 *   neip ap po receive <id>     — record received goods
 *   neip ap po convert <id>     — convert to bill
 *   neip ap po cancel <id>      — cancel
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../../lib/api-client.js';
import { printError, printSuccess } from '../../output/formatter.js';

interface PoListOptions {
  page: string;
  pageSize: string;
  status?: string;
  vendorId?: string;
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

async function poList(options: PoListOptions): Promise<void> {
  const params: Record<string, string> = { limit: options.pageSize, offset: String((parseInt(options.page) - 1) * parseInt(options.pageSize)) };
  if (options.status) params['status'] = options.status;
  if (options.vendorId) params['vendorId'] = options.vendorId;

  const result = await api.get<{ items: unknown[]; total: number }>('/api/v1/purchase-orders', params);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data.items, `${String(result.data.items.length)} of ${String(result.data.total)} purchase orders`);
}

async function poCreate(): Promise<void> {
  process.stdout.write('Creating a new purchase order.\n');
  const vendorId = await promptLine('Vendor ID: ');
  const orderDate = await promptLine(`Order date [${today()}]: `);
  const expectedDate = await promptLine('Expected delivery date (optional): ');
  const notes = await promptLine('Notes (optional): ');

  if (!vendorId) { printError('Vendor ID is required.'); process.exit(1); }

  const lines: Array<{ description: string; quantity: number; unitPriceSatang: string }> = [];
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

  const result = await api.post<{ documentNumber: string }>('/api/v1/purchase-orders', {
    vendorId,
    orderDate: orderDate || today(),
    expectedDate: expectedDate || undefined,
    notes: notes || undefined,
    lines,
  });
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Purchase order ${result.data.documentNumber} created.`);
}

async function poGet(id: string): Promise<void> {
  if (!id) { printError('Purchase order ID is required.'); process.exit(1); }
  const result = await api.get<unknown>(`/api/v1/purchase-orders/${id}`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Purchase order ${id}:`);
}

async function poSend(id: string): Promise<void> {
  if (!id) { printError('Purchase order ID is required.'); process.exit(1); }
  const result = await api.post<{ documentNumber: string }>(`/api/v1/purchase-orders/${id}/send`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Purchase order ${id} sent to vendor.`);
}

async function poReceive(id: string): Promise<void> {
  if (!id) { printError('Purchase order ID is required.'); process.exit(1); }

  // First get the PO to show lines
  const poResult = await api.get<{ lines: Array<{ id: string; description: string; quantity: number; receivedQuantity: number }> }>(`/api/v1/purchase-orders/${id}`);
  if (!poResult.ok) { printError(poResult.error.detail, poResult.error.status); process.exit(1); }

  const receiveLines: Array<{ lineId: string; quantityReceived: number }> = [];
  process.stdout.write('\nEnter quantities received for each line (press Enter to skip):\n');
  for (const line of poResult.data.lines) {
    const remaining = line.quantity - line.receivedQuantity;
    const qtyStr = await promptLine(`  ${line.description} (ordered: ${String(line.quantity)}, received: ${String(line.receivedQuantity)}, remaining: ${String(remaining)}) — qty now receiving [${String(remaining)}]: `);
    const qty = qtyStr ? Number(qtyStr) : remaining;
    if (qty > 0) receiveLines.push({ lineId: line.id, quantityReceived: qty });
  }

  if (receiveLines.length === 0) { printError('No lines to receive.'); process.exit(1); }

  const result = await api.post<unknown>(`/api/v1/purchase-orders/${id}/receive`, { lines: receiveLines });
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Received goods recorded for purchase order ${id}.`);
}

async function poConvert(id: string): Promise<void> {
  if (!id) { printError('Purchase order ID is required.'); process.exit(1); }
  const result = await api.post<{ billId: string; billDocumentNumber: string }>(`/api/v1/purchase-orders/${id}/convert-to-bill`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Purchase order ${id} converted to bill ${result.data.billDocumentNumber}.`);
}

async function poCancel(id: string): Promise<void> {
  if (!id) { printError('Purchase order ID is required.'); process.exit(1); }
  const result = await api.post<{ documentNumber: string }>(`/api/v1/purchase-orders/${id}/cancel`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Purchase order ${id} cancelled.`);
}

export function buildApPoCommand(): Command {
  const cmd = new Command('po')
    .description('จัดการใบสั่งซื้อ — Purchase Order operations (ใบสั่งซื้อ)')
    .addHelpText('after', `
Examples:
  $ neip ap po list                          # แสดงใบสั่งซื้อทั้งหมด
  $ neip ap po list --status sent            # เฉพาะที่ส่งแล้ว
  $ neip ap po list --vendor-id <id>         # กรองตาม vendor
  $ neip ap po create                        # สร้างใบสั่งซื้อใหม่ (interactive)
  $ neip ap po get <id>                      # ดูรายละเอียด
  $ neip ap po send <id>                     # ส่งให้ vendor
  $ neip ap po receive <id>                  # บันทึกรับสินค้า
  $ neip ap po convert <id>                  # แปลงเป็นบิล (AP)
  $ neip ap po cancel <id>                   # ยกเลิกใบสั่งซื้อ

Status flow: draft → sent → partially_received → received | cancelled
  `);

  cmd.command('list')
    .description('แสดงรายการใบสั่งซื้อ — List purchase orders')
    .option('--page <n>', 'หน้าที่ — Page number', '1')
    .option('--page-size <n>', 'จำนวนต่อหน้า — Items per page', '20')
    .option('--status <status>', 'กรองตามสถานะ: draft/sent/received/cancelled — Filter by status')
    .option('--vendor-id <id>', 'กรองตาม vendor ID — Filter by vendor ID')
    .action(async (options: PoListOptions) => { await poList(options); });

  cmd.command('create').description('สร้างใบสั่งซื้อใหม่ (interactive) — Create a new purchase order interactively').action(async () => { await poCreate(); });
  cmd.command('get <id>').description('ดูรายละเอียดใบสั่งซื้อ — Get purchase order by ID').action(async (id: string) => { await poGet(id); });
  cmd.command('send <id>').description('ส่งใบสั่งซื้อให้ vendor — Send purchase order to vendor').action(async (id: string) => { await poSend(id); });
  cmd.command('receive <id>').description('บันทึกการรับสินค้า — Record received goods').action(async (id: string) => { await poReceive(id); });
  cmd.command('convert <id>').description('แปลงใบสั่งซื้อเป็น AP bill — Convert purchase order to bill').action(async (id: string) => { await poConvert(id); });
  cmd.command('cancel <id>').description('ยกเลิกใบสั่งซื้อ — Cancel a purchase order').action(async (id: string) => { await poCancel(id); });

  return cmd;
}
