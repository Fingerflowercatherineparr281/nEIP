/**
 * neip month-end — Month End Close commands.
 *
 * Commands:
 *   neip month-end close --year <y> --period <p>   — POST /api/v1/month-end/close
 *   neip month-end status <jobId>                  — GET  /api/v1/month-end/:jobId
 */

import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for a month-end close job. */
interface MonthEndJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fiscalYear: number;
  period: number;
  steps: MonthEndStep[];
  startedAt: string;
  completedAt: string | null;
  errors: string[];
}

/** A single step in the month-end close process. */
interface MonthEndStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message: string;
}

/** Options accepted by `month-end close`. */
interface MonthEndCloseOptions {
  fiscalYear: string;
  period: string;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function monthEndClose(options: MonthEndCloseOptions): Promise<void> {
  const opts = options as unknown as Record<string, string>;
  const yearStr = opts['year'] ?? '';
  const periodStr = opts['period'] ?? '';
  if (yearStr === '') {
    printError('--year is required.');
    process.exit(1);
  }
  if (periodStr === '') {
    printError('--period is required.');
    process.exit(1);
  }

  const year = Number(yearStr);
  const period = Number(periodStr);

  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    printError('--year must be a valid 4-digit year.');
    process.exit(1);
  }
  if (Number.isNaN(period) || period < 1 || period > 13) {
    printError('--period must be between 1 and 13.');
    process.exit(1);
  }

  const result = await api.post<{ data: MonthEndJob }>('/api/v1/month-end/close', {
    fiscalYear: year,
    fiscalPeriod: period,
  });

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const job = result.data.data;
  printSuccess(
    job,
    `Month-end close job ${job.jobId} started for ${String(year)}-P${String(period)}. Use "neip month-end status ${job.jobId}" to track progress.`,
  );
}

async function monthEndStatus(jobId: string): Promise<void> {
  if (jobId === '') {
    printError('Job ID is required.');
    process.exit(1);
  }

  const result = await api.get<{ data: MonthEndJob }>(`/api/v1/month-end/${jobId}`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Month-end close job ${jobId}:`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `month-end` command group.
 */
export function buildMonthEndCommand(): Command {
  const monthEnd = new Command('month-end')
    .description('ปิดรอบบัญชีรายเดือน — Month-end close operations')
    .addHelpText('after', `
Examples:
  $ neip month-end close --year 2026 --period 3       # ปิดรอบเดือน 3/2026
  $ neip month-end status <jobId>                     # ตรวจสอบสถานะการปิดรอบ
  `);

  monthEnd
    .command('close')
    .description('เริ่มกระบวนการปิดรอบบัญชี — Initiate a month-end close for a fiscal year and period')
    .requiredOption('--year <year>', 'ปีบัญชี (เช่น 2026) — Fiscal year')
    .requiredOption('--period <period>', 'งวดบัญชี (1-13) — Fiscal period number')
    .action(async (options: MonthEndCloseOptions) => {
      await monthEndClose(options);
    });

  monthEnd
    .command('status <jobId>')
    .description('ตรวจสอบสถานะ job การปิดรอบ — Get the status of a month-end close job')
    .action(async (jobId: string) => {
      await monthEndStatus(jobId);
    });

  return monthEnd;
}
