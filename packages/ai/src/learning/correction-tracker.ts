/**
 * AI Correction Learning Signal — Story 5.5.
 *
 * Records human corrections to AI suggestions so that acceptance/rejection
 * metrics can be tracked per agent type and confidence zone. These records
 * are stored as DomainEvent instances (type: `ai.correction`).
 *
 * Privacy: no PII is stored — only document references, amounts, and
 * confidence scores. Customer names, email addresses, etc. are never included.
 *
 * Architecture references: AR11, FR18-FR23
 * Story: 5.5
 */

import type { DomainEvent } from '@neip/shared';

import type { ConfidenceScore } from '../types/agent-types.js';
import { classifyConfidence, ConfidenceZone } from '../types/agent-types.js';

// ---------------------------------------------------------------------------
// Correction record types
// ---------------------------------------------------------------------------

/** Human decision taken on an AI suggestion */
export type HumanDecision = 'approve' | 'reject' | 'reassign';

/**
 * An AI correction record — captures what the AI suggested, what the human
 * decided, and the corrected target (if reassigned).
 *
 * No PII is stored. Only document references and amounts.
 */
export interface CorrectionRecord {
  /** Unique correction record ID */
  readonly id: string;
  /** Tenant scope */
  readonly tenantId: string;
  /** Agent type that produced the original suggestion */
  readonly agentType: string;
  /** Original AI-suggested target (e.g. invoice ID) */
  readonly originalSuggestion: string;
  /** Human decision: approve, reject, or reassign */
  readonly humanDecision: HumanDecision;
  /** Corrected target ID (only present for reassign) */
  readonly correctTarget: string | null;
  /** AI confidence score at time of suggestion */
  readonly confidence: number;
  /** Confidence zone at time of suggestion */
  readonly confidenceZone: ConfidenceZone;
  /** Document reference (e.g. payment ID) */
  readonly documentRef: string;
  /** ISO 8601 timestamp */
  readonly timestamp: string;
}

/** Input for recording a correction */
export interface RecordCorrectionInput {
  readonly id: string;
  readonly tenantId: string;
  readonly agentType: string;
  readonly originalSuggestion: string;
  readonly humanDecision: HumanDecision;
  readonly correctTarget?: string | undefined;
  readonly confidence: number;
  readonly documentRef: string;
}

// ---------------------------------------------------------------------------
// Metrics types
// ---------------------------------------------------------------------------

/** Acceptance/rejection metrics for a given scope */
export interface CorrectionMetrics {
  readonly totalDecisions: number;
  readonly approvalCount: number;
  readonly rejectionCount: number;
  readonly reassignCount: number;
  readonly acceptanceRate: number;
  readonly rejectionRate: number;
  readonly reassignRate: number;
}

/** Metrics broken down by confidence zone */
export type MetricsByZone = Readonly<Record<ConfidenceZone, CorrectionMetrics>>;

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

/**
 * Storage adapter for correction records.
 * In-memory for tests, Drizzle-backed for production.
 */
export interface CorrectionStore {
  insert(record: CorrectionRecord): Promise<void>;
  findByAgentType(agentType: string, tenantId: string): Promise<ReadonlyArray<CorrectionRecord>>;
  findAll(tenantId: string): Promise<ReadonlyArray<CorrectionRecord>>;
}

/**
 * Event emitter for correction domain events.
 */
export interface CorrectionEventEmitter {
  emit(event: DomainEvent): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory store (for tests)
// ---------------------------------------------------------------------------

export class InMemoryCorrectionStore implements CorrectionStore {
  private readonly records: CorrectionRecord[] = [];

  async insert(record: CorrectionRecord): Promise<void> {
    this.records.push(record);
  }

  async findByAgentType(
    agentType: string,
    tenantId: string,
  ): Promise<ReadonlyArray<CorrectionRecord>> {
    return this.records.filter(
      (r) => r.agentType === agentType && r.tenantId === tenantId,
    );
  }

  async findAll(tenantId: string): Promise<ReadonlyArray<CorrectionRecord>> {
    return this.records.filter((r) => r.tenantId === tenantId);
  }

  /** Test helper */
  getAll(): ReadonlyArray<CorrectionRecord> {
    return [...this.records];
  }
}

export class InMemoryCorrectionEventEmitter implements CorrectionEventEmitter {
  readonly events: DomainEvent[] = [];

  async emit(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
}

// ---------------------------------------------------------------------------
// CorrectionTracker
// ---------------------------------------------------------------------------

/**
 * Tracks human corrections to AI suggestions.
 *
 * Each correction is:
 *   1. Stored as a CorrectionRecord
 *   2. Emitted as a DomainEvent (type: `ai.correction`)
 *
 * Provides query methods for computing acceptance/rejection metrics
 * per agent type and per confidence zone.
 */
export class CorrectionTracker {
  private readonly store: CorrectionStore;
  private readonly emitter: CorrectionEventEmitter;

  constructor(store: CorrectionStore, emitter: CorrectionEventEmitter) {
    this.store = store;
    this.emitter = emitter;
  }

  // -----------------------------------------------------------------------
  // Record a correction
  // -----------------------------------------------------------------------

  /**
   * Record a human correction to an AI suggestion.
   * Emits an `ai.correction` domain event.
   */
  async recordCorrection(input: RecordCorrectionInput): Promise<CorrectionRecord> {
    const now = new Date().toISOString();
    const zone = classifyConfidence(input.confidence as unknown as ConfidenceScore);

    const record: CorrectionRecord = {
      id: input.id,
      tenantId: input.tenantId,
      agentType: input.agentType,
      originalSuggestion: input.originalSuggestion,
      humanDecision: input.humanDecision,
      correctTarget: input.correctTarget ?? null,
      confidence: input.confidence,
      confidenceZone: zone,
      documentRef: input.documentRef,
      timestamp: now,
    };

    await this.store.insert(record);

    await this.emitter.emit({
      id: `evt-correction-${input.id}`,
      type: 'ai.correction',
      tenantId: input.tenantId,
      payload: {
        correctionId: input.id,
        agentType: input.agentType,
        humanDecision: input.humanDecision,
        confidence: input.confidence,
        confidenceZone: zone,
        documentRef: input.documentRef,
        // No PII — only references and scores
      },
      version: 1,
      timestamp: new Date(),
    });

    return record;
  }

  // -----------------------------------------------------------------------
  // Query corrections
  // -----------------------------------------------------------------------

  /**
   * Get all corrections for a specific agent type within a tenant.
   */
  async getCorrectionsForAgent(
    agentType: string,
    tenantId: string,
  ): Promise<ReadonlyArray<CorrectionRecord>> {
    return this.store.findByAgentType(agentType, tenantId);
  }

  // -----------------------------------------------------------------------
  // Metrics
  // -----------------------------------------------------------------------

  /**
   * Calculate acceptance/rejection metrics for a specific agent type.
   */
  async getMetricsForAgent(
    agentType: string,
    tenantId: string,
  ): Promise<CorrectionMetrics> {
    const records = await this.store.findByAgentType(agentType, tenantId);
    return this.computeMetrics(records);
  }

  /**
   * Calculate acceptance/rejection metrics broken down by confidence zone.
   */
  async getMetricsByZone(
    agentType: string,
    tenantId: string,
  ): Promise<MetricsByZone> {
    const records = await this.store.findByAgentType(agentType, tenantId);

    const byZone: Record<ConfidenceZone, CorrectionRecord[]> = {
      [ConfidenceZone.AUTO]: [],
      [ConfidenceZone.SUGGEST]: [],
      [ConfidenceZone.REVIEW]: [],
      [ConfidenceZone.MANUAL]: [],
      [ConfidenceZone.BLOCKED]: [],
    };

    for (const record of records) {
      byZone[record.confidenceZone].push(record);
    }

    const result = {} as Record<ConfidenceZone, CorrectionMetrics>;
    for (const zone of Object.values(ConfidenceZone)) {
      result[zone] = this.computeMetrics(byZone[zone]);
    }

    return result as MetricsByZone;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private computeMetrics(records: ReadonlyArray<CorrectionRecord>): CorrectionMetrics {
    const total = records.length;
    if (total === 0) {
      return {
        totalDecisions: 0,
        approvalCount: 0,
        rejectionCount: 0,
        reassignCount: 0,
        acceptanceRate: 0,
        rejectionRate: 0,
        reassignRate: 0,
      };
    }

    let approvalCount = 0;
    let rejectionCount = 0;
    let reassignCount = 0;

    for (const r of records) {
      switch (r.humanDecision) {
        case 'approve':
          approvalCount++;
          break;
        case 'reject':
          rejectionCount++;
          break;
        case 'reassign':
          reassignCount++;
          break;
      }
    }

    return {
      totalDecisions: total,
      approvalCount,
      rejectionCount,
      reassignCount,
      acceptanceRate: approvalCount / total,
      rejectionRate: rejectionCount / total,
      reassignRate: reassignCount / total,
    };
  }
}
