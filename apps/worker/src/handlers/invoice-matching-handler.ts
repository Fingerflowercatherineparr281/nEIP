/**
 * Invoice Matching Job Handler — Story 5.3.
 *
 * Processes `invoice.match` jobs from the pg-boss queue.
 * Delegates all scoring to InvoiceMatchingAgent from @neip/ai.
 *
 * Execution flow:
 *   1. Extract payment info and outstanding invoices from job payload
 *      (in production these would come from @neip/db; this handler uses
 *       stubs so it can be wired and compiled without a live database)
 *   2. Build AgentContext from job metadata (tenantId, correlationId)
 *   3. Run InvoiceMatchingAgent.execute()
 *   4. Interpret the result zone:
 *       AUTO    → log and mark ready for auto-apply (downstream job)
 *       SUGGEST → log and emit suggestion for human confirmation
 *       REVIEW  → log and flag for manual review
 *       MANUAL  → log warning, escalate to human queue
 *       BLOCKED → log error, do NOT apply, surface to ops
 *   5. Return void (success) or throw (triggers pg-boss retry)
 *
 * Architecture references: AR10 (pg-boss), AR11 (agents), FR18-FR21
 * Story: 5.3
 */

import {
  InvoiceMatchingAgent,
  isAgentSuccess,
  ConfidenceZone,
  HitlService,
  InMemoryHitlStore,
  InMemoryHitlEventEmitter,
  CorrectionTracker,
  InMemoryCorrectionStore,
  InMemoryCorrectionEventEmitter,
} from '@neip/ai';
import type {
  OutstandingInvoice,
  PaymentInfo,
  AgentContext,
  AddToQueueInput,
} from '@neip/ai';

import type { JobHandlerInput } from '../types/jobs.js';
import { JOB_NAMES } from '../types/jobs.js';
import { log } from '../logger.js';

// ---------------------------------------------------------------------------
// Singleton agent — shared across all job invocations in this worker process.
// InvoiceMatchingAgent is stateless so a single instance is safe.
// ---------------------------------------------------------------------------

const matchingAgent = new InvoiceMatchingAgent();

// ---------------------------------------------------------------------------
// HITL queue service — Story 5.4
// In production these stores would be backed by @neip/db; in-memory for now.
// ---------------------------------------------------------------------------
const hitlStore = new InMemoryHitlStore();
const hitlEmitter = new InMemoryHitlEventEmitter();
const hitlService = new HitlService(hitlStore, hitlEmitter);

// ---------------------------------------------------------------------------
// Correction tracker — Story 5.5
// Wired into HITL service callbacks for automatic correction recording.
// ---------------------------------------------------------------------------
// Exported for use by HITL approve/reject handlers in future stories
export const correctionStore = new InMemoryCorrectionStore();
export const correctionEmitter = new InMemoryCorrectionEventEmitter();
export const correctionTracker = new CorrectionTracker(correctionStore, correctionEmitter);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for the `invoice.match` job.
 *
 * NOTE: The `loadPaymentAndInvoices` helper below is intentionally stubbed.
 * In production it will be replaced by a @neip/db query that fetches the
 * payment record and all open invoices for the tenant.  The stub allows the
 * handler to compile and be registered without a database connection.
 */
export async function handleInvoiceMatch(
  job: JobHandlerInput<typeof JOB_NAMES.INVOICE_MATCH>,
): Promise<void> {
  const { id: jobId, data } = job;
  const { tenantId, paymentId, correlationId } = data;

  log.info({
    msg: 'invoice.match: processing',
    jobId,
    jobName: job.name,
    tenantId,
    paymentId,
    correlationId,
    retryCount: job.retryCount,
  });

  // ------------------------------------------------------------------
  // 1. Load payment + outstanding invoices
  //    Stubbed for Story 5.3; replace with actual DB queries in 5.4.
  // ------------------------------------------------------------------
  const { payment, invoices } = await loadPaymentAndInvoices(
    tenantId,
    paymentId,
    data.amountSatang,
    data.customerId,
  );

  // ------------------------------------------------------------------
  // 2. Build AgentContext
  // ------------------------------------------------------------------
  const context: AgentContext = {
    tenantId,
    userId: 'system',
    correlationId: correlationId ?? jobId,
    metadata: {
      paymentId,
      jobId,
      retryCount: job.retryCount,
    },
  };

  // ------------------------------------------------------------------
  // 3. Run the matching agent
  // ------------------------------------------------------------------
  log.info({
    msg: 'invoice.match: running InvoiceMatchingAgent',
    jobId,
    tenantId,
    paymentId,
    invoiceCount: invoices.length,
  });

  const result = await matchingAgent.execute({ payment, invoices }, context);

  // ------------------------------------------------------------------
  // 4. Interpret the result by confidence zone
  // ------------------------------------------------------------------
  if (!isAgentSuccess(result)) {
    log.error({
      msg: 'invoice.match: agent returned BLOCKED — no match found',
      jobId,
      tenantId,
      paymentId,
      zone: result.zone,
      error: result.error.detail,
      reasoning: result.reasoning,
      durationMs: result.durationMs,
    });
    // Do NOT throw — a permanent BLOCKED result should not retry endlessly.
    // Returning void marks the job as completed (failed-but-handled).
    return;
  }

  const { bestMatch, allCandidates, hasAmountAmbiguity } = result.data;

  // Common log context for all zone branches
  const matchLogContext = {
    jobId,
    tenantId,
    paymentId,
    matchedInvoiceId: bestMatch.invoice.id,
    matchedInvoiceNumber: bestMatch.invoice.invoiceNumber,
    confidence: result.confidence as number,
    zone: result.zone,
    hasAmountAmbiguity,
    candidateCount: allCandidates.length,
    reasoning: result.reasoning,
    durationMs: result.durationMs,
  };

  switch (result.zone) {
    case ConfidenceZone.AUTO:
      log.info({
        msg: 'invoice.match: AUTO — queuing payment-apply job',
        ...matchLogContext,
      });
      // AUTO zone: auto-apply without human review
      // TODO: enqueue payment.apply job with paymentId + invoiceId
      break;

    case ConfidenceZone.SUGGEST:
      log.info({
        msg: 'invoice.match: SUGGEST — adding to HITL queue for confirmation',
        ...matchLogContext,
      });
      // Story 5.4: add to HITL queue for human confirmation
      await addToHitlQueue(
        tenantId,
        paymentId,
        jobId,
        result.confidence as number,
        result.reasoning,
        bestMatch,
      );
      break;

    case ConfidenceZone.REVIEW:
      log.warn({
        msg: 'invoice.match: REVIEW — adding to HITL queue for review',
        ...matchLogContext,
      });
      // Story 5.4: add to HITL queue for human review
      await addToHitlQueue(
        tenantId,
        paymentId,
        jobId,
        result.confidence as number,
        result.reasoning,
        bestMatch,
      );
      break;

    case ConfidenceZone.MANUAL:
      log.warn({
        msg: 'invoice.match: MANUAL — adding to HITL queue for manual handling',
        ...matchLogContext,
      });
      // Story 5.4: add to HITL queue for manual handling
      await addToHitlQueue(
        tenantId,
        paymentId,
        jobId,
        result.confidence as number,
        result.reasoning,
        bestMatch,
      );
      break;

    case ConfidenceZone.BLOCKED:
      // Unreachable: isAgentSuccess(result) returned true above,
      // so zone can never be BLOCKED on the success branch.
      // Listed here for exhaustiveness — TypeScript requires all enum members.
      log.error({
        msg: 'invoice.match: unexpected BLOCKED zone on success result',
        jobId,
        tenantId,
        paymentId,
        confidence: result.confidence as number,
        durationMs: result.durationMs,
      });
      break;
  }

  log.info({
    msg: 'invoice.match: completed',
    jobId,
    tenantId,
    paymentId,
    zone: result.zone,
    confidence: result.confidence as number,
    durationMs: result.durationMs,
  });
}

// ---------------------------------------------------------------------------
// Data loading stub
// ---------------------------------------------------------------------------

/**
 * Stub: returns a synthetic payment and empty invoice list.
 *
 * Replace this function body in Story 5.4 with actual @neip/db queries:
 *
 * ```ts
 * const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
 * const invoices = await db.query.invoices.findMany({
 *   where: and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'open')),
 * });
 * ```
 */
async function loadPaymentAndInvoices(
  _tenantId: string,
  paymentId: string,
  amountSatang: string | undefined,
  customerId: string | undefined,
): Promise<{ payment: PaymentInfo; invoices: ReadonlyArray<OutstandingInvoice> }> {
  // Parse the pre-supplied amount string (if any) to bigint.
  // In a real implementation this comes from the DB.
  const amount =
    amountSatang !== undefined && amountSatang !== ''
      ? BigInt(amountSatang)
      : 0n;

  const payment: PaymentInfo = {
    id: paymentId,
    amount,
    customerId: customerId ?? '',
    receivedAt: new Date().toISOString(),
  };

  // Stub: no invoices loaded — agent will return BLOCKED.
  // The stub lets this handler be registered and tested without a DB.
  const invoices: OutstandingInvoice[] = [];

  return { payment, invoices };
}

// ---------------------------------------------------------------------------
// HITL queue helper — Story 5.4
// ---------------------------------------------------------------------------

/**
 * Add a below-threshold AI result to the HITL queue for human review.
 * Called when the InvoiceMatchingAgent returns SUGGEST, REVIEW, or MANUAL zone.
 */
async function addToHitlQueue(
  tenantId: string,
  paymentId: string,
  jobId: string,
  confidence: number,
  reasoning: ReadonlyArray<string>,
  bestMatch: { invoice: { id: string; invoiceNumber: string }; score: unknown; reason: string },
): Promise<void> {
  const input: AddToQueueInput = {
    id: `hitl-${jobId}`,
    tenantId,
    documentRef: paymentId,
    documentType: 'invoice-match',
    amount: '0', // Amount will come from the payment record in production
    confidence,
    aiReasoning: [...reasoning],
    suggestedAction: {
      actionType: 'match-invoice',
      targetId: bestMatch.invoice.id,
      metadata: {
        invoiceNumber: bestMatch.invoice.invoiceNumber,
        matchReason: bestMatch.reason,
        matchScore: bestMatch.score as number,
      },
    },
    createdBy: 'system',
  };

  try {
    await hitlService.addToQueue(input);
    log.info({
      msg: 'invoice.match: added to HITL queue',
      jobId,
      hitlItemId: input.id,
      tenantId,
      paymentId,
      confidence,
    });
  } catch (err) {
    log.error({
      msg: 'invoice.match: failed to add to HITL queue',
      jobId,
      tenantId,
      paymentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
