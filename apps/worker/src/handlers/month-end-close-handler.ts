/**
 * Month-End Close Job Handler — Story 12.1.
 *
 * Processes `month-end.close` jobs from the pg-boss queue.
 * Delegates all reconciliation to MonthEndCloseAgent from @neip/ai.
 *
 * Execution flow:
 *   1. Extract fiscal year/period info from job payload
 *   2. Load journal entries, account balances, and other data (stubbed)
 *   3. Build AgentContext from job metadata
 *   4. Run MonthEndCloseAgent.execute()
 *   5. Log results and mark period based on outcome
 *
 * Architecture references: AR10 (pg-boss), AR11 (agents), FR18-FR21
 * Story: 12.1
 */

import {
  MonthEndCloseAgent,
  isAgentSuccess,
  ConfidenceZone,
} from '@neip/ai';
import type {
  AgentContext,
  MonthEndCloseInput,
  PeriodJournalEntry,
  AccountBalance,
  UnmatchedPayment,
  BalanceDiscrepancy,
  FixedAsset,
  AccrualItem,
} from '@neip/ai';

import type { JobHandlerInput } from '../types/jobs.js';
import { JOB_NAMES } from '../types/jobs.js';
import { log } from '../logger.js';

// ---------------------------------------------------------------------------
// Singleton agent — stateless, shared across all job invocations
// ---------------------------------------------------------------------------

const closeAgent = new MonthEndCloseAgent();

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for the `month-end.close` job.
 *
 * NOTE: The `loadPeriodData` helper below is intentionally stubbed.
 * In production it will query @neip/db for journal entries, account balances,
 * unmatched payments, etc. The stub allows compilation without a DB.
 */
export async function handleMonthEndClose(
  job: JobHandlerInput<typeof JOB_NAMES.MONTH_END_CLOSE>,
): Promise<void> {
  const { id: jobId, data } = job;
  const { tenantId, fiscalYear, fiscalPeriod, initiatedBy, correlationId } = data;

  log.info({
    msg: 'month-end.close: processing',
    jobId,
    jobName: job.name,
    tenantId,
    fiscalYear,
    fiscalPeriod,
    initiatedBy,
    correlationId,
    retryCount: job.retryCount,
  });

  // ------------------------------------------------------------------
  // 1. Load period data — stubbed for now
  // ------------------------------------------------------------------
  const periodData = await loadPeriodData(tenantId, fiscalYear, fiscalPeriod);

  // ------------------------------------------------------------------
  // 2. Build AgentContext
  // ------------------------------------------------------------------
  const context: AgentContext = {
    tenantId,
    userId: initiatedBy,
    correlationId: correlationId ?? jobId,
    metadata: {
      fiscalYear,
      fiscalPeriod,
      jobId,
      retryCount: job.retryCount,
    },
  };

  // ------------------------------------------------------------------
  // 3. Run the month-end close agent
  // ------------------------------------------------------------------
  log.info({
    msg: 'month-end.close: running MonthEndCloseAgent',
    jobId,
    tenantId,
    fiscalYear,
    fiscalPeriod,
    journalEntryCount: periodData.journalEntries.length,
  });

  const result = await closeAgent.execute(periodData, context);

  // ------------------------------------------------------------------
  // 4. Interpret the result
  // ------------------------------------------------------------------
  if (!isAgentSuccess(result)) {
    log.error({
      msg: 'month-end.close: agent returned BLOCKED',
      jobId,
      tenantId,
      fiscalYear,
      fiscalPeriod,
      zone: result.zone,
      error: result.error.detail,
      reasoning: result.reasoning,
      durationMs: result.durationMs,
    });
    return;
  }

  const { checklist, suggestedEntries, summary } = result.data;

  log.info({
    msg: 'month-end.close: analysis complete',
    jobId,
    tenantId,
    fiscalYear,
    fiscalPeriod,
    zone: result.zone,
    confidence: result.confidence as number,
    totalChecks: summary.totalChecks,
    passedChecks: summary.passedChecks,
    reviewChecks: summary.reviewChecks,
    errorChecks: summary.errorChecks,
    suggestedEntries: suggestedEntries.length,
    canAutoClose: summary.canAutoClose,
    durationMs: result.durationMs,
  });

  switch (result.zone) {
    case ConfidenceZone.AUTO:
      log.info({
        msg: 'month-end.close: AUTO — all checks passed, period can be closed',
        jobId,
        tenantId,
      });
      break;

    case ConfidenceZone.SUGGEST:
    case ConfidenceZone.REVIEW:
      log.warn({
        msg: `month-end.close: ${result.zone} — human review required`,
        jobId,
        tenantId,
        checklistSummary: checklist
          .filter((c) => c.status !== 'complete')
          .map((c) => ({ description: c.description, status: c.status })),
      });
      break;

    case ConfidenceZone.MANUAL:
      log.warn({
        msg: 'month-end.close: MANUAL — significant issues found',
        jobId,
        tenantId,
        errorCount: summary.errorChecks,
      });
      break;

    case ConfidenceZone.BLOCKED:
      log.error({
        msg: 'month-end.close: unexpected BLOCKED on success result',
        jobId,
        tenantId,
      });
      break;
  }
}

// ---------------------------------------------------------------------------
// Data loading stub
// ---------------------------------------------------------------------------

/**
 * Stub: returns empty period data.
 *
 * Replace with actual @neip/db queries in production:
 * - journal_entries for the fiscal period
 * - account balances aggregated from journal_entry_lines
 * - unmatched payments (payments not linked to invoices)
 * - balance discrepancies between subledgers and GL
 * - fixed asset records with depreciation schedules
 * - outstanding accrual items
 */
async function loadPeriodData(
  _tenantId: string,
  fiscalYear: number,
  fiscalPeriod: number,
): Promise<MonthEndCloseInput> {
  // Compute period date range
  const startMonth = fiscalPeriod - 1; // 0-indexed
  const periodStart = new Date(fiscalYear, startMonth, 1);
  const periodEnd = new Date(fiscalYear, startMonth + 1, 0);

  return {
    fiscalYear,
    fiscalPeriod,
    periodStartDate: periodStart.toISOString().slice(0, 10),
    periodEndDate: periodEnd.toISOString().slice(0, 10),
    journalEntries: [] as PeriodJournalEntry[],
    accountBalances: [] as AccountBalance[],
    unmatchedPayments: [] as UnmatchedPayment[],
    balanceDiscrepancies: [] as BalanceDiscrepancy[],
    fixedAssets: [] as FixedAsset[],
    accruals: [] as AccrualItem[],
  };
}
