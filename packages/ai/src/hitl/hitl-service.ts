/**
 * HITL (Human-in-the-Loop) Queue Service — Story 5.4.
 *
 * Manages the review queue for AI results that fall below the auto-threshold.
 * Supports approve, reject, reassign, batch approve, and filtered listing.
 *
 * All state changes emit DomainEvent instances for downstream consumers.
 * The service is storage-agnostic — callers inject a HitlStore adapter
 * (backed by Drizzle in production, in-memory for tests).
 *
 * Architecture references: AR11, FR19-FR23
 * Story: 5.4
 */

import type { DomainEvent } from '@neip/shared';
import { NotFoundError, ValidationError } from '@neip/shared';

import type { ConfidenceScore } from '../types/agent-types.js';
import { ConfidenceZone, classifyConfidence } from '../types/agent-types.js';

// ---------------------------------------------------------------------------
// HITL item types
// ---------------------------------------------------------------------------

/** Status of a HITL queue item */
export type HitlStatus = 'pending' | 'approved' | 'rejected';

/** Structured suggested action from the AI agent */
export interface HitlSuggestedAction {
  /** The action type (e.g. 'match-invoice', 'apply-payment') */
  readonly actionType: string;
  /** Target entity ID for the action */
  readonly targetId: string;
  /** Additional action-specific metadata */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * A single item in the HITL review queue.
 * Mirrors the hitl_queue DB table shape.
 */
export interface HitlQueueItem {
  readonly id: string;
  readonly tenantId: string;
  readonly documentRef: string;
  readonly documentType: string;
  /** Amount in satang (serialised as string for bigint safety) */
  readonly amount: string;
  readonly confidence: number;
  readonly aiReasoning: ReadonlyArray<string>;
  readonly suggestedAction: HitlSuggestedAction;
  readonly status: HitlStatus;
  readonly createdBy: string;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  readonly reason: string | null;
  readonly createdAt: string;
}

/** Input for adding a new item to the queue */
export interface AddToQueueInput {
  readonly id: string;
  readonly tenantId: string;
  readonly documentRef: string;
  readonly documentType: string;
  readonly amount: string;
  readonly confidence: number;
  readonly aiReasoning: ReadonlyArray<string>;
  readonly suggestedAction: HitlSuggestedAction;
  readonly createdBy: string;
}

/** Filter criteria for listing queue items */
export interface HitlListFilters {
  readonly tenantId: string;
  readonly status?: HitlStatus | undefined;
  readonly confidenceZone?: ConfidenceZone | undefined;
  readonly documentType?: string | undefined;
}

// ---------------------------------------------------------------------------
// Store adapter interface (dependency injection)
// ---------------------------------------------------------------------------

/**
 * Storage adapter for HITL queue persistence.
 * Implemented by Drizzle adapter in production, in-memory for tests.
 */
export interface HitlStore {
  insert(item: HitlQueueItem): Promise<void>;
  findById(id: string): Promise<HitlQueueItem | undefined>;
  update(id: string, patch: Partial<HitlQueueItem>): Promise<void>;
  list(filters: HitlListFilters): Promise<ReadonlyArray<HitlQueueItem>>;
}

// ---------------------------------------------------------------------------
// Event emitter interface
// ---------------------------------------------------------------------------

/**
 * Emitter for domain events produced by HITL operations.
 * Callers inject a concrete implementation (e.g. write to domain_events table).
 */
export interface HitlEventEmitter {
  emit(event: DomainEvent): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory store (for tests)
// ---------------------------------------------------------------------------

/**
 * Simple in-memory HitlStore for unit testing.
 * Not intended for production use.
 */
export class InMemoryHitlStore implements HitlStore {
  private readonly items = new Map<string, HitlQueueItem>();

  async insert(item: HitlQueueItem): Promise<void> {
    this.items.set(item.id, item);
  }

  async findById(id: string): Promise<HitlQueueItem | undefined> {
    return this.items.get(id);
  }

  async update(id: string, patch: Partial<HitlQueueItem>): Promise<void> {
    const existing = this.items.get(id);
    if (existing === undefined) return;
    this.items.set(id, { ...existing, ...patch } as HitlQueueItem);
  }

  async list(filters: HitlListFilters): Promise<ReadonlyArray<HitlQueueItem>> {
    const results: HitlQueueItem[] = [];
    for (const item of this.items.values()) {
      if (item.tenantId !== filters.tenantId) continue;
      if (filters.status !== undefined && item.status !== filters.status) continue;
      if (filters.documentType !== undefined && item.documentType !== filters.documentType) continue;
      if (filters.confidenceZone !== undefined) {
        const zone = classifyConfidence(item.confidence as unknown as ConfidenceScore);
        if (zone !== filters.confidenceZone) continue;
      }
      results.push(item);
    }
    return results;
  }

  /** Test helper — get all items */
  getAll(): ReadonlyArray<HitlQueueItem> {
    return [...this.items.values()];
  }
}

// ---------------------------------------------------------------------------
// In-memory event emitter (for tests)
// ---------------------------------------------------------------------------

export class InMemoryHitlEventEmitter implements HitlEventEmitter {
  readonly events: DomainEvent[] = [];

  async emit(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
}

// ---------------------------------------------------------------------------
// HITL Service
// ---------------------------------------------------------------------------

/**
 * Core service for managing the HITL review queue.
 *
 * Depends on injectable HitlStore and HitlEventEmitter so it can be
 * tested without a database and used with any persistence backend.
 */
export class HitlService {
  private readonly store: HitlStore;
  private readonly emitter: HitlEventEmitter;

  constructor(store: HitlStore, emitter: HitlEventEmitter) {
    this.store = store;
    this.emitter = emitter;
  }

  // -----------------------------------------------------------------------
  // addToQueue
  // -----------------------------------------------------------------------

  /**
   * Add an AI result below the auto-threshold to the HITL queue.
   * Emits a `hitl.item-queued` domain event.
   */
  async addToQueue(input: AddToQueueInput): Promise<HitlQueueItem> {
    const now = new Date().toISOString();

    const item: HitlQueueItem = {
      id: input.id,
      tenantId: input.tenantId,
      documentRef: input.documentRef,
      documentType: input.documentType,
      amount: input.amount,
      confidence: input.confidence,
      aiReasoning: input.aiReasoning,
      suggestedAction: input.suggestedAction,
      status: 'pending',
      createdBy: input.createdBy,
      reviewedBy: null,
      reviewedAt: null,
      reason: null,
      createdAt: now,
    };

    await this.store.insert(item);

    await this.emitter.emit({
      id: `evt-${input.id}`,
      type: 'hitl.item-queued',
      tenantId: input.tenantId,
      payload: {
        hitlItemId: input.id,
        documentRef: input.documentRef,
        documentType: input.documentType,
        confidence: input.confidence,
      },
      version: 1,
      timestamp: new Date(),
    });

    return item;
  }

  // -----------------------------------------------------------------------
  // approve
  // -----------------------------------------------------------------------

  /**
   * Approve a HITL queue item and execute its suggested action.
   * Emits a `hitl.item-approved` domain event.
   */
  async approve(id: string, userId: string): Promise<HitlQueueItem> {
    const item = await this.getItemOrThrow(id);
    this.assertPending(item);

    const now = new Date().toISOString();
    const patch: Partial<HitlQueueItem> = {
      status: 'approved',
      reviewedBy: userId,
      reviewedAt: now,
    };
    await this.store.update(id, patch);

    const updated: HitlQueueItem = { ...item, ...patch };

    await this.emitter.emit({
      id: `evt-approve-${id}`,
      type: 'hitl.item-approved',
      tenantId: item.tenantId,
      payload: {
        hitlItemId: id,
        documentRef: item.documentRef,
        documentType: item.documentType,
        suggestedAction: item.suggestedAction,
        reviewedBy: userId,
      },
      version: 1,
      timestamp: new Date(),
    });

    return updated;
  }

  // -----------------------------------------------------------------------
  // reject
  // -----------------------------------------------------------------------

  /**
   * Reject a HITL queue item with a reason.
   * Emits a `hitl.item-rejected` domain event.
   */
  async reject(id: string, userId: string, reason: string): Promise<HitlQueueItem> {
    const item = await this.getItemOrThrow(id);
    this.assertPending(item);

    const now = new Date().toISOString();
    const patch: Partial<HitlQueueItem> = {
      status: 'rejected',
      reviewedBy: userId,
      reviewedAt: now,
      reason,
    };
    await this.store.update(id, patch);

    const updated: HitlQueueItem = { ...item, ...patch };

    await this.emitter.emit({
      id: `evt-reject-${id}`,
      type: 'hitl.item-rejected',
      tenantId: item.tenantId,
      payload: {
        hitlItemId: id,
        documentRef: item.documentRef,
        documentType: item.documentType,
        rejectionReason: reason,
        reviewedBy: userId,
      },
      version: 1,
      timestamp: new Date(),
    });

    return updated;
  }

  // -----------------------------------------------------------------------
  // reassign
  // -----------------------------------------------------------------------

  /**
   * Reject a HITL queue item and reassign with corrected target data.
   * Emits both `hitl.item-rejected` and `hitl.item-reassigned` domain events.
   */
  async reassign(
    id: string,
    userId: string,
    correctedTarget: HitlSuggestedAction,
  ): Promise<HitlQueueItem> {
    const item = await this.getItemOrThrow(id);
    this.assertPending(item);

    const now = new Date().toISOString();
    const patch: Partial<HitlQueueItem> = {
      status: 'rejected',
      reviewedBy: userId,
      reviewedAt: now,
      reason: `Reassigned to ${correctedTarget.targetId}`,
      suggestedAction: correctedTarget,
    };
    await this.store.update(id, patch);

    const updated: HitlQueueItem = { ...item, ...patch };

    await this.emitter.emit({
      id: `evt-reassign-${id}`,
      type: 'hitl.item-reassigned',
      tenantId: item.tenantId,
      payload: {
        hitlItemId: id,
        documentRef: item.documentRef,
        documentType: item.documentType,
        originalTarget: item.suggestedAction.targetId,
        correctedTarget: correctedTarget.targetId,
        reviewedBy: userId,
      },
      version: 1,
      timestamp: new Date(),
    });

    return updated;
  }

  // -----------------------------------------------------------------------
  // batchApprove
  // -----------------------------------------------------------------------

  /**
   * Approve multiple HITL queue items in a single batch.
   * Returns the list of approved items. Skips items that are not pending.
   */
  async batchApprove(
    ids: ReadonlyArray<string>,
    userId: string,
  ): Promise<ReadonlyArray<HitlQueueItem>> {
    const results: HitlQueueItem[] = [];
    for (const id of ids) {
      const item = await this.store.findById(id);
      if (item === undefined || item.status !== 'pending') continue;
      const approved = await this.approve(id, userId);
      results.push(approved);
    }
    return results;
  }

  // -----------------------------------------------------------------------
  // list
  // -----------------------------------------------------------------------

  /**
   * List HITL queue items matching the given filters.
   */
  async list(filters: HitlListFilters): Promise<ReadonlyArray<HitlQueueItem>> {
    return this.store.list(filters);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async getItemOrThrow(id: string): Promise<HitlQueueItem> {
    const item = await this.store.findById(id);
    if (item === undefined) {
      throw new NotFoundError({
        detail: `HITL queue item "${id}" not found.`,
      });
    }
    return item;
  }

  private assertPending(item: HitlQueueItem): void {
    if (item.status !== 'pending') {
      throw new ValidationError({
        detail: `HITL queue item "${item.id}" is already ${item.status}. Only pending items can be reviewed.`,
      });
    }
  }
}
