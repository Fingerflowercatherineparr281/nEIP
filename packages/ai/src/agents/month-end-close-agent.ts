/**
 * MonthEndCloseAgent — AI agent for month-end close reconciliation.
 *
 * Implements Story 12.1: deterministic, rule-based reconciliation with full
 * reasoning transparency (FR18: no black-box AI). The agent does NOT require
 * an LLM for its core logic; all checks are computed from ledger data.
 *
 * Responsibilities:
 *   1. Reconciliation checks: unmatched payments, missing entries, balance discrepancies
 *   2. Generate checklist: { description, status, reasoning }
 *   3. Suggest closing journal entries (depreciation, accruals) for human review
 *   4. Handle 10K+ transactions efficiently (no N+1 queries)
 *
 * Architecture references: AR11, FR17-FR23
 * Story: 12.1
 */

import { ValidationError } from '@neip/shared';

import {
  ConfidenceZone,
} from '../types/agent-types.js';
import type {
  AgentContext,
  AgentResult,
} from '../types/agent-types.js';
import { BaseAgent, AgentTrace } from './base-agent.js';

// ---------------------------------------------------------------------------
// Domain types — month-end close I/O
// ---------------------------------------------------------------------------

/** Status of a single checklist item. */
export type ChecklistStatus = 'complete' | 'needs-review' | 'error';

/**
 * A single reconciliation checklist item produced by the agent.
 */
export interface ChecklistItem {
  /** Human-readable description of what was checked. */
  readonly description: string;
  /** Status classification. */
  readonly status: ChecklistStatus;
  /** Detailed reasoning for the status (FR18 transparency). */
  readonly reasoning: string;
}

/**
 * A suggested closing journal entry for human review.
 * Amounts are in satang (THB smallest unit).
 */
export interface SuggestedJournalEntry {
  /** Description of the suggested entry. */
  readonly description: string;
  /** Category of closing entry. */
  readonly entryType: 'depreciation' | 'accrual' | 'adjustment' | 'reclassification';
  /** Debit lines. */
  readonly debits: ReadonlyArray<{ accountCode: string; accountName: string; amount: bigint }>;
  /** Credit lines. */
  readonly credits: ReadonlyArray<{ accountCode: string; accountName: string; amount: bigint }>;
  /** AI reasoning for this suggestion. */
  readonly reasoning: string;
}

/**
 * An unmatched payment detected during reconciliation.
 */
export interface UnmatchedPayment {
  readonly paymentId: string;
  readonly amount: bigint;
  readonly receivedAt: string;
  readonly reference?: string;
}

/**
 * A balance discrepancy detected between subledger and GL.
 */
export interface BalanceDiscrepancy {
  readonly accountCode: string;
  readonly accountName: string;
  readonly subledgerBalance: bigint;
  readonly glBalance: bigint;
  readonly difference: bigint;
}

/**
 * A journal entry record within the fiscal period.
 */
export interface PeriodJournalEntry {
  readonly id: string;
  readonly entryNumber: string;
  readonly date: string;
  readonly totalDebit: bigint;
  readonly totalCredit: bigint;
  readonly status: 'draft' | 'posted' | 'voided';
  readonly description?: string;
}

/**
 * Account balance summary for the period.
 */
export interface AccountBalance {
  readonly accountCode: string;
  readonly accountName: string;
  readonly accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  readonly openingBalance: bigint;
  readonly closingBalance: bigint;
  readonly periodDebits: bigint;
  readonly periodCredits: bigint;
}

/**
 * Fixed asset record for depreciation calculation.
 */
export interface FixedAsset {
  readonly id: string;
  readonly description: string;
  readonly acquisitionCost: bigint;
  readonly accumulatedDepreciation: bigint;
  readonly monthlyDepreciation: bigint;
  readonly depreciationAccountCode: string;
  readonly assetAccountCode: string;
}

/**
 * Accrual item (e.g. accrued expenses not yet invoiced).
 */
export interface AccrualItem {
  readonly id: string;
  readonly description: string;
  readonly amount: bigint;
  readonly expenseAccountCode: string;
  readonly liabilityAccountCode: string;
}

/**
 * Input accepted by MonthEndCloseAgent.
 */
export interface MonthEndCloseInput {
  /** Fiscal year number, e.g. 2025. */
  readonly fiscalYear: number;
  /** Fiscal period (1-12). */
  readonly fiscalPeriod: number;
  /** Period start date (ISO 8601). */
  readonly periodStartDate: string;
  /** Period end date (ISO 8601). */
  readonly periodEndDate: string;
  /** All journal entries posted in this period. */
  readonly journalEntries: ReadonlyArray<PeriodJournalEntry>;
  /** Account balances at period end. */
  readonly accountBalances: ReadonlyArray<AccountBalance>;
  /** Unmatched payments found in the period. */
  readonly unmatchedPayments: ReadonlyArray<UnmatchedPayment>;
  /** Discrepancies between subledger and GL. */
  readonly balanceDiscrepancies: ReadonlyArray<BalanceDiscrepancy>;
  /** Fixed assets for depreciation suggestions. */
  readonly fixedAssets: ReadonlyArray<FixedAsset>;
  /** Outstanding accruals for accrual suggestions. */
  readonly accruals: ReadonlyArray<AccrualItem>;
}

/**
 * Output produced by MonthEndCloseAgent on success.
 */
export interface MonthEndCloseOutput {
  /** Reconciliation checklist with status for each check. */
  readonly checklist: ReadonlyArray<ChecklistItem>;
  /** Suggested closing journal entries for human review. */
  readonly suggestedEntries: ReadonlyArray<SuggestedJournalEntry>;
  /** Summary statistics. */
  readonly summary: {
    readonly totalChecks: number;
    readonly passedChecks: number;
    readonly reviewChecks: number;
    readonly errorChecks: number;
    readonly totalJournalEntries: number;
    readonly totalTransactions: number;
    readonly canAutoClose: boolean;
  };
  /** Fiscal period identification. */
  readonly fiscalYear: number;
  readonly fiscalPeriod: number;
}

// ---------------------------------------------------------------------------
// MonthEndCloseAgent
// ---------------------------------------------------------------------------

/**
 * Agent that performs month-end close reconciliation checks, generates a
 * checklist, and suggests closing journal entries for human review.
 *
 * The agent is purely rule-based and does not call an LLM, which keeps it
 * deterministic and testable with no external dependencies.
 *
 * Designed to handle 10K+ transactions within the 30s timeout.
 */
export class MonthEndCloseAgent extends BaseAgent<
  MonthEndCloseInput,
  MonthEndCloseOutput
> {
  constructor(config?: { agentId?: string; timeoutMs?: number }) {
    super({
      agentId: config?.agentId ?? 'month-end-close-agent',
      // Allow up to 30s for large transaction volumes
      timeoutMs: config?.timeoutMs ?? 30_000,
    });
  }

  // ---------------------------------------------------------------------------
  // executeCore — implements BaseAgent abstract method
  // ---------------------------------------------------------------------------

  protected async executeCore(
    input: MonthEndCloseInput,
    context: AgentContext,
    trace: AgentTrace,
  ): Promise<AgentResult<MonthEndCloseOutput>> {
    const startMs = Date.now();

    trace.addStep('reasoning', 'Month-end close: validating input', {
      fiscalYear: input.fiscalYear,
      fiscalPeriod: input.fiscalPeriod,
      journalEntryCount: input.journalEntries.length,
      accountBalanceCount: input.accountBalances.length,
      tenantId: context.tenantId,
    });

    // Guard: validate period range
    if (input.fiscalPeriod < 1 || input.fiscalPeriod > 12) {
      return this.buildFailure(
        new ValidationError({
          detail: `Invalid fiscal period: ${input.fiscalPeriod}. Must be 1-12.`,
        }),
        trace,
        startMs,
      );
    }

    // Run all reconciliation checks
    const checklist: ChecklistItem[] = [];

    // Check 1: Unmatched payments
    checklist.push(this.checkUnmatchedPayments(input, trace));

    // Check 2: Journal entry balance (debits = credits)
    checklist.push(this.checkJournalBalance(input, trace));

    // Check 3: Draft journal entries
    checklist.push(this.checkDraftEntries(input, trace));

    // Check 4: Balance discrepancies
    checklist.push(this.checkBalanceDiscrepancies(input, trace));

    // Check 5: Trial balance (total debits = total credits)
    checklist.push(this.checkTrialBalance(input, trace));

    // Check 6: Revenue and expense accounts have activity
    checklist.push(this.checkRevenueExpenseActivity(input, trace));

    // Generate suggested closing journal entries
    const suggestedEntries: SuggestedJournalEntry[] = [];

    // Suggest depreciation entries
    suggestedEntries.push(...this.suggestDepreciationEntries(input, trace));

    // Suggest accrual entries
    suggestedEntries.push(...this.suggestAccrualEntries(input, trace));

    // Build summary
    const passedChecks = checklist.filter((c) => c.status === 'complete').length;
    const reviewChecks = checklist.filter((c) => c.status === 'needs-review').length;
    const errorChecks = checklist.filter((c) => c.status === 'error').length;
    const canAutoClose = errorChecks === 0 && reviewChecks === 0;

    const summary = {
      totalChecks: checklist.length,
      passedChecks,
      reviewChecks,
      errorChecks,
      totalJournalEntries: input.journalEntries.length,
      totalTransactions: input.journalEntries.length,
      canAutoClose,
    };

    trace.addStep('final-answer', 'Month-end close analysis complete', {
      ...summary,
      suggestedEntryCount: suggestedEntries.length,
    });

    const output: MonthEndCloseOutput = {
      checklist,
      suggestedEntries,
      summary,
      fiscalYear: input.fiscalYear,
      fiscalPeriod: input.fiscalPeriod,
    };

    // Compute confidence: 1.0 if all pass, reduced by each review/error
    const confidence = this.computeConfidence(checklist);

    return this.buildSuccess(output, confidence, trace, startMs);
  }

  // ---------------------------------------------------------------------------
  // Reconciliation checks
  // ---------------------------------------------------------------------------

  private checkUnmatchedPayments(
    input: MonthEndCloseInput,
    trace: AgentTrace,
  ): ChecklistItem {
    const count = input.unmatchedPayments.length;

    trace.addStep('reasoning', `Checking unmatched payments: found ${count}`, {
      unmatchedCount: count,
    });

    if (count === 0) {
      return {
        description: 'All payments matched to invoices',
        status: 'complete',
        reasoning: 'No unmatched payments found in the period.',
      };
    }

    const totalUnmatched = input.unmatchedPayments.reduce(
      (sum, p) => sum + p.amount,
      0n,
    );

    return {
      description: `${count} unmatched payment(s) totaling ${totalUnmatched.toString()} satang`,
      status: count > 5 ? 'error' : 'needs-review',
      reasoning: `Found ${count} payment(s) not matched to any invoice. Total value: ${totalUnmatched.toString()} satang. Review and match or create journal entries for these payments.`,
    };
  }

  private checkJournalBalance(
    input: MonthEndCloseInput,
    trace: AgentTrace,
  ): ChecklistItem {
    const unbalanced = input.journalEntries.filter(
      (je) => je.totalDebit !== je.totalCredit,
    );

    trace.addStep('reasoning', `Checking journal entry balance: ${unbalanced.length} unbalanced`, {
      totalEntries: input.journalEntries.length,
      unbalancedCount: unbalanced.length,
    });

    if (unbalanced.length === 0) {
      return {
        description: 'All journal entries are balanced (debits = credits)',
        status: 'complete',
        reasoning: `Verified ${input.journalEntries.length} journal entries — all have matching debit and credit totals.`,
      };
    }

    const entryNumbers = unbalanced.map((je) => je.entryNumber).join(', ');

    return {
      description: `${unbalanced.length} journal entry(ies) have unbalanced debits/credits`,
      status: 'error',
      reasoning: `Unbalanced journal entries: ${entryNumbers}. Each entry must have equal total debits and credits before the period can be closed.`,
    };
  }

  private checkDraftEntries(
    input: MonthEndCloseInput,
    trace: AgentTrace,
  ): ChecklistItem {
    const drafts = input.journalEntries.filter((je) => je.status === 'draft');

    trace.addStep('reasoning', `Checking draft entries: ${drafts.length} drafts`, {
      draftCount: drafts.length,
    });

    if (drafts.length === 0) {
      return {
        description: 'No draft journal entries in period',
        status: 'complete',
        reasoning: 'All journal entries are in posted or voided status. No pending drafts.',
      };
    }

    return {
      description: `${drafts.length} draft journal entry(ies) not yet posted`,
      status: 'needs-review',
      reasoning: `Found ${drafts.length} journal entries still in draft status. These must be posted or voided before closing the period.`,
    };
  }

  private checkBalanceDiscrepancies(
    input: MonthEndCloseInput,
    trace: AgentTrace,
  ): ChecklistItem {
    const count = input.balanceDiscrepancies.length;

    trace.addStep('reasoning', `Checking balance discrepancies: ${count} found`, {
      discrepancyCount: count,
    });

    if (count === 0) {
      return {
        description: 'Subledger balances match GL balances',
        status: 'complete',
        reasoning: 'No discrepancies found between subledger and general ledger balances.',
      };
    }

    const details = input.balanceDiscrepancies
      .map((d) => `${d.accountCode} (${d.accountName}): difference ${d.difference.toString()} satang`)
      .join('; ');

    return {
      description: `${count} balance discrepancy(ies) between subledger and GL`,
      status: 'error',
      reasoning: `Discrepancies found: ${details}. Investigate and post adjusting entries before closing.`,
    };
  }

  private checkTrialBalance(
    input: MonthEndCloseInput,
    trace: AgentTrace,
  ): ChecklistItem {
    let totalDebits = 0n;
    let totalCredits = 0n;

    for (const ab of input.accountBalances) {
      totalDebits += ab.periodDebits;
      totalCredits += ab.periodCredits;
    }

    const isBalanced = totalDebits === totalCredits;

    trace.addStep('reasoning', `Trial balance check: debits=${totalDebits.toString()}, credits=${totalCredits.toString()}`, {
      totalDebits: totalDebits.toString(),
      totalCredits: totalCredits.toString(),
      isBalanced,
    });

    if (isBalanced) {
      return {
        description: 'Trial balance is in balance',
        status: 'complete',
        reasoning: `Total debits (${totalDebits.toString()} satang) equal total credits (${totalCredits.toString()} satang).`,
      };
    }

    const difference = totalDebits > totalCredits
      ? totalDebits - totalCredits
      : totalCredits - totalDebits;

    return {
      description: `Trial balance is out of balance by ${difference.toString()} satang`,
      status: 'error',
      reasoning: `Total debits: ${totalDebits.toString()} satang, total credits: ${totalCredits.toString()} satang. Difference: ${difference.toString()} satang. Investigate and correct before closing.`,
    };
  }

  private checkRevenueExpenseActivity(
    input: MonthEndCloseInput,
    trace: AgentTrace,
  ): ChecklistItem {
    const revenueAccounts = input.accountBalances.filter(
      (ab) => ab.accountType === 'revenue',
    );
    const expenseAccounts = input.accountBalances.filter(
      (ab) => ab.accountType === 'expense',
    );

    const revenueWithActivity = revenueAccounts.filter(
      (ab) => ab.periodDebits > 0n || ab.periodCredits > 0n,
    );
    const expenseWithActivity = expenseAccounts.filter(
      (ab) => ab.periodDebits > 0n || ab.periodCredits > 0n,
    );

    trace.addStep('reasoning', 'Checking revenue/expense activity', {
      revenueAccounts: revenueAccounts.length,
      revenueWithActivity: revenueWithActivity.length,
      expenseAccounts: expenseAccounts.length,
      expenseWithActivity: expenseWithActivity.length,
    });

    if (revenueAccounts.length === 0 && expenseAccounts.length === 0) {
      return {
        description: 'No revenue or expense accounts configured',
        status: 'needs-review',
        reasoning: 'No revenue or expense accounts found. Verify chart of accounts is properly configured.',
      };
    }

    if (revenueWithActivity.length === 0 && expenseWithActivity.length === 0) {
      return {
        description: 'No revenue or expense activity in period',
        status: 'needs-review',
        reasoning: 'Neither revenue nor expense accounts show any activity this period. Verify all transactions have been recorded.',
      };
    }

    return {
      description: `Revenue/expense activity verified: ${revenueWithActivity.length} revenue, ${expenseWithActivity.length} expense accounts active`,
      status: 'complete',
      reasoning: `${revenueWithActivity.length} of ${revenueAccounts.length} revenue accounts and ${expenseWithActivity.length} of ${expenseAccounts.length} expense accounts have period activity.`,
    };
  }

  // ---------------------------------------------------------------------------
  // Suggested journal entries
  // ---------------------------------------------------------------------------

  private suggestDepreciationEntries(
    input: MonthEndCloseInput,
    trace: AgentTrace,
  ): SuggestedJournalEntry[] {
    if (input.fixedAssets.length === 0) {
      trace.addStep('reasoning', 'No fixed assets — skipping depreciation suggestions');
      return [];
    }

    const entries: SuggestedJournalEntry[] = [];

    for (const asset of input.fixedAssets) {
      if (asset.monthlyDepreciation <= 0n) continue;

      entries.push({
        description: `Monthly depreciation: ${asset.description}`,
        entryType: 'depreciation',
        debits: [
          {
            accountCode: asset.depreciationAccountCode,
            accountName: `Depreciation Expense - ${asset.description}`,
            amount: asset.monthlyDepreciation,
          },
        ],
        credits: [
          {
            accountCode: asset.assetAccountCode,
            accountName: `Accumulated Depreciation - ${asset.description}`,
            amount: asset.monthlyDepreciation,
          },
        ],
        reasoning: `Asset "${asset.description}" has monthly depreciation of ${asset.monthlyDepreciation.toString()} satang. Cost: ${asset.acquisitionCost.toString()}, accumulated: ${asset.accumulatedDepreciation.toString()}.`,
      });
    }

    trace.addStep('reasoning', `Generated ${entries.length} depreciation entry suggestion(s)`, {
      assetCount: input.fixedAssets.length,
      entryCount: entries.length,
    });

    return entries;
  }

  private suggestAccrualEntries(
    input: MonthEndCloseInput,
    trace: AgentTrace,
  ): SuggestedJournalEntry[] {
    if (input.accruals.length === 0) {
      trace.addStep('reasoning', 'No accrual items — skipping accrual suggestions');
      return [];
    }

    const entries: SuggestedJournalEntry[] = [];

    for (const accrual of input.accruals) {
      if (accrual.amount <= 0n) continue;

      entries.push({
        description: `Accrued expense: ${accrual.description}`,
        entryType: 'accrual',
        debits: [
          {
            accountCode: accrual.expenseAccountCode,
            accountName: `Expense - ${accrual.description}`,
            amount: accrual.amount,
          },
        ],
        credits: [
          {
            accountCode: accrual.liabilityAccountCode,
            accountName: `Accrued Liability - ${accrual.description}`,
            amount: accrual.amount,
          },
        ],
        reasoning: `Accrual for "${accrual.description}" of ${accrual.amount.toString()} satang. Debit expense account ${accrual.expenseAccountCode}, credit liability account ${accrual.liabilityAccountCode}.`,
      });
    }

    trace.addStep('reasoning', `Generated ${entries.length} accrual entry suggestion(s)`, {
      accrualCount: input.accruals.length,
      entryCount: entries.length,
    });

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Confidence computation
  // ---------------------------------------------------------------------------

  /**
   * Compute overall confidence based on checklist results.
   *
   * All complete   → 0.95 (AUTO zone)
   * Has reviews    → 0.65 (REVIEW zone)
   * Has errors     → 0.30 (MANUAL zone)
   * All errors     → 0.05 (BLOCKED zone)
   */
  private computeConfidence(checklist: ReadonlyArray<ChecklistItem>): number {
    if (checklist.length === 0) return 0.5;

    const passed = checklist.filter((c) => c.status === 'complete').length;
    const reviews = checklist.filter((c) => c.status === 'needs-review').length;
    const errors = checklist.filter((c) => c.status === 'error').length;
    const total = checklist.length;

    if (errors === total) return 0.05;
    if (errors > 0) return Math.max(0.1, 0.5 - (errors / total) * 0.4);
    if (reviews > 0) return Math.max(0.5, 0.9 - (reviews / total) * 0.4);
    if (passed === total) return 0.95;

    return 0.5;
  }
}

// Re-export ConfidenceZone for consumers
export { ConfidenceZone };
