/**
 * Unit tests for MonthEndCloseAgent — Story 12.1.
 *
 * Coverage:
 *   - All checks pass → AUTO zone (high confidence)
 *   - Unmatched payments → REVIEW or MANUAL zone
 *   - Unbalanced journal entries → error checklist items
 *   - Draft entries → needs-review checklist items
 *   - Balance discrepancies → error checklist items
 *   - Trial balance out of balance → error
 *   - Depreciation suggestions generated from fixed assets
 *   - Accrual suggestions generated from accrual items
 *   - Invalid fiscal period → BLOCKED
 *   - Empty inputs → basic pass
 *   - Reasoning trace is non-empty (FR18)
 *
 * Story: 12.1
 */

import { describe, expect, it } from 'vitest';

import { ConfidenceZone } from '../types/agent-types.js';
import type { AgentContext } from '../types/agent-types.js';
import { MonthEndCloseAgent } from './month-end-close-agent.js';
import type {
  MonthEndCloseInput,
  PeriodJournalEntry,
  AccountBalance,
  UnmatchedPayment,
  BalanceDiscrepancy,
  FixedAsset,
  AccrualItem,
} from './month-end-close-agent.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeContext = (overrides?: Partial<AgentContext>): AgentContext => ({
  tenantId: 'tenant-test',
  userId: 'user-test',
  correlationId: 'corr-test',
  metadata: {},
  ...overrides,
});

function makeBaseInput(overrides?: Partial<MonthEndCloseInput>): MonthEndCloseInput {
  return {
    fiscalYear: 2025,
    fiscalPeriod: 6,
    periodStartDate: '2025-06-01',
    periodEndDate: '2025-06-30',
    journalEntries: [],
    accountBalances: [],
    unmatchedPayments: [],
    balanceDiscrepancies: [],
    fixedAssets: [],
    accruals: [],
    ...overrides,
  };
}

let idCounter = 0;

function makeJournalEntry(overrides?: Partial<PeriodJournalEntry>): PeriodJournalEntry {
  idCounter += 1;
  return {
    id: `je-test-${String(idCounter)}`,
    entryNumber: 'JE-001',
    date: '2025-06-15',
    totalDebit: 100000n,
    totalCredit: 100000n,
    status: 'posted',
    ...overrides,
  };
}

function makeAccountBalance(overrides?: Partial<AccountBalance>): AccountBalance {
  return {
    accountCode: '1100',
    accountName: 'Cash',
    accountType: 'asset',
    openingBalance: 1000000n,
    closingBalance: 1200000n,
    periodDebits: 500000n,
    periodCredits: 300000n,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MonthEndCloseAgent', () => {
  const agent = new MonthEndCloseAgent();

  it('returns success with all checks passed for clean data', async () => {
    const input = makeBaseInput({
      journalEntries: [makeJournalEntry()],
      accountBalances: [
        makeAccountBalance({
          accountType: 'revenue',
          periodDebits: 0n,
          periodCredits: 500000n,
        }),
        makeAccountBalance({
          accountCode: '5100',
          accountName: 'COGS',
          accountType: 'expense',
          periodDebits: 500000n,
          periodCredits: 0n,
        }),
      ],
    });

    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.summary.errorChecks).toBe(0);
    expect(result.data.summary.canAutoClose).toBe(true);
    expect(result.zone).toBe(ConfidenceZone.AUTO);
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('returns BLOCKED for invalid fiscal period', async () => {
    const input = makeBaseInput({ fiscalPeriod: 13 });
    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(false);
    expect(result.zone).toBe(ConfidenceZone.BLOCKED);
  });

  it('detects unmatched payments as needs-review', async () => {
    const unmatchedPayments: UnmatchedPayment[] = [
      { paymentId: 'p1', amount: 50000n, receivedAt: '2025-06-10' },
      { paymentId: 'p2', amount: 75000n, receivedAt: '2025-06-15' },
    ];

    const input = makeBaseInput({
      unmatchedPayments,
      accountBalances: [
        makeAccountBalance({ accountType: 'revenue', periodCredits: 100n }),
      ],
    });

    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;

    const unmatchedCheck = result.data.checklist.find(
      (c) => c.description.includes('unmatched payment'),
    );
    expect(unmatchedCheck).toBeDefined();
    expect(unmatchedCheck!.status).toBe('needs-review');
  });

  it('detects many unmatched payments as error', async () => {
    const unmatchedPayments: UnmatchedPayment[] = Array.from({ length: 6 }, (_, i) => ({
      paymentId: `p${i}`,
      amount: 10000n,
      receivedAt: '2025-06-10',
    }));

    const input = makeBaseInput({
      unmatchedPayments,
      accountBalances: [
        makeAccountBalance({ accountType: 'revenue', periodCredits: 100n }),
      ],
    });

    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;

    const unmatchedCheck = result.data.checklist.find(
      (c) => c.description.includes('unmatched payment'),
    );
    expect(unmatchedCheck!.status).toBe('error');
  });

  it('detects unbalanced journal entries as error', async () => {
    const input = makeBaseInput({
      journalEntries: [
        makeJournalEntry({ totalDebit: 100000n, totalCredit: 90000n, entryNumber: 'JE-BAD' }),
      ],
      accountBalances: [
        makeAccountBalance({ accountType: 'revenue', periodCredits: 100n }),
      ],
    });

    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;

    const balanceCheck = result.data.checklist.find(
      (c) => c.description.includes('unbalanced'),
    );
    expect(balanceCheck).toBeDefined();
    expect(balanceCheck!.status).toBe('error');
  });

  it('detects draft journal entries as needs-review', async () => {
    const input = makeBaseInput({
      journalEntries: [
        makeJournalEntry({ status: 'draft' }),
      ],
      accountBalances: [
        makeAccountBalance({ accountType: 'revenue', periodCredits: 100n }),
      ],
    });

    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;

    const draftCheck = result.data.checklist.find(
      (c) => c.description.includes('draft'),
    );
    expect(draftCheck).toBeDefined();
    expect(draftCheck!.status).toBe('needs-review');
  });

  it('detects balance discrepancies as error', async () => {
    const discrepancies: BalanceDiscrepancy[] = [
      {
        accountCode: '1200',
        accountName: 'AR',
        subledgerBalance: 500000n,
        glBalance: 480000n,
        difference: 20000n,
      },
    ];

    const input = makeBaseInput({
      balanceDiscrepancies: discrepancies,
      accountBalances: [
        makeAccountBalance({ accountType: 'revenue', periodCredits: 100n }),
      ],
    });

    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;

    const discCheck = result.data.checklist.find(
      (c) => c.description.includes('discrepancy'),
    );
    expect(discCheck).toBeDefined();
    expect(discCheck!.status).toBe('error');
  });

  it('generates depreciation suggestions from fixed assets', async () => {
    const fixedAssets: FixedAsset[] = [
      {
        id: 'asset-1',
        description: 'Office Equipment',
        acquisitionCost: 1200000n,
        accumulatedDepreciation: 200000n,
        monthlyDepreciation: 20000n,
        depreciationAccountCode: '5500',
        assetAccountCode: '1500',
      },
    ];

    const input = makeBaseInput({
      fixedAssets,
      accountBalances: [
        makeAccountBalance({ accountType: 'revenue', periodCredits: 100n }),
      ],
    });

    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.suggestedEntries.length).toBe(1);
    expect(result.data.suggestedEntries[0]!.entryType).toBe('depreciation');
    expect(result.data.suggestedEntries[0]!.debits[0]!.amount).toBe(20000n);
  });

  it('generates accrual suggestions from accrual items', async () => {
    const accruals: AccrualItem[] = [
      {
        id: 'acc-1',
        description: 'Utility bill accrual',
        amount: 35000n,
        expenseAccountCode: '5400',
        liabilityAccountCode: '2300',
      },
    ];

    const input = makeBaseInput({
      accruals,
      accountBalances: [
        makeAccountBalance({ accountType: 'revenue', periodCredits: 100n }),
      ],
    });

    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.suggestedEntries.length).toBe(1);
    expect(result.data.suggestedEntries[0]!.entryType).toBe('accrual');
    expect(result.data.suggestedEntries[0]!.debits[0]!.accountCode).toBe('5400');
  });

  it('returns correct fiscal year/period in output', async () => {
    const input = makeBaseInput({ fiscalYear: 2025, fiscalPeriod: 11 });

    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.fiscalYear).toBe(2025);
    expect(result.data.fiscalPeriod).toBe(11);
  });

  it('produces non-empty reasoning trace (FR18)', async () => {
    const input = makeBaseInput();
    const result = await agent.execute(input, makeContext());

    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('detects trial balance out of balance', async () => {
    const input = makeBaseInput({
      accountBalances: [
        makeAccountBalance({
          accountType: 'revenue',
          periodDebits: 0n,
          periodCredits: 500000n,
        }),
        makeAccountBalance({
          accountCode: '5100',
          accountName: 'COGS',
          accountType: 'expense',
          periodDebits: 300000n,
          periodCredits: 0n,
        }),
      ],
    });

    const result = await agent.execute(input, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;

    const trialCheck = result.data.checklist.find(
      (c) => c.description.includes('Trial balance'),
    );
    expect(trialCheck).toBeDefined();
    // Debits: 500000+300000=800000, Credits: 300000+500000=800000
    // Wait, let's recalculate: first account periodDebits=0, periodCredits=500000
    // second account periodDebits=300000, periodCredits=0
    // totalDebits=300000, totalCredits=500000 => out of balance
    expect(trialCheck!.status).toBe('error');
  });
});
