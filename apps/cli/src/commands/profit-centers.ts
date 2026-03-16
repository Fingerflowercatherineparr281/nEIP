/**
 * neip profit-centers — Profit Center commands (CO-PCA).
 *
 * Commands:
 *   neip profit-centers list         — list profit centers
 *   neip profit-centers create       — create a profit center interactively
 *   neip profit-centers update <id>  — update a profit center
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

interface ProfitCenter {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  parentId: string | null;
  isActive: boolean;
}

async function pcList(): Promise<void> {
  const result = await api.get<{ items: ProfitCenter[]; total: number }>('/api/v1/profit-centers');
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data.items, `${result.data.total} profit centers`);
}

async function pcCreate(): Promise<void> {
  const code = await prompt('Code (e.g. PC-RETAIL): ');
  const nameTh = await prompt('Name (Thai): ');
  const nameEn = await prompt('Name (English): ');
  const parentId = await prompt('Parent ID (optional): ');

  if (!code || !nameTh || !nameEn) { printError('Code, Thai name and English name are required.'); process.exit(1); }

  const result = await api.post<ProfitCenter>('/api/v1/profit-centers', {
    code,
    nameTh,
    nameEn,
    parentId: parentId || undefined,
  });

  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Profit center ${result.data.code} created.`);
}

async function pcUpdate(id: string): Promise<void> {
  const nameTh = await prompt('New Thai name (leave blank to keep): ');
  const nameEn = await prompt('New English name (leave blank to keep): ');
  const isActiveStr = await prompt('Is active? (true/false, leave blank to keep): ');

  const body: Record<string, unknown> = {};
  if (nameTh) body['nameTh'] = nameTh;
  if (nameEn) body['nameEn'] = nameEn;
  if (isActiveStr) body['isActive'] = isActiveStr === 'true';

  const result = await api.put<ProfitCenter>(`/api/v1/profit-centers/${id}`, body);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Profit center ${id} updated.`);
}

export function buildProfitCentersCommand(): Command {
  const cmd = new Command('profit-centers')
    .description('จัดการศูนย์กำไร (CO-PCA) — Profit center management')
    .addHelpText('after', `
Examples:
  $ neip profit-centers list                 # แสดงศูนย์กำไรทั้งหมด
  $ neip profit-centers create               # สร้างศูนย์กำไรใหม่ (interactive)
  $ neip profit-centers update <id>          # แก้ไขศูนย์กำไร
  `);

  cmd.command('list')
    .description('แสดงรายการศูนย์กำไร — List profit centers')
    .action(async () => { await pcList(); });
  cmd.command('create')
    .description('สร้างศูนย์กำไรใหม่ (interactive) — Create a profit center interactively')
    .action(async () => { await pcCreate(); });
  cmd.command('update <id>')
    .description('แก้ไขศูนย์กำไร (interactive) — Update a profit center interactively')
    .action(async (id: string) => { await pcUpdate(id); });

  return cmd;
}
