/**
 * neip leave — Leave management CLI.
 *
 * Commands:
 *   neip leave types          — GET  /api/v1/leave-types
 *   neip leave request        — POST /api/v1/leave-requests (interactive)
 *   neip leave list           — GET  /api/v1/leave-requests
 *   neip leave approve <id>   — POST /api/v1/leave-requests/:id/approve
 *   neip leave reject <id>    — POST /api/v1/leave-requests/:id/reject
 *   neip leave balance <empId> — GET /api/v1/leave-requests/balance/:employeeId
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

export function buildLeaveCommand(): Command {
  const cmd = new Command('leave')
    .description('จัดการการลาหยุด — Leave request management')
    .addHelpText('after', `
Examples:
  $ neip leave types                         # แสดงประเภทการลาทั้งหมด
  $ neip leave request                       # ยื่นคำขอลา (interactive)
  $ neip leave list                          # แสดงคำขอลาทั้งหมด (pending)
  $ neip leave list --status approved        # เฉพาะที่อนุมัติแล้ว
  $ neip leave approve <id>                  # อนุมัติคำขอลา
  $ neip leave reject <id> --reason "..."    # ปฏิเสธคำขอลา
  $ neip leave balance <employeeId>          # ดูวันลาคงเหลือ
  `);

  cmd
    .command('types')
    .description('แสดงประเภทการลาที่มีในระบบ — List available leave types')
    .action(async () => {
      const result = await api.get<{ items: unknown[] }>('/api/v1/leave-types');
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data.items, `${String(result.data.items.length)} leave types`);
    });

  cmd
    .command('request')
    .description('ยื่นคำขอลา (interactive) — Submit a leave request interactively')
    .action(async () => {
      const employeeId  = await prompt('Employee ID: ');
      const leaveTypeId = await prompt('Leave Type ID: ');
      const startDate   = await prompt('Start date (YYYY-MM-DD): ');
      const endDate     = await prompt('End date (YYYY-MM-DD): ');
      const days        = await prompt('Number of days: ');
      const reason      = await prompt('Reason (optional): ');

      if (!employeeId || !leaveTypeId || !startDate || !endDate) {
        printError('All fields are required.'); process.exit(1);
      }

      const result = await api.post<unknown>('/api/v1/leave-requests', {
        employeeId, leaveTypeId, startDate, endDate,
        days: parseInt(days || '1', 10),
        reason: reason || undefined,
      });
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, 'Leave request submitted.');
    });

  cmd
    .command('list')
    .description('แสดงรายการคำขอลา — List leave requests')
    .option('--status <status>', 'กรองตามสถานะ: pending/approved/rejected/all — Filter by status', 'pending')
    .option('--limit <n>', 'จำนวนสูงสุด — Max results', '50')
    .action(async (opts: { status: string; limit: string }) => {
      const params: Record<string, string> = { limit: opts.limit };
      if (opts.status && opts.status !== 'all') params['status'] = opts.status;
      const result = await api.get<{ items: unknown[]; total: number }>('/api/v1/leave-requests', params);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data.items, `${String(result.data.items.length)} leave requests`);
    });

  cmd
    .command('approve <id>')
    .description('อนุมัติคำขอลา — Approve a pending leave request')
    .action(async (id: string) => {
      const result = await api.post<unknown>(`/api/v1/leave-requests/${id}/approve`, {});
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Leave request ${id} approved.`);
    });

  cmd
    .command('reject <id>')
    .description('ปฏิเสธคำขอลา — Reject a pending leave request')
    .option('--reason <reason>', 'เหตุผลที่ปฏิเสธ — Rejection reason')
    .action(async (id: string, opts: { reason?: string }) => {
      const result = await api.post<unknown>(`/api/v1/leave-requests/${id}/reject`, {
        reason: opts.reason,
      });
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Leave request ${id} rejected.`);
    });

  cmd
    .command('balance <employeeId>')
    .description('ดูวันลาคงเหลือแยกตามประเภท — Show remaining leave balance by type for an employee')
    .action(async (employeeId: string) => {
      const result = await api.get<{ employeeId: string; year: number; balances: unknown[] }>(
        `/api/v1/leave-requests/balance/${employeeId}`,
      );
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data.balances, `Leave balance for employee ${employeeId} (year ${String(result.data.year)})`);
    });

  return cmd;
}
