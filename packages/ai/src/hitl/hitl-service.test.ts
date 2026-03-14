/**
 * Unit tests for HitlService — Story 5.4.
 *
 * Coverage:
 *   - addToQueue: creates a pending item and emits domain event
 *   - approve: transitions to approved, emits event
 *   - reject: transitions to rejected with reason, emits event
 *   - reassign: rejects + replaces target, emits event
 *   - batchApprove: approves multiple items, skips non-pending
 *   - list: filters by status, confidence zone, document type
 *   - error cases: not-found, already-reviewed
 *
 * Story: 5.4
 */

import { describe, expect, it, beforeEach } from 'vitest';

import { NotFoundError, ValidationError } from '@neip/shared';

import { ConfidenceZone } from '../types/agent-types.js';
import {
  HitlService,
  InMemoryHitlStore,
  InMemoryHitlEventEmitter,
} from './hitl-service.js';
import type {
  AddToQueueInput,
  HitlSuggestedAction,
} from './hitl-service.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeInput(overrides?: Partial<AddToQueueInput>): AddToQueueInput {
  return {
    id: 'hitl-001',
    tenantId: 'tenant-t1',
    documentRef: 'pay-001',
    documentType: 'invoice-match',
    amount: '100000',
    confidence: 0.72,
    aiReasoning: ['Scored invoice INV-001: exact amount match, customer matches'],
    suggestedAction: {
      actionType: 'match-invoice',
      targetId: 'inv-001',
      metadata: { invoiceNumber: 'INV-001' },
    },
    createdBy: 'system',
    ...overrides,
  };
}

function makeCorrectedTarget(): HitlSuggestedAction {
  return {
    actionType: 'match-invoice',
    targetId: 'inv-002',
    metadata: { invoiceNumber: 'INV-002' },
  };
}

let store: InMemoryHitlStore;
let emitter: InMemoryHitlEventEmitter;
let service: HitlService;

beforeEach(() => {
  store = new InMemoryHitlStore();
  emitter = new InMemoryHitlEventEmitter();
  service = new HitlService(store, emitter);
});

// ---------------------------------------------------------------------------
// addToQueue
// ---------------------------------------------------------------------------

describe('HitlService.addToQueue', () => {
  it('creates a pending item with correct fields', async () => {
    const input = makeInput();
    const item = await service.addToQueue(input);

    expect(item.id).toBe('hitl-001');
    expect(item.tenantId).toBe('tenant-t1');
    expect(item.documentRef).toBe('pay-001');
    expect(item.documentType).toBe('invoice-match');
    expect(item.amount).toBe('100000');
    expect(item.confidence).toBe(0.72);
    expect(item.status).toBe('pending');
    expect(item.createdBy).toBe('system');
    expect(item.reviewedBy).toBeNull();
    expect(item.reviewedAt).toBeNull();
    expect(item.reason).toBeNull();
  });

  it('emits a hitl.item-queued domain event', async () => {
    await service.addToQueue(makeInput());

    expect(emitter.events).toHaveLength(1);
    expect(emitter.events[0]?.type).toBe('hitl.item-queued');
    expect(emitter.events[0]?.tenantId).toBe('tenant-t1');

    const payload = emitter.events[0]?.payload as Record<string, unknown>;
    expect(payload['hitlItemId']).toBe('hitl-001');
    expect(payload['confidence']).toBe(0.72);
  });

  it('stores the item in the store', async () => {
    await service.addToQueue(makeInput());
    const stored = await store.findById('hitl-001');
    expect(stored).toBeDefined();
    expect(stored?.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// approve
// ---------------------------------------------------------------------------

describe('HitlService.approve', () => {
  it('transitions a pending item to approved', async () => {
    await service.addToQueue(makeInput());
    const approved = await service.approve('hitl-001', 'user-alice');

    expect(approved.status).toBe('approved');
    expect(approved.reviewedBy).toBe('user-alice');
    expect(approved.reviewedAt).toBeTruthy();
  });

  it('emits a hitl.item-approved domain event', async () => {
    await service.addToQueue(makeInput());
    await service.approve('hitl-001', 'user-alice');

    const approvedEvents = emitter.events.filter((e) => e.type === 'hitl.item-approved');
    expect(approvedEvents).toHaveLength(1);

    const payload = approvedEvents[0]?.payload as Record<string, unknown>;
    expect(payload['reviewedBy']).toBe('user-alice');
  });

  it('throws NotFoundError for non-existent item', async () => {
    await expect(service.approve('nonexistent', 'user-alice')).rejects.toThrow(
      NotFoundError,
    );
  });

  it('throws ValidationError when item is already approved', async () => {
    await service.addToQueue(makeInput());
    await service.approve('hitl-001', 'user-alice');

    await expect(service.approve('hitl-001', 'user-bob')).rejects.toThrow(
      ValidationError,
    );
  });
});

// ---------------------------------------------------------------------------
// reject
// ---------------------------------------------------------------------------

describe('HitlService.reject', () => {
  it('transitions a pending item to rejected with reason', async () => {
    await service.addToQueue(makeInput());
    const rejected = await service.reject('hitl-001', 'user-bob', 'Wrong invoice');

    expect(rejected.status).toBe('rejected');
    expect(rejected.reviewedBy).toBe('user-bob');
    expect(rejected.reason).toBe('Wrong invoice');
  });

  it('emits a hitl.item-rejected domain event', async () => {
    await service.addToQueue(makeInput());
    await service.reject('hitl-001', 'user-bob', 'Wrong invoice');

    const rejectedEvents = emitter.events.filter((e) => e.type === 'hitl.item-rejected');
    expect(rejectedEvents).toHaveLength(1);

    const payload = rejectedEvents[0]?.payload as Record<string, unknown>;
    expect(payload['rejectionReason']).toBe('Wrong invoice');
  });

  it('throws ValidationError when item is already rejected', async () => {
    await service.addToQueue(makeInput());
    await service.reject('hitl-001', 'user-bob', 'Wrong');
    await expect(service.reject('hitl-001', 'user-alice', 'Also wrong')).rejects.toThrow(
      ValidationError,
    );
  });
});

// ---------------------------------------------------------------------------
// reassign
// ---------------------------------------------------------------------------

describe('HitlService.reassign', () => {
  it('rejects the item and replaces the suggested action with corrected target', async () => {
    await service.addToQueue(makeInput());
    const corrected = makeCorrectedTarget();
    const reassigned = await service.reassign('hitl-001', 'user-carol', corrected);

    expect(reassigned.status).toBe('rejected');
    expect(reassigned.reviewedBy).toBe('user-carol');
    expect(reassigned.suggestedAction.targetId).toBe('inv-002');
    expect(reassigned.reason).toContain('inv-002');
  });

  it('emits a hitl.item-reassigned domain event', async () => {
    await service.addToQueue(makeInput());
    await service.reassign('hitl-001', 'user-carol', makeCorrectedTarget());

    const reassignEvents = emitter.events.filter((e) => e.type === 'hitl.item-reassigned');
    expect(reassignEvents).toHaveLength(1);

    const payload = reassignEvents[0]?.payload as Record<string, unknown>;
    expect(payload['originalTarget']).toBe('inv-001');
    expect(payload['correctedTarget']).toBe('inv-002');
  });
});

// ---------------------------------------------------------------------------
// batchApprove
// ---------------------------------------------------------------------------

describe('HitlService.batchApprove', () => {
  it('approves multiple pending items', async () => {
    await service.addToQueue(makeInput({ id: 'batch-1' }));
    await service.addToQueue(makeInput({ id: 'batch-2' }));
    await service.addToQueue(makeInput({ id: 'batch-3' }));

    const results = await service.batchApprove(
      ['batch-1', 'batch-2', 'batch-3'],
      'user-batch',
    );

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.status).toBe('approved');
      expect(r.reviewedBy).toBe('user-batch');
    }
  });

  it('skips non-pending items without throwing', async () => {
    await service.addToQueue(makeInput({ id: 'batch-a' }));
    await service.addToQueue(makeInput({ id: 'batch-b' }));
    // Approve batch-a first
    await service.approve('batch-a', 'user-x');

    const results = await service.batchApprove(['batch-a', 'batch-b'], 'user-batch');
    // Only batch-b should be approved (batch-a was already approved)
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('batch-b');
  });

  it('skips non-existent items without throwing', async () => {
    await service.addToQueue(makeInput({ id: 'batch-exists' }));
    const results = await service.batchApprove(
      ['nonexistent', 'batch-exists'],
      'user-batch',
    );
    expect(results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe('HitlService.list', () => {
  it('filters by tenantId', async () => {
    await service.addToQueue(makeInput({ id: 'list-1', tenantId: 'tenant-a' }));
    await service.addToQueue(makeInput({ id: 'list-2', tenantId: 'tenant-b' }));

    const result = await service.list({ tenantId: 'tenant-a' });
    expect(result).toHaveLength(1);
    expect(result[0]?.tenantId).toBe('tenant-a');
  });

  it('filters by status', async () => {
    await service.addToQueue(makeInput({ id: 'status-1', tenantId: 't1' }));
    await service.addToQueue(makeInput({ id: 'status-2', tenantId: 't1' }));
    await service.approve('status-1', 'user-x');

    const pending = await service.list({ tenantId: 't1', status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe('status-2');

    const approved = await service.list({ tenantId: 't1', status: 'approved' });
    expect(approved).toHaveLength(1);
    expect(approved[0]?.id).toBe('status-1');
  });

  it('filters by document type', async () => {
    await service.addToQueue(makeInput({ id: 'dt-1', tenantId: 't1', documentType: 'invoice-match' }));
    await service.addToQueue(makeInput({ id: 'dt-2', tenantId: 't1', documentType: 'payment-apply' }));

    const result = await service.list({ tenantId: 't1', documentType: 'invoice-match' });
    expect(result).toHaveLength(1);
    expect(result[0]?.documentType).toBe('invoice-match');
  });

  it('filters by confidence zone', async () => {
    // REVIEW zone: 0.50-0.74
    await service.addToQueue(makeInput({ id: 'zone-review', tenantId: 't1', confidence: 0.65 }));
    // MANUAL zone: 0.10-0.49
    await service.addToQueue(makeInput({ id: 'zone-manual', tenantId: 't1', confidence: 0.35 }));

    const reviewItems = await service.list({
      tenantId: 't1',
      confidenceZone: ConfidenceZone.REVIEW,
    });
    expect(reviewItems).toHaveLength(1);
    expect(reviewItems[0]?.id).toBe('zone-review');

    const manualItems = await service.list({
      tenantId: 't1',
      confidenceZone: ConfidenceZone.MANUAL,
    });
    expect(manualItems).toHaveLength(1);
    expect(manualItems[0]?.id).toBe('zone-manual');
  });
});
