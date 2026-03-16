/**
 * neip contacts — CRM Contact management CLI commands.
 *
 * Commands:
 *   neip contacts list            — GET  /api/v1/contacts
 *   neip contacts create          — POST /api/v1/contacts (interactive)
 *   neip contacts get <id>        — GET  /api/v1/contacts/:id
 *   neip contacts update <id>     — PUT  /api/v1/contacts/:id
 *   neip contacts delete <id>     — DELETE /api/v1/contacts/:id
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

export function buildContactsCommand(): Command {
  const cmd = new Command('contacts')
    .description('จัดการทะเบียนลูกค้าและผู้ขาย — Manage customer and vendor contacts')
    .addHelpText('after', `
Examples:
  $ neip contacts list                          # แสดงทั้งหมด
  $ neip contacts list --type customer          # เฉพาะลูกค้า
  $ neip contacts list --search "ABC"           # ค้นหาชื่อ
  $ neip contacts create                        # สร้าง contact ใหม่ (interactive)
  $ neip contacts get <id>                      # ดูรายละเอียด
  $ neip contacts update <id>                   # แก้ไข
  $ neip contacts delete <id>                   # ลบ (soft delete)
  `);

  cmd
    .command('list')
    .description('แสดงรายการ contacts ทั้งหมด — List all contacts')
    .option('--limit <n>', 'จำนวนแสดงสูงสุด — Max results', '50')
    .option('--offset <n>', 'ข้ามรายการแรก N รายการ — Skip first N records', '0')
    .option('--type <type>', 'ประเภท: customer, vendor, both — Filter by contact type')
    .option('--search <text>', 'ค้นหาด้วยชื่อ/Tax ID/email — Search by name, tax ID, or email', '')
    .action(async (opts: { limit: string; offset: string; type?: string; search: string }) => {
      const params: Record<string, string> = { limit: opts.limit, offset: opts.offset };
      if (opts.type) params['type'] = opts.type;
      if (opts.search) params['search'] = opts.search;
      const result = await api.get<{ items: unknown[]; total: number }>('/api/v1/contacts', params);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data.items, `${String(result.data.items.length)} of ${String(result.data.total)} contacts`);
    });

  cmd
    .command('create')
    .description('สร้าง contact ใหม่ (interactive) — Create a contact interactively')
    .action(async () => {
      const contactType = await prompt('Type (customer/vendor/both) [customer]: ') || 'customer';
      const companyName = await prompt('Company name: ');
      if (!companyName) { printError('Company name is required.'); process.exit(1); }
      const email   = await prompt('Email: ');
      const phone   = await prompt('Phone: ');
      const taxId   = await prompt('Tax ID: ');
      const province = await prompt('Province: ');

      const result = await api.post<unknown>('/api/v1/contacts', {
        contactType, companyName,
        email: email || undefined,
        phone: phone || undefined,
        taxId: taxId || undefined,
        province: province || undefined,
      });
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Contact "${companyName}" created.`);
    });

  cmd
    .command('get <id>')
    .description('ดูรายละเอียด contact — Get contact details')
    .action(async (id: string) => {
      const result = await api.get<unknown>(`/api/v1/contacts/${id}`);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Contact ${id}`);
    });

  cmd
    .command('update <id>')
    .description('แก้ไข contact (interactive) — Update a contact interactively')
    .action(async (id: string) => {
      process.stdout.write(`Updating contact ${id}. Leave blank to keep existing.\n`);
      const companyName = await prompt('Company name: ');
      const email = await prompt('Email: ');
      const phone = await prompt('Phone: ');

      const body: Record<string, string> = {};
      if (companyName) body['companyName'] = companyName;
      if (email) body['email'] = email;
      if (phone) body['phone'] = phone;

      if (Object.keys(body).length === 0) { printError('No fields provided.'); process.exit(1); }

      const result = await api.put<unknown>(`/api/v1/contacts/${id}`, body);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Contact ${id} updated.`);
    });

  cmd
    .command('delete <id>')
    .description('ลบ contact (ปิดการใช้งาน) — Soft-delete (deactivate) a contact')
    .action(async (id: string) => {
      const result = await api.delete<{ id: string; deleted: boolean }>(`/api/v1/contacts/${id}`);
      if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
      printSuccess(result.data, `Contact ${id} deactivated.`);
    });

  return cmd;
}
