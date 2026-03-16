/**
 * neip export — Data Export commands.
 *
 * Commands:
 *   neip export <type>   — GET /api/v1/export/:type
 *
 * Supported types: journal_entries, chart_of_accounts, contacts
 */

import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid export types accepted by the API. */
type ExportType = 'journal_entries' | 'chart_of_accounts' | 'contacts';

/** Response shape for an export. */
interface ExportResponse {
  downloadUrl?: string;
  data?: unknown;
  filename?: string;
  exportedAt: string;
  recordCount: number;
}

/** Options accepted by `export <type>`. */
interface ExportOptions {
  output?: string;
  startDate?: string;
  endDate?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_EXPORT_TYPES: ExportType[] = [
  'journal_entries',
  'chart_of_accounts',
  'contacts',
];

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function exportData(type: string, options: ExportOptions): Promise<void> {
  if (!VALID_EXPORT_TYPES.includes(type as ExportType)) {
    printError(
      `Invalid export type "${type}". Must be one of: ${VALID_EXPORT_TYPES.join(', ')}`,
    );
    process.exit(1);
  }

  const params: Record<string, string> = {};
  if (options.startDate !== undefined && options.startDate !== '') {
    params['startDate'] = options.startDate;
  }
  if (options.endDate !== undefined && options.endDate !== '') {
    params['endDate'] = options.endDate;
  }

  const result = await api.get<{ data: ExportResponse }>(`/api/v1/export/${type}`, params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const exportResult = result.data.data;

  // If an output file was specified and data is available, write it
  if (options.output !== undefined && options.output !== '' && exportResult.data !== undefined) {
    try {
      writeFileSync(options.output, JSON.stringify(exportResult.data, null, 2), 'utf-8');
      printSuccess(
        { type, recordCount: exportResult.recordCount, output: options.output },
        `Exported ${String(exportResult.recordCount)} ${type} records to ${options.output}.`,
      );
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to write output file';
      printError(message);
      process.exit(1);
    }
  }

  printSuccess(
    exportResult,
    `Export of ${type} completed (${String(exportResult.recordCount)} records).`,
  );
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `export` command group.
 */
export function buildExportCommand(): Command {
  const exportCmd = new Command('export')
    .description('ส่งออกข้อมูลเป็นไฟล์ — Data export operations')
    .addHelpText('after', `
Examples:
  $ neip export run journal_entries                           # ส่งออกรายการบัญชี
  $ neip export run contacts --output contacts.json          # ส่งออก contacts ไปไฟล์
  $ neip export run journal_entries --start-date 2026-01-01  # กรองด้วยวันที่

Valid types: ${VALID_EXPORT_TYPES.join(', ')}
  `);

  exportCmd
    .command('run <type>')
    .description(
      `ส่งออกข้อมูลตามประเภท — Export data by type. Valid types: ${VALID_EXPORT_TYPES.join(', ')}`,
    )
    .option('--output <file>', 'บันทึกไปยังไฟล์ — Write exported data to a local file path')
    .option('--start-date <date>', 'วันเริ่มต้นสำหรับ journal_entries (YYYY-MM-DD) — Start date filter')
    .option('--end-date <date>', 'วันสิ้นสุดสำหรับ journal_entries (YYYY-MM-DD) — End date filter')
    .action(async (type: string, options: ExportOptions) => {
      await exportData(type, options);
    });

  return exportCmd;
}
