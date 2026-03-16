/**
 * neip audit — Audit trail commands.
 *
 * Commands:
 *   neip audit list                         — list recent audit log entries
 *   neip audit search --resource <type>     — filter by resource type
 *                     --id <resourceId>     — filter by resource ID
 *                     --user <userId>       — filter by user
 *                     --start <ISO date>    — lower bound on timestamp
 *                     --end   <ISO date>    — upper bound on timestamp
 *                     --limit <n>           — max entries to return
 */

import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

interface AuditLogEntry {
  id: string;
  userId: string;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: AuditChanges | null;
  requestId: string;
  timestamp: string;
}

interface AuditLogListResponse {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface AuditListOptions {
  limit: string;
  offset: string;
}

interface AuditSearchOptions {
  resource?: string;
  id?: string;
  user?: string;
  start?: string;
  end?: string;
  limit: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUDIT_LOGS_PATH = '/api/v1/audit-logs';

function buildParams(
  overrides: Record<string, string | undefined>,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== '') {
      params[key] = value;
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function auditList(options: AuditListOptions): Promise<void> {
  const params = buildParams({
    limit: options.limit,
    offset: options.offset,
  });

  const result = await api.get<AuditLogListResponse>(AUDIT_LOGS_PATH, params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { items, total, limit, offset } = result.data;

  printSuccess(
    items,
    `Showing ${String(items.length)} of ${String(total)} audit entries (offset ${String(offset)}, limit ${String(limit)})`,
  );
}

async function auditSearch(options: AuditSearchOptions): Promise<void> {
  const params = buildParams({
    resourceType: options.resource,
    resourceId: options.id,
    userId: options.user,
    startDate: options.start,
    endDate: options.end,
    limit: options.limit,
  });

  if (Object.keys(params).length === 1 && 'limit' in params) {
    printError(
      'Provide at least one filter: --resource, --id, --user, --start, or --end.',
    );
    process.exit(1);
  }

  const result = await api.get<AuditLogListResponse>(AUDIT_LOGS_PATH, params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { items, total } = result.data;

  printSuccess(
    items,
    `Found ${String(total)} matching audit entries (showing ${String(items.length)})`,
  );
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `audit` command group.
 */
export function buildAuditCommand(): Command {
  const audit = new Command('audit')
    .description('ดู audit trail ที่ไม่สามารถแก้ไขได้ — Query the immutable audit trail')
    .addHelpText('after', `
Examples:
  $ neip audit list                                  # แสดง 50 รายการล่าสุด
  $ neip audit list --limit 100                      # แสดง 100 รายการ
  $ neip audit search --resource invoice             # ค้นหาตาม resource type
  $ neip audit search --user <userId>                # ค้นหาตาม user
  $ neip audit search --start 2026-01-01T00:00:00Z --end 2026-03-31T23:59:59Z
  `);

  audit
    .command('list')
    .description('แสดง audit log รายการล่าสุด — List recent audit log entries')
    .option('--limit <n>', 'จำนวนรายการสูงสุด — Maximum number of entries', '50')
    .option('--offset <n>', 'ข้ามรายการ N แรก — Pagination offset', '0')
    .action(async (options: AuditListOptions) => {
      await auditList(options);
    });

  audit
    .command('search')
    .description('ค้นหา audit log ตาม resource, user, หรือช่วงเวลา — Search audit log entries by resource, user, or date range')
    .option('--resource <type>', 'กรองตาม resource type (เช่น invoice, bill) — Filter by resource type')
    .option('--id <resourceId>', 'กรองตาม resource ID — Filter by resource ID')
    .option('--user <userId>', 'กรองตาม user ID — Filter by user ID')
    .option('--start <date>', 'วันเริ่มต้น ISO 8601 (เช่น 2026-01-01T00:00:00Z) — ISO 8601 start date')
    .option('--end <date>', 'วันสิ้นสุด ISO 8601 (เช่น 2026-12-31T23:59:59Z) — ISO 8601 end date')
    .option('--limit <n>', 'จำนวนรายการสูงสุด — Maximum number of entries', '50')
    .action(async (options: AuditSearchOptions) => {
      await auditSearch(options);
    });

  return audit;
}
