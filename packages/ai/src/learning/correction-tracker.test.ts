/**
 * Unit tests for CorrectionTracker — Story 5.5.
 *
 * Coverage:
 *   - Recording corrections (approve, reject, reassign)
 *   - Domain event emission for each correction
 *   - Query corrections by agent type
 *   - Metrics: acceptance rate, rejection rate, reassign rate
 *   - Metrics by confidence zone
 *   - No PII in records or events
 *
 * Story: 5.5
 */

import { describe, expect, it, beforeEach } from 'vitest';

import { ConfidenceZone } from '../types/agent-types.js';
import {
  CorrectionTracker,
  InMemoryCorrectionStore,
  InMemoryCorrectionEventEmitter,
} from './correction-tracker.js';
import type { RecordCorrectionInput } from './correction-tracker.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeInput(overrides?: Partial<RecordCorrectionInput>): RecordCorrectionInput {
  return {
    id: 'corr-001',
    tenantId: 'tenant-t1',
    agentType: 'invoice-matching-agent',
    originalSuggestion: 'inv-001',
    humanDecision: 'approve',
    confidence: 0.72,
    documentRef: 'pay-001',
    ...overrides,
  };
}

let store: InMemoryCorrectionStore;
let emitter: InMemoryCorrectionEventEmitter;
let tracker: CorrectionTracker;

beforeEach(() => {
  store = new InMemoryCorrectionStore();
  emitter = new InMemoryCorrectionEventEmitter();
  tracker = new CorrectionTracker(store, emitter);
});

// ---------------------------------------------------------------------------
// Recording corrections
// ---------------------------------------------------------------------------

describe('CorrectionTracker.recordCorrection', () => {
  it('records an approval correction', async () => {
    const record = await tracker.recordCorrection(makeInput());

    expect(record.id).toBe('corr-001');
    expect(record.humanDecision).toBe('approve');
    expect(record.agentType).toBe('invoice-matching-agent');
    expect(record.originalSuggestion).toBe('inv-001');
    expect(record.correctTarget).toBeNull();
    expect(record.confidence).toBe(0.72);
    expect(record.confidenceZone).toBe(ConfidenceZone.REVIEW);
    expect(record.timestamp).toBeTruthy();
  });

  it('records a rejection correction', async () => {
    const record = await tracker.recordCorrection(
      makeInput({ id: 'corr-rej', humanDecision: 'reject' }),
    );
    expect(record.humanDecision).toBe('reject');
    expect(record.correctTarget).toBeNull();
  });

  it('records a reassign correction with corrected target', async () => {
    const record = await tracker.recordCorrection(
      makeInput({
        id: 'corr-reassign',
        humanDecision: 'reassign',
        correctTarget: 'inv-002',
      }),
    );
    expect(record.humanDecision).toBe('reassign');
    expect(record.correctTarget).toBe('inv-002');
  });

  it('emits an ai.correction domain event', async () => {
    await tracker.recordCorrection(makeInput());

    expect(emitter.events).toHaveLength(1);
    expect(emitter.events[0]?.type).toBe('ai.correction');
    expect(emitter.events[0]?.tenantId).toBe('tenant-t1');

    const payload = emitter.events[0]?.payload as Record<string, unknown>;
    expect(payload['agentType']).toBe('invoice-matching-agent');
    expect(payload['humanDecision']).toBe('approve');
    expect(payload['confidence']).toBe(0.72);
    expect(payload['confidenceZone']).toBe(ConfidenceZone.REVIEW);
  });

  it('classifies confidence zone correctly', async () => {
    // AUTO: >= 0.90
    const auto = await tracker.recordCorrection(
      makeInput({ id: 'z-auto', confidence: 0.95 }),
    );
    expect(auto.confidenceZone).toBe(ConfidenceZone.AUTO);

    // SUGGEST: 0.75-0.89
    const suggest = await tracker.recordCorrection(
      makeInput({ id: 'z-suggest', confidence: 0.80 }),
    );
    expect(suggest.confidenceZone).toBe(ConfidenceZone.SUGGEST);

    // REVIEW: 0.50-0.74
    const review = await tracker.recordCorrection(
      makeInput({ id: 'z-review', confidence: 0.60 }),
    );
    expect(review.confidenceZone).toBe(ConfidenceZone.REVIEW);

    // MANUAL: 0.10-0.49
    const manual = await tracker.recordCorrection(
      makeInput({ id: 'z-manual', confidence: 0.30 }),
    );
    expect(manual.confidenceZone).toBe(ConfidenceZone.MANUAL);
  });

  it('does not store PII — only document references and amounts', async () => {
    const record = await tracker.recordCorrection(makeInput());

    // Verify the record only contains references, not customer names etc.
    const keys = Object.keys(record);
    expect(keys).not.toContain('customerName');
    expect(keys).not.toContain('email');
    expect(keys).not.toContain('phone');
    expect(keys).not.toContain('address');
  });
});

// ---------------------------------------------------------------------------
// Query corrections
// ---------------------------------------------------------------------------

describe('CorrectionTracker.getCorrectionsForAgent', () => {
  it('returns corrections filtered by agent type and tenant', async () => {
    await tracker.recordCorrection(
      makeInput({ id: 'c1', agentType: 'invoice-matching-agent' }),
    );
    await tracker.recordCorrection(
      makeInput({ id: 'c2', agentType: 'payment-agent' }),
    );
    await tracker.recordCorrection(
      makeInput({ id: 'c3', agentType: 'invoice-matching-agent', tenantId: 'other-tenant' }),
    );

    const result = await tracker.getCorrectionsForAgent(
      'invoice-matching-agent',
      'tenant-t1',
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('c1');
  });
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

describe('CorrectionTracker.getMetricsForAgent', () => {
  it('returns zero metrics when no corrections exist', async () => {
    const metrics = await tracker.getMetricsForAgent(
      'invoice-matching-agent',
      'tenant-t1',
    );
    expect(metrics.totalDecisions).toBe(0);
    expect(metrics.acceptanceRate).toBe(0);
    expect(metrics.rejectionRate).toBe(0);
  });

  it('computes acceptance/rejection/reassign rates correctly', async () => {
    // 3 approvals, 1 rejection, 1 reassign = 5 total
    await tracker.recordCorrection(makeInput({ id: 'a1', humanDecision: 'approve' }));
    await tracker.recordCorrection(makeInput({ id: 'a2', humanDecision: 'approve' }));
    await tracker.recordCorrection(makeInput({ id: 'a3', humanDecision: 'approve' }));
    await tracker.recordCorrection(makeInput({ id: 'r1', humanDecision: 'reject' }));
    await tracker.recordCorrection(
      makeInput({ id: 'ra1', humanDecision: 'reassign', correctTarget: 'inv-x' }),
    );

    const metrics = await tracker.getMetricsForAgent(
      'invoice-matching-agent',
      'tenant-t1',
    );

    expect(metrics.totalDecisions).toBe(5);
    expect(metrics.approvalCount).toBe(3);
    expect(metrics.rejectionCount).toBe(1);
    expect(metrics.reassignCount).toBe(1);
    expect(metrics.acceptanceRate).toBeCloseTo(0.6);
    expect(metrics.rejectionRate).toBeCloseTo(0.2);
    expect(metrics.reassignRate).toBeCloseTo(0.2);
  });
});

// ---------------------------------------------------------------------------
// Metrics by zone
// ---------------------------------------------------------------------------

describe('CorrectionTracker.getMetricsByZone', () => {
  it('breaks down metrics by confidence zone', async () => {
    // REVIEW zone (0.50-0.74)
    await tracker.recordCorrection(
      makeInput({ id: 'rz1', confidence: 0.65, humanDecision: 'approve' }),
    );
    await tracker.recordCorrection(
      makeInput({ id: 'rz2', confidence: 0.70, humanDecision: 'reject' }),
    );

    // SUGGEST zone (0.75-0.89)
    await tracker.recordCorrection(
      makeInput({ id: 'sz1', confidence: 0.80, humanDecision: 'approve' }),
    );

    const byZone = await tracker.getMetricsByZone(
      'invoice-matching-agent',
      'tenant-t1',
    );

    // REVIEW zone: 1 approval, 1 rejection
    expect(byZone[ConfidenceZone.REVIEW].totalDecisions).toBe(2);
    expect(byZone[ConfidenceZone.REVIEW].acceptanceRate).toBeCloseTo(0.5);
    expect(byZone[ConfidenceZone.REVIEW].rejectionRate).toBeCloseTo(0.5);

    // SUGGEST zone: 1 approval
    expect(byZone[ConfidenceZone.SUGGEST].totalDecisions).toBe(1);
    expect(byZone[ConfidenceZone.SUGGEST].acceptanceRate).toBeCloseTo(1.0);

    // AUTO, MANUAL, BLOCKED zones: no data
    expect(byZone[ConfidenceZone.AUTO].totalDecisions).toBe(0);
    expect(byZone[ConfidenceZone.MANUAL].totalDecisions).toBe(0);
    expect(byZone[ConfidenceZone.BLOCKED].totalDecisions).toBe(0);
  });
});
