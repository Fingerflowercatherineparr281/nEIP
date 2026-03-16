/**
 * neip employees / departments — HR CLI commands.
 *
 * Commands:
 *   neip employees list              — GET  /api/v1/employees
 *   neip employees create            — POST /api/v1/employees (interactive)
 *   neip employees get <id>          — GET  /api/v1/employees/:id
 *   neip employees update <id>       — PUT  /api/v1/employees/:id
 *   neip employees resign <id>       — POST /api/v1/employees/:id/resign
 *   neip departments list            — GET  /api/v1/departments
 *   neip departments create          — POST /api/v1/departments
 *   neip departments update <id>     — PUT  /api/v1/departments/:id
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

export function buildEmployeesCommand(): Command {
  const cmd = new Command('employees')
    .description('จัดการข้อมูลพนักงาน (HR) — HR employee management')
    .addHelpText('after', `
Examples:
  $ neip employees list                       # แสดงพนักงานที่ active ทั้งหมด
  $ neip employees list --status all          # แสดงทุกสถานะ
  $ neip employees list --search "สมชาย"     # ค้นหาพนักงาน
  $ neip employees create                     # เพิ่มพนักงานใหม่ (interactive)
  $ neip employees get <id>                   # ดูรายละเอียดพนักงาน
  $ neip employees update <id>                # แก้ไขข้อมูลพนักงาน
  $ neip employees resign <id> --date 2026-03-31  # บันทึกการลาออก
  `);

  cmd
    .command('list')
    .description('แสดงรายการพนักงาน — List employees')
    .option('--status <status>', 'กรองตามสถานะ: active/resigned/terminated/all — Filter by status', 'active')
    .option('--limit <n>', 'จำนวนสูงสุด — Max results', '50')
    .option('--search <text>', 'ค้นหาชื่อ — Search by name', '')
    .action(async (opts: { status: string; limit: string; search: string }) => {
      const params: Record<string, string> = { limit: opts.limit };
      if (opts.status && opts.status !== 'all') params['status'] = opts.status;
      if (opts.search) params['search'] = opts.search;
      const result = await api.get<{ items: unknown[]; total: number }>('/api/v1/employees', params);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data.items, `${String(result.data.items.length)} of ${String(result.data.total)} employees`);
    });

  cmd
    .command('create')
    .description('เพิ่มพนักงานใหม่ (interactive) — Create an employee interactively')
    .action(async () => {
      const employeeCode = await prompt('Employee code: ');
      const firstNameTh  = await prompt('First name (TH): ');
      const lastNameTh   = await prompt('Last name (TH): ');
      const hireDate     = await prompt('Hire date (YYYY-MM-DD): ');
      const position     = await prompt('Position: ');
      const salary       = await prompt('Monthly salary in THB: ');

      if (!employeeCode || !firstNameTh || !lastNameTh || !hireDate) {
        printError('employeeCode, firstNameTh, lastNameTh, hireDate are required.');
        process.exit(1);
      }

      const result = await api.post<unknown>('/api/v1/employees', {
        employeeCode, firstNameTh, lastNameTh, hireDate,
        position: position || undefined,
        salarySatang: salary ? Math.round(parseFloat(salary) * 100) : 0,
      });
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Employee "${firstNameTh} ${lastNameTh}" created.`);
    });

  cmd
    .command('get <id>')
    .description('ดูรายละเอียดพนักงาน — Get employee details')
    .action(async (id: string) => {
      const result = await api.get<unknown>(`/api/v1/employees/${id}`);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Employee ${id}`);
    });

  cmd
    .command('update <id>')
    .description('แก้ไขข้อมูลพนักงาน (interactive) — Update an employee interactively')
    .action(async (id: string) => {
      process.stdout.write(`Updating employee ${id}. Leave blank to keep existing.\n`);
      const position = await prompt('Position: ');
      const salary   = await prompt('Salary in THB: ');

      const body: Record<string, unknown> = {};
      if (position) body['position'] = position;
      if (salary)   body['salarySatang'] = Math.round(parseFloat(salary) * 100);

      if (Object.keys(body).length === 0) { printError('No fields provided.'); process.exit(1); }

      const result = await api.put<unknown>(`/api/v1/employees/${id}`, body);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Employee ${id} updated.`);
    });

  cmd
    .command('resign <id>')
    .description('บันทึกการลาออกของพนักงาน — Process employee resignation')
    .option('--date <date>', 'วันที่ลาออก (YYYY-MM-DD) — Resignation date')
    .action(async (id: string, opts: { date?: string }) => {
      const result = await api.post<unknown>(`/api/v1/employees/${id}/resign`, {
        resignationDate: opts.date ?? new Date().toISOString().split('T')[0],
      });
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Employee ${id} resigned.`);
    });

  return cmd;
}

export function buildDepartmentsCommand(): Command {
  const cmd = new Command('departments')
    .description('จัดการแผนกและหน่วยงาน (HR) — HR department management')
    .addHelpText('after', `
Examples:
  $ neip departments list                    # แสดงแผนกทั้งหมด
  $ neip departments create                  # สร้างแผนกใหม่ (interactive)
  $ neip departments update <id>             # แก้ไขข้อมูลแผนก
  `);

  cmd
    .command('list')
    .description('แสดงรายการแผนก — List departments')
    .action(async () => {
      const result = await api.get<{ items: unknown[] }>('/api/v1/departments');
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data.items, `${String(result.data.items.length)} departments`);
    });

  cmd
    .command('create')
    .description('สร้างแผนกใหม่ (interactive) — Create a department interactively')
    .action(async () => {
      const code   = await prompt('Code: ');
      const nameTh = await prompt('Name (TH): ');
      const nameEn = await prompt('Name (EN): ');

      if (!code || !nameTh || !nameEn) { printError('code, nameTh, nameEn are required.'); process.exit(1); }

      const result = await api.post<unknown>('/api/v1/departments', { code, nameTh, nameEn });
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Department "${nameEn}" created.`);
    });

  cmd
    .command('update <id>')
    .description('แก้ไขข้อมูลแผนก (interactive) — Update a department interactively')
    .action(async (id: string) => {
      process.stdout.write(`Updating department ${id}. Leave blank to keep existing.\n`);
      const nameTh = await prompt('Name (TH): ');
      const nameEn = await prompt('Name (EN): ');

      const body: Record<string, string> = {};
      if (nameTh) body['nameTh'] = nameTh;
      if (nameEn) body['nameEn'] = nameEn;

      if (Object.keys(body).length === 0) { printError('No fields provided.'); process.exit(1); }

      const result = await api.put<unknown>(`/api/v1/departments/${id}`, body);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Department ${id} updated.`);
    });

  return cmd;
}
