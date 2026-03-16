/**
 * neip assets — Fixed Assets commands (FI-AA).
 *
 * Commands:
 *   neip assets list               — list assets
 *   neip assets create             — register a new asset interactively
 *   neip assets get <id>           — get asset detail
 *   neip assets depreciate <id>    — run monthly depreciation
 *   neip assets dispose <id>       — dispose an asset
 *   neip assets report             — asset register report
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); resolve(a.trim()); });
  });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AssetListOptions {
  category?: string;
  status?: string;
}

interface AssetResponse {
  id: string;
  assetCode: string;
  nameEn: string;
  category: string;
  netBookValueSatang: string;
  status: string;
}

interface AssetListResponse {
  items: AssetResponse[];
  total: number;
}

async function assetsList(options: AssetListOptions): Promise<void> {
  const params: Record<string, string> = {};
  if (options.category) params['category'] = options.category;
  if (options.status) params['status'] = options.status;

  const result = await api.get<AssetListResponse>('/api/v1/fixed-assets', params);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }

  printSuccess(result.data.items, `${result.data.total} fixed assets`);
}

async function assetsCreate(): Promise<void> {
  process.stdout.write('Register a new fixed asset.\n');

  const assetCode = await prompt('Asset code (e.g. FA-2026-001): ');
  const nameTh = await prompt('Name (Thai): ');
  const nameEn = await prompt('Name (English): ');
  const category = await prompt('Category (equipment/vehicle/building/land/furniture/it_equipment/other): ');
  const purchaseDate = await prompt(`Purchase date [${today()}]: `);
  const purchaseCostThb = await prompt('Purchase cost (THB): ');
  const salvageThb = await prompt('Salvage value (THB) [0]: ');
  const usefulLifeMonths = await prompt('Useful life (months) [60]: ');
  const method = await prompt('Depreciation method (straight_line/declining_balance) [straight_line]: ');

  const purchaseCostSatang = String(Math.round(parseFloat(purchaseCostThb || '0') * 100));
  const salvageSatang = String(Math.round(parseFloat(salvageThb || '0') * 100));

  const result = await api.post<{ id: string; assetCode: string }>('/api/v1/fixed-assets', {
    assetCode,
    nameTh,
    nameEn,
    category: category || 'equipment',
    purchaseDate: purchaseDate || today(),
    purchaseCostSatang,
    salvageValueSatang: salvageSatang,
    usefulLifeMonths: parseInt(usefulLifeMonths || '60', 10),
    depreciationMethod: method || 'straight_line',
  });

  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Asset ${result.data.assetCode} registered.`);
}

async function assetsGet(id: string): Promise<void> {
  const result = await api.get<AssetResponse>(`/api/v1/fixed-assets/${id}`);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Asset ${id}:`);
}

async function assetsDepreciate(id: string): Promise<void> {
  const result = await api.post<{ depreciationSatang: string; journalEntryId: string }>(`/api/v1/fixed-assets/${id}/depreciate`, {});
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  const thb = (parseInt(result.data.depreciationSatang, 10) / 100).toFixed(2);
  printSuccess(result.data, `Depreciation of ฿${thb} recorded. JE: ${result.data.journalEntryId}`);
}

async function assetsDispose(id: string): Promise<void> {
  const disposalDate = await prompt(`Disposal date [${today()}]: `);
  const amountThb = await prompt('Disposal proceeds (THB): ');

  const result = await api.post<{ gainLossSatang: string }>(`/api/v1/fixed-assets/${id}/dispose`, {
    disposalDate: disposalDate || today(),
    disposalAmountSatang: String(Math.round(parseFloat(amountThb || '0') * 100)),
  });

  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  const gl = parseInt(result.data.gainLossSatang, 10) / 100;
  const label = gl >= 0 ? `Gain: ฿${gl.toFixed(2)}` : `Loss: ฿${Math.abs(gl).toFixed(2)}`;
  printSuccess(result.data, `Asset disposed. ${label}`);
}

async function assetsReport(): Promise<void> {
  const result = await api.get<{
    summary: { category: string; assetCount: string; totalNetBookValueSatang: string }[];
    totalNetBookValueSatang: string;
  }>('/api/v1/fixed-assets/report');

  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Asset Register Report — NBV ฿${(parseInt(result.data.totalNetBookValueSatang, 10) / 100).toFixed(2)}`);
}

export function buildAssetsCommand(): Command {
  const cmd = new Command('assets')
    .description('จัดการสินทรัพย์ถาวร (FI-AA) — Fixed Asset management')
    .addHelpText('after', `
Examples:
  $ neip assets list                             # แสดงสินทรัพย์ทั้งหมด
  $ neip assets list --category equipment        # เฉพาะ equipment
  $ neip assets create                           # ลงทะเบียนสินทรัพย์ใหม่ (interactive)
  $ neip assets get <id>                         # ดูรายละเอียด
  $ neip assets depreciate <id>                  # คำนวณค่าเสื่อมราคา
  $ neip assets dispose <id>                     # ขาย/จำหน่ายสินทรัพย์
  $ neip assets report                           # รายงานทะเบียนสินทรัพย์

Categories: equipment, vehicle, building, land, furniture, it_equipment, other
  `);

  cmd.command('list')
    .description('แสดงรายการสินทรัพย์ถาวร — List fixed assets')
    .option('--category <cat>', 'กรองตามประเภท — Filter by category: equipment/vehicle/building/land/furniture/it_equipment/other')
    .option('--status <status>', 'กรองตามสถานะ — Filter by status: active/disposed/written_off')
    .action(async (opts: AssetListOptions) => { await assetsList(opts); });

  cmd.command('create')
    .description('ลงทะเบียนสินทรัพย์ถาวรใหม่ (interactive) — Register a new fixed asset interactively')
    .action(async () => { await assetsCreate(); });

  cmd.command('get <id>')
    .description('ดูรายละเอียดสินทรัพย์ — Get fixed asset detail')
    .action(async (id: string) => { await assetsGet(id); });

  cmd.command('depreciate <id>')
    .description('คำนวณค่าเสื่อมราคารายเดือน — Run monthly depreciation for an asset')
    .action(async (id: string) => { await assetsDepreciate(id); });

  cmd.command('dispose <id>')
    .description('ขาย/จำหน่ายสินทรัพย์ถาวร — Dispose a fixed asset')
    .action(async (id: string) => { await assetsDispose(id); });

  cmd.command('report')
    .description('รายงานทะเบียนสินทรัพย์แยกตามประเภท — Asset register report by category')
    .action(async () => { await assetsReport(); });

  return cmd;
}
