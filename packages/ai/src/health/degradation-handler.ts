/**
 * Graceful Degradation Handler — Story 5.6.
 *
 * When the LLM is unavailable:
 *   - AI features are disabled (FR63: manual operations continue)
 *   - HITL queue stops receiving new items but existing items remain reviewable
 *   - Pending AI jobs are queued for retry when service returns (FR62)
 *   - API key expiry triggers a notification message (FR64)
 *   - Degradation and recovery events are logged
 *
 * The handler observes LlmHealthMonitor and provides a unified interface
 * for checking whether AI features should be enabled.
 *
 * Architecture references: AR11, FR62-FR64
 * Story: 5.6
 */

import type { LlmHealthReport, LlmServiceStatus } from './llm-health-monitor.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status message for API consumers / UI display */
export interface DegradationStatus {
  /** Whether AI features are currently enabled */
  readonly aiEnabled: boolean;
  /** Whether the HITL queue accepts new items */
  readonly hitlQueueAccepting: boolean;
  /** Whether pending AI jobs should be retried */
  readonly pendingJobsRetryable: boolean;
  /** Human-readable status message for display */
  readonly statusMessage: string;
  /** Overall LLM service status */
  readonly llmStatus: LlmServiceStatus;
  /** API key expiry notification (null if not applicable) */
  readonly apiKeyExpiryNotice: string | null;
}

/** Degradation event for logging/auditing */
export interface DegradationEvent {
  readonly type: 'degradation' | 'recovery' | 'api-key-expiry';
  readonly timestamp: string;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}

/** Logger interface for degradation events */
export interface DegradationLogger {
  logEvent(event: DegradationEvent): void;
}

/** Configuration for the degradation handler */
export interface DegradationHandlerConfig {
  /**
   * API key expiry date as ISO 8601 string.
   * When set, the handler will generate expiry notices as the date approaches.
   */
  readonly apiKeyExpiryDate?: string | undefined;
  /**
   * Number of days before API key expiry to start warning.
   * @default 7
   */
  readonly expiryWarningDays?: number | undefined;
}

// ---------------------------------------------------------------------------
// In-memory logger (for tests)
// ---------------------------------------------------------------------------

export class InMemoryDegradationLogger implements DegradationLogger {
  readonly events: DegradationEvent[] = [];

  logEvent(event: DegradationEvent): void {
    this.events.push(event);
  }
}

// ---------------------------------------------------------------------------
// DegradationHandler
// ---------------------------------------------------------------------------

/**
 * Manages graceful degradation when the LLM is unavailable.
 *
 * Consumers call `evaluate(report)` with the latest health report and
 * receive a DegradationStatus indicating which features are available.
 *
 * The handler also logs degradation/recovery transitions so ops can
 * track service reliability.
 */
export class DegradationHandler {
  private readonly logger: DegradationLogger;
  private readonly apiKeyExpiryDate: Date | null;
  private readonly expiryWarningDays: number;
  private _previousStatus: LlmServiceStatus | null = null;

  constructor(logger: DegradationLogger, config?: DegradationHandlerConfig) {
    this.logger = logger;
    this.expiryWarningDays = config?.expiryWarningDays ?? 7;

    if (config?.apiKeyExpiryDate !== undefined) {
      this.apiKeyExpiryDate = new Date(config.apiKeyExpiryDate);
    } else {
      this.apiKeyExpiryDate = null;
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Evaluate the current health report and return a degradation status.
   * Logs transitions between states (degradation and recovery events).
   */
  evaluate(report: LlmHealthReport): DegradationStatus {
    const currentStatus = report.status;

    // Detect state transitions and log them
    this.logTransition(currentStatus, report);
    this._previousStatus = currentStatus;

    const aiEnabled = currentStatus === 'healthy';
    const hitlQueueAccepting = currentStatus !== 'unavailable';
    const pendingJobsRetryable = currentStatus !== 'healthy';

    const statusMessage = this.buildStatusMessage(currentStatus, report);
    const apiKeyExpiryNotice = this.checkApiKeyExpiry();

    // Log API key expiry warning if approaching
    if (apiKeyExpiryNotice !== null && currentStatus !== 'unavailable') {
      this.logger.logEvent({
        type: 'api-key-expiry',
        timestamp: new Date().toISOString(),
        message: apiKeyExpiryNotice,
        details: {
          expiryDate: this.apiKeyExpiryDate?.toISOString() ?? null,
        },
      });
    }

    return {
      aiEnabled,
      hitlQueueAccepting,
      pendingJobsRetryable,
      statusMessage,
      llmStatus: currentStatus,
      apiKeyExpiryNotice,
    };
  }

  /**
   * Check whether AI features should be enabled based on the latest evaluation.
   * Convenience method for inline guards.
   */
  isAiEnabled(report: LlmHealthReport): boolean {
    return report.status === 'healthy';
  }

  /**
   * Check whether the HITL queue should accept new items.
   */
  isHitlQueueAccepting(report: LlmHealthReport): boolean {
    return report.status !== 'unavailable';
  }

  /**
   * Generate the health status payload for the /api/health endpoint.
   */
  getHealthPayload(report: LlmHealthReport): Readonly<Record<string, unknown>> {
    const status = this.evaluate(report);
    return {
      llm: {
        status: status.llmStatus,
        aiEnabled: status.aiEnabled,
        hitlQueueAccepting: status.hitlQueueAccepting,
        statusMessage: status.statusMessage,
        apiKeyExpiryNotice: status.apiKeyExpiryNotice,
        provider: report.provider,
        model: report.model,
        lastHealthyAt: report.lastHealthyAt,
        consecutiveFailures: report.consecutiveFailures,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private logTransition(
    currentStatus: LlmServiceStatus,
    report: LlmHealthReport,
  ): void {
    const prev = this._previousStatus;

    // No transition on first call
    if (prev === null) return;

    // Degradation: healthy → degraded or unavailable
    if (prev === 'healthy' && currentStatus !== 'healthy') {
      this.logger.logEvent({
        type: 'degradation',
        timestamp: new Date().toISOString(),
        message: `LLM service degraded: ${prev} → ${currentStatus}`,
        details: {
          previousStatus: prev,
          currentStatus,
          lastError: report.lastError,
          consecutiveFailures: report.consecutiveFailures,
        },
      });
    }

    // Further degradation: degraded → unavailable
    if (prev === 'degraded' && currentStatus === 'unavailable') {
      this.logger.logEvent({
        type: 'degradation',
        timestamp: new Date().toISOString(),
        message: `LLM service became unavailable after ${report.consecutiveFailures} consecutive failures`,
        details: {
          previousStatus: prev,
          currentStatus,
          lastError: report.lastError,
          consecutiveFailures: report.consecutiveFailures,
        },
      });
    }

    // Recovery: degraded/unavailable → healthy
    if (prev !== 'healthy' && currentStatus === 'healthy') {
      this.logger.logEvent({
        type: 'recovery',
        timestamp: new Date().toISOString(),
        message: `LLM service recovered: ${prev} → healthy`,
        details: {
          previousStatus: prev,
          currentStatus,
          lastHealthyAt: report.lastHealthyAt,
        },
      });
    }
  }

  private buildStatusMessage(
    status: LlmServiceStatus,
    report: LlmHealthReport,
  ): string {
    switch (status) {
      case 'healthy':
        return 'AI features are fully operational.';
      case 'degraded':
        return `AI features are experiencing intermittent issues. ${report.consecutiveFailures} consecutive check(s) failed. Manual operations continue normally.`;
      case 'unavailable':
        if (!report.isConfigured) {
          return 'AI features are disabled — no LLM API key configured. All manual operations continue working.';
        }
        return `AI features are temporarily unavailable. ${report.lastError ?? 'LLM service unreachable.'}. All manual operations continue working.`;
    }
  }

  private checkApiKeyExpiry(): string | null {
    if (this.apiKeyExpiryDate === null) return null;

    const now = new Date();
    const diffMs = this.apiKeyExpiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return 'LLM API key has expired. AI features will stop working until the key is renewed.';
    }

    if (diffDays <= this.expiryWarningDays) {
      return `LLM API key expires in ${diffDays} day${diffDays === 1 ? '' : 's'}. Please renew to avoid service disruption.`;
    }

    return null;
  }
}
