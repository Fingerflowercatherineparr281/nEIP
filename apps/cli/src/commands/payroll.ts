/**
 * neip payroll — Payroll management CLI.
 *
 * Commands:
 *   neip payroll list        — GET  /api/v1/payroll
 *   neip payroll create      — POST /api/v1/payroll
 *   neip payroll calculate   — POST /api/v1/payroll/:id/calculate
 *   neip payroll approve     — POST /api/v1/payroll/:id/approve
 *   neip payroll pay         — POST /api/v1/payroll/:id/pay
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

export function buildPayrollCommand(): Command {
  const cmd = new Command('payroll')
    .description('จัดการการออกเงินเดือน — Payroll run management')
    .addHelpText('after', `
Examples:
  $ neip payroll list                        # แสดงการออกเงินเดือนทั้งหมด
  $ neip payroll create                      # สร้าง payroll run ใหม่ (interactive)
  $ neip payroll calculate <id>              # คำนวณเงินเดือนพนักงานทั้งหมด
  $ neip payroll approve <id>                # อนุมัติ payroll run
  $ neip payroll pay <id>                    # ทำเครื่องหมายว่าจ่ายแล้ว

Workflow: create -> calculate -> approve -> pay
  `);

  cmd
    .command('list')
    .description('แสดงรายการการออกเงินเดือน — List payroll runs')
    .option('--status <status>', 'กรองตามสถานะ: draft/calculated/approved/paid — Filter by status')
    .option('--limit <n>', 'จำนวนสูงสุด — Max results', '20')
    .action(async (opts: { status?: string; limit: string }) => {
      const params: Record<string, string> = { limit: opts.limit };
      if (opts.status) params['status'] = opts.status;
      const result = await api.get<{ items: unknown[]; total: number }>('/api/v1/payroll', params);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data.items, `${String(result.data.items.length)} payroll runs`);
    });

  cmd
    .command('create')
    .description('สร้าง payroll run ใหม่ (interactive) — Create a payroll run interactively')
    .action(async () => {
      const payPeriodStart = await prompt('Pay period start (YYYY-MM-DD): ');
      const payPeriodEnd   = await prompt('Pay period end (YYYY-MM-DD): ');
      const defaultDate = new Date().toISOString().split('T')[0] ?? '';
      const runDate     = (await prompt(`Run date [${defaultDate}]: `)) || defaultDate;

      if (!payPeriodStart || !payPeriodEnd) {
        printError('payPeriodStart and payPeriodEnd are required.'); process.exit(1);
      }

      const result = await api.post<unknown>('/api/v1/payroll', { payPeriodStart, payPeriodEnd, runDate });
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, 'Payroll run created.');
    });

  cmd
    .command('calculate <id>')
    .description('คำนวณเงินเดือนพนักงานทั้งหมด — Calculate payroll for all active employees')
    .action(async (id: string) => {
      const result = await api.post<unknown>(`/api/v1/payroll/${id}/calculate`, {});
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Payroll run ${id} calculated.`);
    });

  cmd
    .command('approve <id>')
    .description('อนุมัติ payroll run ที่คำนวณแล้ว — Approve a calculated payroll run')
    .action(async (id: string) => {
      const result = await api.post<unknown>(`/api/v1/payroll/${id}/approve`, {});
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Payroll run ${id} approved.`);
    });

  cmd
    .command('pay <id>')
    .description('ทำเครื่องหมายว่าจ่ายเงินเดือนแล้ว — Mark an approved payroll run as paid')
    .action(async (id: string) => {
      const result = await api.post<unknown>(`/api/v1/payroll/${id}/pay`, {});
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Payroll run ${id} marked as paid.`);
    });

  return cmd;
}
