/**
 * neip cost-centers — Cost Center commands (CO-CCA).
 *
 * Commands:
 *   neip cost-centers list         — list cost centers
 *   neip cost-centers create       — create a cost center interactively
 *   neip cost-centers update <id>  — update a cost center
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

interface CostCenter {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  parentId: string | null;
  isActive: boolean;
}

async function ccList(): Promise<void> {
  const result = await api.get<{ items: CostCenter[]; total: number }>('/api/v1/cost-centers');
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data.items, `${result.data.total} cost centers`);
}

async function ccCreate(): Promise<void> {
  const code = await prompt('Code (e.g. CC-SALES): ');
  const nameTh = await prompt('Name (Thai): ');
  const nameEn = await prompt('Name (English): ');
  const parentId = await prompt('Parent ID (optional): ');

  if (!code || !nameTh || !nameEn) { printError('Code, Thai name and English name are required.'); process.exit(1); }

  const result = await api.post<CostCenter>('/api/v1/cost-centers', {
    code,
    nameTh,
    nameEn,
    parentId: parentId || undefined,
  });

  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Cost center ${result.data.code} created.`);
}

async function ccUpdate(id: string): Promise<void> {
  const nameTh = await prompt('New Thai name (leave blank to keep): ');
  const nameEn = await prompt('New English name (leave blank to keep): ');
  const isActiveStr = await prompt('Is active? (true/false, leave blank to keep): ');

  const body: Record<string, unknown> = {};
  if (nameTh) body['nameTh'] = nameTh;
  if (nameEn) body['nameEn'] = nameEn;
  if (isActiveStr) body['isActive'] = isActiveStr === 'true';

  const result = await api.put<CostCenter>(`/api/v1/cost-centers/${id}`, body);
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Cost center ${id} updated.`);
}

export function buildCostCentersCommand(): Command {
  const cmd = new Command('cost-centers')
    .description('จัดการศูนย์ต้นทุน (CO-CCA) — Cost center management')
    .addHelpText('after', `
Examples:
  $ neip cost-centers list                   # แสดงศูนย์ต้นทุนทั้งหมด
  $ neip cost-centers create                 # สร้างศูนย์ต้นทุนใหม่ (interactive)
  $ neip cost-centers update <id>            # แก้ไขศูนย์ต้นทุน
  `);

  cmd.command('list')
    .description('แสดงรายการศูนย์ต้นทุน — List cost centers')
    .action(async () => { await ccList(); });
  cmd.command('create')
    .description('สร้างศูนย์ต้นทุนใหม่ (interactive) — Create a cost center interactively')
    .action(async () => { await ccCreate(); });
  cmd.command('update <id>')
    .description('แก้ไขศูนย์ต้นทุน (interactive) — Update a cost center interactively')
    .action(async (id: string) => { await ccUpdate(id); });

  return cmd;
}
