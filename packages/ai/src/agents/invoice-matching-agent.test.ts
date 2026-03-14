/**
 * Unit tests for InvoiceMatchingAgent — Story 5.3.
 *
 * Coverage:
 *   - Exact amount + matching customer → AUTO zone (high confidence)
 *   - No invoices → BLOCKED (AgentFailure)
 *   - No qualifying match (all scores below threshold) → BLOCKED
 *   - Multiple candidates — lower-ranked invoices still present in allCandidates
 *   - Same-amount ambiguity → confidence reduced, `hasAmountAmbiguity` set
 *   - Customer mismatch reduces confidence compared to customer match
 *   - Date proximity scoring (recent vs. old invoices)
 *   - Reasoning trace is non-empty (FR18)
 *   - allCandidates ordered by score descending
 *
 * Story: 5.3
 */

import { describe, expect, it } from 'vitest';

import { ConfidenceZone } from '../types/agent-types.js';
import type { AgentContext } from '../types/agent-types.js';
import { InvoiceMatchingAgent } from './invoice-matching-agent.js';
import type {
  InvoiceMatchInput,
  OutstandingInvoice,
  PaymentInfo,
} from './invoice-matching-agent.js';

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

/** Returns an ISO date string N days before today. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** Returns an ISO date string N days from today. */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const PAYMENT_TODAY = new Date().toISOString();

function makeInvoice(overrides: Partial<OutstandingInvoice> & { id: string }): OutstandingInvoice {
  return {
    invoiceNumber: `INV-${overrides.id.slice(0, 4)}`,
    amountDue: 100_000n, // ฿1,000.00 in satang
    customerId: 'cust-abc',
    issuedAt: daysAgo(30),
    dueAt: daysFromNow(30),
    ...overrides,
  };
}

function makePayment(overrides?: Partial<PaymentInfo>): PaymentInfo {
  return {
    id: 'pay-0001',
    amount: 100_000n, // ฿1,000.00
    customerId: 'cust-abc',
    receivedAt: PAYMENT_TODAY,
    ...overrides,
  };
}

const agent = new InvoiceMatchingAgent();
const ctx = makeContext();

// ---------------------------------------------------------------------------
// Edge case: no invoices
// ---------------------------------------------------------------------------

describe('InvoiceMatchingAgent — no invoices', () => {
  it('returns BLOCKED when invoice list is empty', async () => {
    const input: InvoiceMatchInput = {
      payment: makePayment(),
      invoices: [],
    };

    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.zone).toBe(ConfidenceZone.BLOCKED);
    expect(result.error.detail).toContain('no outstanding invoices');
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Exact match — high confidence
// ---------------------------------------------------------------------------

describe('InvoiceMatchingAgent — exact amount match', () => {
  it('returns AUTO zone when amount and customer match with a recent invoice', async () => {
    const invoice = makeInvoice({ id: 'inv-0001' });
    const payment = makePayment();

    const input: InvoiceMatchInput = { payment, invoices: [invoice] };
    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.zone).toBe(ConfidenceZone.AUTO);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.data.bestMatch.invoice.id).toBe('inv-0001');
    expect(result.data.hasAmountAmbiguity).toBe(false);
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('includes a human-readable reason referencing exact amount match (FR18)', async () => {
    const invoice = makeInvoice({ id: 'inv-0002' });
    const input: InvoiceMatchInput = { payment: makePayment(), invoices: [invoice] };
    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.bestMatch.reason).toContain('exact amount match');
    expect(result.data.bestMatch.reason).toContain('INV-');
  });

  it('allCandidates contains exactly the matching invoice', async () => {
    const invoice = makeInvoice({ id: 'inv-0003' });
    const input: InvoiceMatchInput = { payment: makePayment(), invoices: [invoice] };
    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.allCandidates).toHaveLength(1);
    expect(result.data.allCandidates[0]?.invoice.id).toBe('inv-0003');
  });
});

// ---------------------------------------------------------------------------
// No qualifying match
// ---------------------------------------------------------------------------

describe('InvoiceMatchingAgent — no qualifying match', () => {
  it('returns BLOCKED when no invoice scores above the minimum threshold', async () => {
    // Invoice with completely different amount and different customer
    const invoice = makeInvoice({
      id: 'inv-mismatch',
      amountDue: 999_999_000n,  // wildly different
      customerId: 'cust-xyz',
      issuedAt: daysAgo(200),   // old — date score 0
    });
    // Payment with no customer id
    const payment = makePayment({
      amount: 100n,
      customerId: '',
    });

    const input: InvoiceMatchInput = { payment, invoices: [invoice] };
    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.zone).toBe(ConfidenceZone.BLOCKED);
    expect(result.error.detail).toContain('no invoice scored above minimum threshold');
  });
});

// ---------------------------------------------------------------------------
// Multiple candidates
// ---------------------------------------------------------------------------

describe('InvoiceMatchingAgent — multiple candidates', () => {
  it('returns the highest-scoring invoice as bestMatch', async () => {
    const highMatch = makeInvoice({
      id: 'inv-high',
      amountDue: 100_000n,
      customerId: 'cust-abc',
      issuedAt: daysAgo(10),  // very recent
    });
    const lowerMatch = makeInvoice({
      id: 'inv-low',
      amountDue: 100_000n,
      customerId: 'cust-different', // customer differs
      issuedAt: daysAgo(80),        // older
    });

    const input: InvoiceMatchInput = {
      payment: makePayment(),
      invoices: [lowerMatch, highMatch], // order reversed to test sorting
    };
    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.bestMatch.invoice.id).toBe('inv-high');
    expect(result.data.allCandidates[0]?.invoice.id).toBe('inv-high');
  });

  it('includes all qualifying candidates in allCandidates ordered by score desc', async () => {
    const inv1 = makeInvoice({ id: 'inv-a', amountDue: 100_000n, issuedAt: daysAgo(5) });
    const inv2 = makeInvoice({ id: 'inv-b', amountDue: 100_000n, issuedAt: daysAgo(80) });
    const inv3 = makeInvoice({ id: 'inv-c', amountDue: 100_000n, issuedAt: daysAgo(20) });

    const input: InvoiceMatchInput = {
      payment: makePayment(),
      invoices: [inv2, inv3, inv1],
    };
    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const scores = result.data.allCandidates.map((c) => c.score as number);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]!);
    }
  });

  it('returns a lower confidence than exact+single when multiple candidates exist', async () => {
    // Single exact match baseline
    const singleInv = makeInvoice({ id: 'inv-single' });
    const singleResult = await agent.execute(
      { payment: makePayment(), invoices: [singleInv] },
      ctx,
    );

    // Multiple exact-amount invoices (ambiguous)
    const inv1 = makeInvoice({ id: 'inv-multi-1' });
    const inv2 = makeInvoice({ id: 'inv-multi-2' });
    const multiResult = await agent.execute(
      { payment: makePayment(), invoices: [inv1, inv2] },
      ctx,
    );

    expect(singleResult.success).toBe(true);
    expect(multiResult.success).toBe(true);
    if (!singleResult.success || !multiResult.success) return;

    // Ambiguous multi-match should be less confident than a clean single match
    expect(multiResult.confidence).toBeLessThan(singleResult.confidence);
  });
});

// ---------------------------------------------------------------------------
// Same-amount ambiguity
// ---------------------------------------------------------------------------

describe('InvoiceMatchingAgent — same-amount ambiguity', () => {
  it('sets hasAmountAmbiguity=true when 2+ invoices share the payment amount', async () => {
    const inv1 = makeInvoice({ id: 'amb-1', customerId: 'cust-abc' });
    const inv2 = makeInvoice({ id: 'amb-2', customerId: 'cust-def' });

    const input: InvoiceMatchInput = {
      payment: makePayment(),
      invoices: [inv1, inv2],
    };
    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.hasAmountAmbiguity).toBe(true);
  });

  it('does NOT set hasAmountAmbiguity when only one invoice matches the amount', async () => {
    const inv1 = makeInvoice({ id: 'no-amb-1', amountDue: 100_000n });
    const inv2 = makeInvoice({ id: 'no-amb-2', amountDue: 200_000n }); // different amount

    const input: InvoiceMatchInput = {
      payment: makePayment({ amount: 100_000n }),
      invoices: [inv1, inv2],
    };
    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.hasAmountAmbiguity).toBe(false);
  });

  it('includes ambiguity notice in bestMatch reason string (FR18)', async () => {
    const inv1 = makeInvoice({ id: 'amb-reason-1' });
    const inv2 = makeInvoice({ id: 'amb-reason-2' });

    const input: InvoiceMatchInput = {
      payment: makePayment(),
      invoices: [inv1, inv2],
    };
    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.bestMatch.reason).toContain('ambiguity');
  });

  it('reduces confidence score when ambiguity is present', async () => {
    const inv1 = makeInvoice({ id: 'penalty-1' });
    const inv2 = makeInvoice({ id: 'penalty-2' });
    const inv3 = makeInvoice({ id: 'penalty-3' });

    // 3 invoices all with same amount
    const input: InvoiceMatchInput = {
      payment: makePayment(),
      invoices: [inv1, inv2, inv3],
    };
    const result = await agent.execute(input, ctx);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // With 3 same-amount invoices penalty = 2 × 0.05 = 0.10
    // Score should be less than it would be with just 1 invoice
    expect((result.data.bestMatch.score as number)).toBeLessThan(0.95);
  });
});

// ---------------------------------------------------------------------------
// Reasoning trace (FR18)
// ---------------------------------------------------------------------------

describe('InvoiceMatchingAgent — reasoning trace', () => {
  it('always returns non-empty reasoning array (FR18)', async () => {
    // Success path
    const inv = makeInvoice({ id: 'trace-inv' });
    const resultOk = await agent.execute({ payment: makePayment(), invoices: [inv] }, ctx);
    expect(resultOk.reasoning.length).toBeGreaterThan(0);

    // Failure path (empty invoices)
    const resultFail = await agent.execute({ payment: makePayment(), invoices: [] }, ctx);
    expect(resultFail.reasoning.length).toBeGreaterThan(0);
  });

  it('reasoning strings contain iter prefix (BaseAgent formatting)', async () => {
    const inv = makeInvoice({ id: 'trace-iter-inv' });
    const result = await agent.execute({ payment: makePayment(), invoices: [inv] }, ctx);
    expect(result.reasoning.some((r) => r.includes('@iter'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Customer scoring
// ---------------------------------------------------------------------------

describe('InvoiceMatchingAgent — customer scoring', () => {
  it('lower confidence when customer ids differ', async () => {
    const matchingCustomerInv = makeInvoice({
      id: 'cust-match',
      customerId: 'cust-abc',
    });
    const mismatchCustomerInv = makeInvoice({
      id: 'cust-mismatch',
      customerId: 'cust-other',
    });

    const matchResult = await agent.execute(
      { payment: makePayment({ customerId: 'cust-abc' }), invoices: [matchingCustomerInv] },
      ctx,
    );
    const mismatchResult = await agent.execute(
      { payment: makePayment({ customerId: 'cust-abc' }), invoices: [mismatchCustomerInv] },
      ctx,
    );

    expect(matchResult.success).toBe(true);
    expect(mismatchResult.success).toBe(true);
    if (!matchResult.success || !mismatchResult.success) return;

    expect(matchResult.confidence).toBeGreaterThan(mismatchResult.confidence);
  });
});

// ---------------------------------------------------------------------------
// Date proximity scoring
// ---------------------------------------------------------------------------

describe('InvoiceMatchingAgent — date proximity scoring', () => {
  it('recent invoice scores higher than old invoice with same amount and customer', async () => {
    const recentInv = makeInvoice({ id: 'date-recent', issuedAt: daysAgo(10) });
    const oldInv = makeInvoice({ id: 'date-old', issuedAt: daysAgo(160) });

    const recentResult = await agent.execute(
      { payment: makePayment(), invoices: [recentInv] },
      ctx,
    );
    const oldResult = await agent.execute(
      { payment: makePayment(), invoices: [oldInv] },
      ctx,
    );

    expect(recentResult.success).toBe(true);
    expect(oldResult.success).toBe(true);
    if (!recentResult.success || !oldResult.success) return;

    expect(recentResult.confidence).toBeGreaterThan(oldResult.confidence);
  });

  it('invoice issued after payment date receives lower date score', async () => {
    const futureInv = makeInvoice({
      id: 'date-future',
      issuedAt: daysFromNow(10), // issued in the future relative to payment
    });

    const result = await agent.execute(
      { payment: makePayment(), invoices: [futureInv] },
      ctx,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    // Future invoice loses date score (0.15 weight) — total < 1.0
    expect(result.confidence).toBeLessThan(1.0);
  });
});
