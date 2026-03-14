/**
 * InvoiceMatchingAgent — AI agent for matching payments to outstanding invoices.
 *
 * Implements Story 5.3: deterministic, rule-based scoring with full reasoning
 * transparency (FR18: no black-box AI). The agent does NOT require an LLM
 * for its core logic; scoring is computed from three signals:
 *
 *   1. Amount match    — exact or near-exact amount comparison (weight 0.55)
 *   2. Customer match  — same customerId on payment and invoice (weight 0.30)
 *   3. Date proximity  — payment date within 90-day recency window (weight 0.15)
 *
 * Edge cases handled:
 *   - No invoices available         → BLOCKED (AgentFailure)
 *   - Multiple candidates tie        → best returned with lower SUGGEST zone
 *   - Same-amount ambiguity          → confidence reduced, zone stays REVIEW
 *
 * Architecture references: AR11, FR18-FR21
 * Story: 5.3
 */

import { ValidationError } from '@neip/shared';

import {
  classifyConfidence,
  toConfidenceScore,
  ConfidenceZone,
} from '../types/agent-types.js';
import type {
  AgentContext,
  AgentResult,
  ConfidenceScore,
} from '../types/agent-types.js';
import { BaseAgent, AgentTrace } from './base-agent.js';

// ---------------------------------------------------------------------------
// Domain types — invoice matching I/O
// ---------------------------------------------------------------------------

/**
 * An outstanding invoice that may be matched against an incoming payment.
 * Amounts are represented in satang (THB smallest unit) — never floats.
 */
export interface OutstandingInvoice {
  /** Unique invoice identifier (UUIDv7). */
  readonly id: string;
  /** Invoice number displayed to users (e.g. "INV-2025-0042"). */
  readonly invoiceNumber: string;
  /** Amount due in satang. */
  readonly amountDue: bigint;
  /** Customer/contact identifier. */
  readonly customerId: string;
  /** ISO 8601 date when the invoice was issued. */
  readonly issuedAt: string;
  /** ISO 8601 date the invoice is due. */
  readonly dueAt: string;
}

/**
 * Incoming payment information to match against invoices.
 */
export interface PaymentInfo {
  /** Unique payment identifier (UUIDv7). */
  readonly id: string;
  /** Payment amount in satang. */
  readonly amount: bigint;
  /** Customer/contact identifier (may be unknown → empty string). */
  readonly customerId: string;
  /** ISO 8601 date the payment was received. */
  readonly receivedAt: string;
  /**
   * Reference text from the bank statement (memo / narration).
   * Free-form — used for logging only in this version.
   */
  readonly reference?: string | undefined;
}

/**
 * A single matched invoice with its individual score breakdown.
 */
export interface InvoiceMatchCandidate {
  readonly invoice: OutstandingInvoice;
  /** Composite confidence score for this specific invoice. */
  readonly score: ConfidenceScore;
  /** Formatted reason string (FR18). */
  readonly reason: string;
}

/**
 * Output produced by InvoiceMatchingAgent on success.
 */
export interface InvoiceMatchOutput {
  /**
   * The top-ranked matched invoice.
   * Callers should inspect `zone` to decide whether to auto-apply or review.
   */
  readonly bestMatch: InvoiceMatchCandidate;
  /**
   * All candidates that scored above zero, ordered by score descending.
   * Includes `bestMatch` as the first entry.
   */
  readonly allCandidates: ReadonlyArray<InvoiceMatchCandidate>;
  /**
   * True when multiple invoices share the same amount as the payment,
   * making the match ambiguous. Consumers should surface this to users.
   */
  readonly hasAmountAmbiguity: boolean;
  /** The original payment that was matched. */
  readonly payment: PaymentInfo;
}

/**
 * Input accepted by InvoiceMatchingAgent.
 */
export interface InvoiceMatchInput {
  /** The payment to match. */
  readonly payment: PaymentInfo;
  /** All currently outstanding invoices (may be empty). */
  readonly invoices: ReadonlyArray<OutstandingInvoice>;
}

// ---------------------------------------------------------------------------
// Scoring configuration
// ---------------------------------------------------------------------------

/**
 * Scoring weights — must sum to 1.0.
 *
 * Amount is the strongest signal; customer presence disambiguates ties;
 * date proximity is a mild tie-breaker for recent invoices.
 */
const WEIGHT_AMOUNT = 0.55 as const;
const WEIGHT_CUSTOMER = 0.30 as const;
const WEIGHT_DATE = 0.15 as const;

/**
 * Invoices whose amount deviates from the payment by more than this fraction
 * (of the payment amount) receive a partial amount score rather than zero.
 *
 * Example: tolerance 0.005 means ±0.5% off is still 0.75 partial score.
 * Exact match (0 deviation) always scores 1.0.
 */
const PARTIAL_AMOUNT_TOLERANCE = 0.005 as const;

/**
 * Days within which an invoice is considered "recent" and earns a full date
 * proximity score. Beyond this window the score decays linearly to zero at
 * 2× the window (180 days).
 */
const DATE_WINDOW_DAYS = 90 as const;

/**
 * Minimum number of same-amount invoices to be considered ambiguous.
 */
const AMBIGUITY_THRESHOLD = 2 as const;

/**
 * Confidence penalty applied per additional same-amount invoice beyond the
 * first when ambiguity is detected.
 */
const AMBIGUITY_PENALTY_PER_EXTRA = 0.05 as const;

/**
 * Minimum score for a candidate to be included in `allCandidates`.
 * Invoices that score below this are filtered out as irrelevant.
 */
const MIN_CANDIDATE_SCORE = 0.1 as const;

// ---------------------------------------------------------------------------
// InvoiceMatchingAgent
// ---------------------------------------------------------------------------

/**
 * Agent that scores each outstanding invoice against an incoming payment
 * and returns the best match with a full reasoning trace (FR18).
 *
 * The agent is purely rule-based for scoring and does not call an LLM,
 * which keeps it deterministic and testable with no external dependencies.
 */
export class InvoiceMatchingAgent extends BaseAgent<
  InvoiceMatchInput,
  InvoiceMatchOutput
> {
  constructor(config?: { agentId?: string; timeoutMs?: number }) {
    super({
      agentId: config?.agentId ?? 'invoice-matching-agent',
      ...(config?.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
    });
  }

  // ---------------------------------------------------------------------------
  // executeCore — implements BaseAgent abstract method
  // ---------------------------------------------------------------------------

  protected async executeCore(
    input: InvoiceMatchInput,
    context: AgentContext,
    trace: AgentTrace,
  ): Promise<AgentResult<InvoiceMatchOutput>> {
    const startMs = Date.now();

    trace.addStep('reasoning', 'Invoice matching: validating input', {
      paymentId: input.payment.id,
      invoiceCount: input.invoices.length,
      tenantId: context.tenantId,
    });

    // Guard: no invoices to match against
    if (input.invoices.length === 0) {
      trace.addStep(
        'reasoning',
        'No outstanding invoices available — cannot match payment',
        { paymentId: input.payment.id },
      );
      return this.buildFailure(
        new ValidationError({
          detail: `Payment ${input.payment.id}: no outstanding invoices available to match against.`,
        }),
        trace,
        startMs,
      );
    }

    trace.addStep('reasoning', 'Scoring each invoice candidate', {
      paymentAmount: String(input.payment.amount),
      paymentCustomerId: input.payment.customerId,
      paymentReceivedAt: input.payment.receivedAt,
    });

    // Score all invoices
    const rawScores = input.invoices.map((invoice) =>
      this.scoreCandidate(invoice, input.payment, trace),
    );

    // Filter out irrelevant candidates (score too low)
    const qualifyingCandidates = rawScores.filter(
      (c) => (c.score as number) >= MIN_CANDIDATE_SCORE,
    );

    trace.addStep('reasoning', 'Candidate filtering complete', {
      totalInvoices: input.invoices.length,
      qualifyingCandidates: qualifyingCandidates.length,
    });

    // Guard: no qualifying match found
    if (qualifyingCandidates.length === 0) {
      trace.addStep(
        'reasoning',
        'No invoice scored above the minimum threshold — returning BLOCKED',
        { minThreshold: MIN_CANDIDATE_SCORE },
      );
      return this.buildFailure(
        new ValidationError({
          detail: `Payment ${input.payment.id}: no invoice scored above minimum threshold ${MIN_CANDIDATE_SCORE}. Manual review required.`,
        }),
        trace,
        startMs,
      );
    }

    // Sort descending by score
    const sorted = [...qualifyingCandidates].sort(
      (a, b) => (b.score as number) - (a.score as number),
    );

    // Detect same-amount ambiguity
    const sameAmountCount = input.invoices.filter(
      (inv) => inv.amountDue === input.payment.amount,
    ).length;
    const hasAmountAmbiguity = sameAmountCount >= AMBIGUITY_THRESHOLD;

    if (hasAmountAmbiguity) {
      trace.addStep('reasoning', 'Same-amount ambiguity detected', {
        sameAmountCount,
        ambiguityThreshold: AMBIGUITY_THRESHOLD,
      });
    }

    // Best match is the top scorer (after ambiguity adjustment)
    const bestRaw = sorted[0];
    // sorted is guaranteed non-empty after the guard above
    const bestCandidate = bestRaw!;

    // Apply ambiguity penalty to the best score when multiple invoices share
    // the same amount, making it unclear which one is correct.
    const adjustedBestScore = hasAmountAmbiguity
      ? this.applyAmbiguityPenalty(
          bestCandidate.score,
          sameAmountCount,
          trace,
        )
      : bestCandidate.score;

    const finalBestCandidate: InvoiceMatchCandidate = {
      ...bestCandidate,
      score: adjustedBestScore,
      reason: hasAmountAmbiguity
        ? `${bestCandidate.reason} [ambiguity: ${sameAmountCount} invoices share this amount]`
        : bestCandidate.reason,
    };

    // Adjust all candidates' scores when ambiguity is present
    const finalCandidates: InvoiceMatchCandidate[] = sorted.map((c) =>
      hasAmountAmbiguity && c.invoice.amountDue === input.payment.amount
        ? {
            ...c,
            score: this.applyAmbiguityPenalty(c.score, sameAmountCount, trace),
            reason: `${c.reason} [ambiguity: ${sameAmountCount} invoices share this amount]`,
          }
        : c,
    );

    // Patch bestMatch in allCandidates with the adjusted score
    finalCandidates[0] = finalBestCandidate;

    trace.addStep('final-answer', 'Best match selected', {
      invoiceId: finalBestCandidate.invoice.id,
      invoiceNumber: finalBestCandidate.invoice.invoiceNumber,
      score: adjustedBestScore as number,
      zone: classifyConfidence(adjustedBestScore),
      hasAmountAmbiguity,
    });

    const output: InvoiceMatchOutput = {
      bestMatch: finalBestCandidate,
      allCandidates: finalCandidates,
      hasAmountAmbiguity,
      payment: input.payment,
    };

    return this.buildSuccess(output, adjustedBestScore as number, trace, startMs);
  }

  // ---------------------------------------------------------------------------
  // Private scoring helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute a composite confidence score for one invoice against the payment.
   *
   * Scoring breakdown:
   *   amount score    × WEIGHT_AMOUNT   (0.55)
   *   customer score  × WEIGHT_CUSTOMER (0.30)
   *   date score      × WEIGHT_DATE     (0.15)
   */
  private scoreCandidate(
    invoice: OutstandingInvoice,
    payment: PaymentInfo,
    trace: AgentTrace,
  ): InvoiceMatchCandidate {
    const amountScore = this.scoreAmount(invoice.amountDue, payment.amount);
    const customerScore = this.scoreCustomer(
      invoice.customerId,
      payment.customerId,
    );
    const dateScore = this.scoreDate(invoice.issuedAt, payment.receivedAt);

    const composite =
      amountScore * WEIGHT_AMOUNT +
      customerScore * WEIGHT_CUSTOMER +
      dateScore * WEIGHT_DATE;

    const score = toConfidenceScore(Math.min(1, Math.max(0, composite)));

    const reason = this.buildReason({
      invoice,
      amountScore,
      customerScore,
      dateScore,
      composite,
    });

    trace.addStep('reasoning', `Scored invoice ${invoice.invoiceNumber}`, {
      invoiceId: invoice.id,
      amountScore,
      customerScore,
      dateScore,
      composite,
      zone: classifyConfidence(score),
    });

    return { invoice, score, reason };
  }

  /**
   * Score how well the invoice amount matches the payment amount.
   *
   * Returns:
   *   1.0  — exact match
   *   0.75 — within PARTIAL_AMOUNT_TOLERANCE (±0.5% of payment)
   *   0.0  — outside tolerance
   */
  private scoreAmount(invoiceAmount: bigint, paymentAmount: bigint): number {
    if (invoiceAmount === paymentAmount) return 1.0;

    // Avoid division by zero for zero-amount payments
    if (paymentAmount === 0n) return 0.0;

    const diff =
      invoiceAmount > paymentAmount
        ? invoiceAmount - paymentAmount
        : paymentAmount - invoiceAmount;

    // Use Number() for the ratio calculation — satang values fit safely in float64
    const ratio = Number(diff) / Number(paymentAmount);

    if (ratio <= PARTIAL_AMOUNT_TOLERANCE) return 0.75;

    return 0.0;
  }

  /**
   * Score the customer identifier match.
   *
   * Returns:
   *   1.0 — both customerId values are identical and non-empty
   *   0.0 — either is empty or they differ
   */
  private scoreCustomer(
    invoiceCustomerId: string,
    paymentCustomerId: string,
  ): number {
    if (invoiceCustomerId === '' || paymentCustomerId === '') return 0.0;
    return invoiceCustomerId === paymentCustomerId ? 1.0 : 0.0;
  }

  /**
   * Score date proximity between invoice issuance and payment receipt.
   *
   * Returns:
   *   1.0  — invoice issued within DATE_WINDOW_DAYS (90 days) before payment
   *   0–1  — linear decay between DATE_WINDOW_DAYS and 2×DATE_WINDOW_DAYS
   *   0.0  — beyond 2× window or invoice issued after payment
   */
  private scoreDate(invoiceIssuedAt: string, paymentReceivedAt: string): number {
    const invoiceMs = Date.parse(invoiceIssuedAt);
    const paymentMs = Date.parse(paymentReceivedAt);

    if (isNaN(invoiceMs) || isNaN(paymentMs)) return 0.0;

    const diffDays = (paymentMs - invoiceMs) / (1000 * 60 * 60 * 24);

    // Invoice issued after payment date is invalid
    if (diffDays < 0) return 0.0;

    if (diffDays <= DATE_WINDOW_DAYS) return 1.0;

    const decayWindow = DATE_WINDOW_DAYS; // decay over another 90 days
    const decayProgress = (diffDays - DATE_WINDOW_DAYS) / decayWindow;

    if (decayProgress >= 1.0) return 0.0;

    return 1.0 - decayProgress;
  }

  /**
   * Apply a confidence penalty when multiple invoices share the same amount,
   * making it impossible to resolve the match purely by amount.
   */
  private applyAmbiguityPenalty(
    score: ConfidenceScore,
    sameAmountCount: number,
    trace: AgentTrace,
  ): ConfidenceScore {
    const extraInvoices = sameAmountCount - 1;
    const penalty = extraInvoices * AMBIGUITY_PENALTY_PER_EXTRA;
    const adjusted = Math.max(0, (score as number) - penalty);

    trace.addStep('reasoning', 'Applied ambiguity confidence penalty', {
      originalScore: score as number,
      penalty,
      adjustedScore: adjusted,
    });

    return toConfidenceScore(adjusted);
  }

  /**
   * Build a human-readable reason string for FR18 transparency.
   */
  private buildReason(params: {
    invoice: OutstandingInvoice;
    amountScore: number;
    customerScore: number;
    dateScore: number;
    composite: number;
  }): string {
    const { invoice, amountScore, customerScore, dateScore, composite } = params;

    const amountLabel =
      amountScore === 1.0
        ? 'exact amount match'
        : amountScore > 0
          ? 'near-exact amount match'
          : 'amount mismatch';

    const customerLabel =
      customerScore === 1.0 ? 'customer matches' : 'customer unknown/differs';

    const dateLabel =
      dateScore >= 0.9
        ? 'invoice is recent'
        : dateScore >= 0.5
          ? 'invoice is moderately recent'
          : 'invoice is old';

    const pct = Math.round(composite * 100);

    return (
      `Invoice ${invoice.invoiceNumber} (${invoice.id.slice(0, 8)}): ` +
      `${amountLabel}, ${customerLabel}, ${dateLabel} — composite score ${pct}%`
    );
  }
}

// ---------------------------------------------------------------------------
// Re-export ConfidenceZone for consumers who only import from this module
// ---------------------------------------------------------------------------
export { ConfidenceZone };
