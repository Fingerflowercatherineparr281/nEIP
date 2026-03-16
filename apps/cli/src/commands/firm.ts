/**
 * neip firm — Firm Management commands.
 *
 * Commands:
 *   neip firm clients list              — GET    /api/v1/firm/clients
 *   neip firm clients add <tenantId>    — POST   /api/v1/firm/clients
 *   neip firm clients remove <id>       — DELETE /api/v1/firm/clients/:id
 */

import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for a firm client. */
interface FirmClient {
  id: string;
  tenantId: string;
  tenantName: string;
  addedAt: string;
  status: 'active' | 'inactive';
}

/** Paginated list response wrapper. */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Options accepted by `firm clients list`. */
interface FirmClientsListOptions {
  page: string;
  pageSize: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function firmClientsList(options: FirmClientsListOptions): Promise<void> {
  const params: Record<string, string> = {
    page: options.page,
    pageSize: options.pageSize,
  };

  if (options.status !== undefined && options.status !== '') {
    params['status'] = options.status;
  }

  const result = await api.get<PaginatedResponse<FirmClient>>('/api/v1/firm/clients', params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data, total, page, pageSize } = result.data;

  printSuccess(
    data,
    `Showing ${String(data.length)} of ${String(total)} firm clients (page ${String(page)}/${String(Math.ceil(total / pageSize))})`,
  );
}

async function firmClientsAdd(tenantId: string): Promise<void> {
  if (tenantId === '') {
    printError('Tenant ID is required.');
    process.exit(1);
  }

  const result = await api.post<{ data: FirmClient }>('/api/v1/firm/clients', { tenantId });

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Client "${result.data.data.tenantName}" added to firm.`);
}

async function firmClientsRemove(id: string): Promise<void> {
  if (id === '') {
    printError('Client ID is required.');
    process.exit(1);
  }

  const result = await api.delete<void>(`/api/v1/firm/clients/${id}`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess({ id }, `Client ${id} removed from firm.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `firm` command group.
 */
export function buildFirmCommand(): Command {
  const firm = new Command('firm')
    .description('จัดการ firm (สำนักงานบัญชีหลายลูกค้า) — Firm multi-client practice management')
    .addHelpText('after', `
Examples:
  $ neip firm clients list                  # ดูรายชื่อลูกค้าทั้งหมดของ firm
  $ neip firm clients add <tenantId>        # เพิ่มองค์กรลูกค้า
  $ neip firm clients remove <id>          # ลบองค์กรลูกค้า
  `);

  const clients = new Command('clients')
    .description('จัดการองค์กรลูกค้าของ firm — Manage firm client organisations');

  clients
    .command('list')
    .description('แสดงรายการองค์กรลูกค้าทั้งหมด — List all firm client organisations')
    .option('--page <number>', 'หน้าที่ — Page number', '1')
    .option('--page-size <number>', 'จำนวนต่อหน้า — Number of clients per page', '20')
    .option('--status <status>', 'กรองตามสถานะ: active, inactive — Filter by status')
    .action(async (options: FirmClientsListOptions) => {
      await firmClientsList(options);
    });

  clients
    .command('add <tenantId>')
    .description('เพิ่มองค์กรลูกค้าเข้า firm ด้วย tenant ID — Add a client organisation to this firm by tenant ID')
    .action(async (tenantId: string) => {
      await firmClientsAdd(tenantId);
    });

  clients
    .command('remove <id>')
    .description('ลบองค์กรลูกค้าออกจาก firm — Remove a client from this firm by client record ID')
    .action(async (id: string) => {
      await firmClientsRemove(id);
    });

  firm.addCommand(clients);

  return firm;
}
