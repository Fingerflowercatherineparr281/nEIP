/**
 * neip inventory / products — Inventory management CLI commands.
 *
 * Commands:
 *   neip products list            — GET  /api/v1/products
 *   neip products create          — POST /api/v1/products (interactive)
 *   neip products update <id>     — PUT  /api/v1/products/:id
 *   neip inventory levels         — GET  /api/v1/stock-levels
 *   neip inventory movement       — POST /api/v1/stock-movements
 *   neip inventory valuation      — GET  /api/v1/inventory/valuation
 *   neip inventory low-stock      — GET  /api/v1/inventory/low-stock
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

export function buildProductsCommand(): Command {
  const cmd = new Command('products')
    .description('จัดการสินค้าและ catalog — Product catalog management')
    .addHelpText('after', `
Examples:
  $ neip products list                        # แสดงสินค้าทั้งหมด
  $ neip products list --search "laptop"      # ค้นหาสินค้า
  $ neip products create                      # สร้างสินค้าใหม่ (interactive)
  $ neip products update <id>                 # แก้ไขข้อมูลสินค้า
  `);

  cmd
    .command('list')
    .description('แสดงรายการสินค้า — List products')
    .option('--limit <n>', 'จำนวนสูงสุด — Max results', '50')
    .option('--offset <n>', 'ข้าม N รายการแรก — Skip first N records', '0')
    .option('--search <text>', 'ค้นหา SKU หรือชื่อ — Search by SKU or name', '')
    .action(async (opts: { limit: string; offset: string; search: string }) => {
      const params: Record<string, string> = { limit: opts.limit, offset: opts.offset };
      if (opts.search) params['search'] = opts.search;
      const result = await api.get<{ items: unknown[]; total: number }>('/api/v1/products', params);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data.items, `${String(result.data.items.length)} of ${String(result.data.total)} products`);
    });

  cmd
    .command('create')
    .description('สร้างสินค้าใหม่ (interactive) — Create a product interactively')
    .action(async () => {
      const sku      = await prompt('SKU: ');
      const nameTh   = await prompt('Name (TH): ');
      const nameEn   = await prompt('Name (EN): ');
      const unit     = await prompt('Unit (ชิ้น): ') || 'ชิ้น';
      const cost     = await prompt('Cost price in THB (0): ') || '0';
      const sell     = await prompt('Selling price in THB (0): ') || '0';
      const minStock = await prompt('Min stock level (0): ') || '0';

      if (!sku || !nameTh || !nameEn) { printError('sku, nameTh, nameEn are required.'); process.exit(1); }

      const result = await api.post<unknown>('/api/v1/products', {
        sku, nameTh, nameEn, unit,
        costPriceSatang: Math.round(parseFloat(cost) * 100),
        sellingPriceSatang: Math.round(parseFloat(sell) * 100),
        minStockLevel: parseInt(minStock, 10),
      });
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Product "${nameEn}" created.`);
    });

  cmd
    .command('update <id>')
    .description('แก้ไขข้อมูลสินค้า (interactive) — Update a product interactively')
    .action(async (id: string) => {
      process.stdout.write(`Updating product ${id}. Leave blank to keep existing values.\n`);
      const nameTh = await prompt('Name (TH): ');
      const nameEn = await prompt('Name (EN): ');
      const cost   = await prompt('Cost price in THB: ');
      const sell   = await prompt('Selling price in THB: ');

      const body: Record<string, unknown> = {};
      if (nameTh) body['nameTh'] = nameTh;
      if (nameEn) body['nameEn'] = nameEn;
      if (cost)   body['costPriceSatang'] = Math.round(parseFloat(cost) * 100);
      if (sell)   body['sellingPriceSatang'] = Math.round(parseFloat(sell) * 100);

      if (Object.keys(body).length === 0) { printError('No fields provided.'); process.exit(1); }

      const result = await api.put<unknown>(`/api/v1/products/${id}`, body);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Product ${id} updated.`);
    });

  return cmd;
}

export function buildInventoryCommand(): Command {
  const cmd = new Command('inventory')
    .description('จัดการสต็อกและคลังสินค้า — Inventory stock management')
    .addHelpText('after', `
Examples:
  $ neip inventory levels                    # ดูระดับสต็อกปัจจุบัน
  $ neip inventory movement                  # บันทึกการเคลื่อนไหวสต็อก (interactive)
  $ neip inventory valuation                 # รายงานมูลค่าสต็อก
  $ neip inventory low-stock                 # สินค้าที่ต่ำกว่า minimum stock
  `);

  cmd
    .command('levels')
    .description('แสดงระดับสต็อกปัจจุบัน — Show current stock levels')
    .action(async () => {
      const result = await api.get<{ items: unknown[] }>('/api/v1/stock-levels');
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data.items, `${String(result.data.items.length)} stock level entries`);
    });

  cmd
    .command('movement')
    .description('บันทึกการเคลื่อนไหวสต็อก (interactive) — Record a stock movement interactively')
    .action(async () => {
      const productId  = await prompt('Product ID: ');
      const warehouseId = await prompt('Warehouse ID: ');
      const movType    = await prompt('Movement type (receive/issue/adjust/return): ');
      const qty        = await prompt('Quantity: ');
      const notes      = await prompt('Notes (optional): ');

      const result = await api.post<unknown>('/api/v1/stock-movements', {
        productId, warehouseId,
        movementType: movType,
        quantity: parseInt(qty, 10),
        notes: notes || undefined,
      });
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, 'Stock movement recorded.');
    });

  cmd
    .command('valuation')
    .description('รายงานมูลค่าสต็อกสินค้า — Show stock valuation report')
    .action(async () => {
      const result = await api.get<{ items: unknown[]; grandTotalSatang: number }>('/api/v1/inventory/valuation');
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      const total = (result.data.grandTotalSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 });
      printSuccess(result.data.items, `Grand total: ฿${total}`);
    });

  cmd
    .command('low-stock')
    .description('แสดงสินค้าที่ต่ำกว่า minimum stock — List products below minimum stock level')
    .action(async () => {
      const result = await api.get<{ items: unknown[]; count: number }>('/api/v1/inventory/low-stock');
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      if (result.data.count === 0) {
        process.stdout.write('All products are above minimum stock levels.\n');
        return;
      }
      printSuccess(result.data.items, `${String(result.data.count)} products below minimum stock level`);
    });

  return cmd;
}
