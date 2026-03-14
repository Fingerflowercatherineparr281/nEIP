/**
 * Unit tests for DegradationHandler — Story 5.6.
 *
 * Coverage:
 *   - AI enabled/disabled based on LLM status
 *   - HITL queue accepting/blocked based on status
 *   - Pending jobs retryable when not healthy
 *   - Status messages for each state
 *   - API key expiry notification (FR64)
 *   - Degradation/recovery event logging
 *   - Health payload for /api/health endpoint
 *   - Manual operations always work (FR63)
 *
 * Story: 5.6
 */

import { describe, expect, it, beforeEach } from 'vitest';

import type { LlmHealthReport } from './llm-health-monitor.js';
import {
  DegradationHandler,
  InMemoryDegradationLogger,
} from './degradation-handler.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeReport(overrides?: Partial<LlmHealthReport>): LlmHealthReport {
  return {
    status: 'healthy',
    isConfigured: true,
    lastPingSucceeded: true,
    lastError: null,
    lastHealthyAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    consecutiveFailures: 0,
    provider: 'test',
    model: 'test-model',
    ...overrides,
  };
}

let logger: InMemoryDegradationLogger;
let handler: DegradationHandler;

beforeEach(() => {
  logger = new InMemoryDegradationLogger();
  handler = new DegradationHandler(logger);
});

// ---------------------------------------------------------------------------
// Healthy state
// ---------------------------------------------------------------------------

describe('DegradationHandler — healthy state', () => {
  it('enables AI features when LLM is healthy', () => {
    const status = handler.evaluate(makeReport({ status: 'healthy' }));

    expect(status.aiEnabled).toBe(true);
    expect(status.hitlQueueAccepting).toBe(true);
    expect(status.pendingJobsRetryable).toBe(false);
    expect(status.llmStatus).toBe('healthy');
    expect(status.statusMessage).toContain('fully operational');
  });
});

// ---------------------------------------------------------------------------
// Degraded state
// ---------------------------------------------------------------------------

describe('DegradationHandler — degraded state', () => {
  it('disables AI features but allows HITL queue', () => {
    const status = handler.evaluate(
      makeReport({
        status: 'degraded',
        lastPingSucceeded: false,
        consecutiveFailures: 2,
      }),
    );

    expect(status.aiEnabled).toBe(false);
    expect(status.hitlQueueAccepting).toBe(true);
    expect(status.pendingJobsRetryable).toBe(true);
    expect(status.statusMessage).toContain('intermittent');
    expect(status.statusMessage).toContain('Manual operations');
  });
});

// ---------------------------------------------------------------------------
// Unavailable state
// ---------------------------------------------------------------------------

describe('DegradationHandler — unavailable state', () => {
  it('disables AI features and blocks HITL queue from new items', () => {
    const status = handler.evaluate(
      makeReport({
        status: 'unavailable',
        isConfigured: true,
        lastPingSucceeded: false,
        lastError: 'Connection refused',
        consecutiveFailures: 5,
      }),
    );

    expect(status.aiEnabled).toBe(false);
    expect(status.hitlQueueAccepting).toBe(false);
    expect(status.pendingJobsRetryable).toBe(true);
    expect(status.statusMessage).toContain('temporarily unavailable');
    expect(status.statusMessage).toContain('manual operations');
  });

  it('shows unconfigured message when no API key', () => {
    const status = handler.evaluate(
      makeReport({
        status: 'unavailable',
        isConfigured: false,
        lastPingSucceeded: false,
        consecutiveFailures: 1,
      }),
    );

    expect(status.aiEnabled).toBe(false);
    expect(status.statusMessage).toContain('no LLM API key');
    expect(status.statusMessage).toContain('manual operations');
  });
});

// ---------------------------------------------------------------------------
// Degradation/recovery logging
// ---------------------------------------------------------------------------

describe('DegradationHandler — state transition logging', () => {
  it('logs degradation event on healthy → degraded transition', () => {
    // First call: healthy (sets _previousStatus)
    handler.evaluate(makeReport({ status: 'healthy' }));
    // Second call: degraded (triggers transition)
    handler.evaluate(
      makeReport({ status: 'degraded', consecutiveFailures: 1 }),
    );

    const degradationEvents = logger.events.filter((e) => e.type === 'degradation');
    expect(degradationEvents).toHaveLength(1);
    expect(degradationEvents[0]?.message).toContain('healthy');
    expect(degradationEvents[0]?.message).toContain('degraded');
  });

  it('logs degradation event on degraded → unavailable transition', () => {
    handler.evaluate(makeReport({ status: 'healthy' }));
    handler.evaluate(makeReport({ status: 'degraded', consecutiveFailures: 2 }));
    handler.evaluate(makeReport({ status: 'unavailable', consecutiveFailures: 5 }));

    const degradationEvents = logger.events.filter((e) => e.type === 'degradation');
    expect(degradationEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('logs recovery event on degraded → healthy transition', () => {
    handler.evaluate(makeReport({ status: 'healthy' }));
    handler.evaluate(makeReport({ status: 'degraded', consecutiveFailures: 1 }));
    handler.evaluate(makeReport({ status: 'healthy' }));

    const recoveryEvents = logger.events.filter((e) => e.type === 'recovery');
    expect(recoveryEvents).toHaveLength(1);
    expect(recoveryEvents[0]?.message).toContain('recovered');
  });

  it('does not log transition on first evaluation', () => {
    handler.evaluate(makeReport({ status: 'degraded' }));
    expect(logger.events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// API key expiry (FR64)
// ---------------------------------------------------------------------------

describe('DegradationHandler — API key expiry', () => {
  it('returns expiry notice when key expires within warning window', () => {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const handlerWithExpiry = new DegradationHandler(logger, {
      apiKeyExpiryDate: threeDaysFromNow.toISOString(),
      expiryWarningDays: 7,
    });

    const status = handlerWithExpiry.evaluate(makeReport());
    expect(status.apiKeyExpiryNotice).toContain('expires in');
    expect(status.apiKeyExpiryNotice).toContain('day');
  });

  it('returns expired notice when key has already expired', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const handlerWithExpiry = new DegradationHandler(logger, {
      apiKeyExpiryDate: yesterday.toISOString(),
    });

    const status = handlerWithExpiry.evaluate(makeReport());
    expect(status.apiKeyExpiryNotice).toContain('expired');
  });

  it('returns null when key expiry is far in the future', () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 365);

    const handlerWithExpiry = new DegradationHandler(logger, {
      apiKeyExpiryDate: farFuture.toISOString(),
    });

    const status = handlerWithExpiry.evaluate(makeReport());
    expect(status.apiKeyExpiryNotice).toBeNull();
  });

  it('returns null when no expiry date is configured', () => {
    const status = handler.evaluate(makeReport());
    expect(status.apiKeyExpiryNotice).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Convenience methods
// ---------------------------------------------------------------------------

describe('DegradationHandler — convenience methods', () => {
  it('isAiEnabled returns true only when healthy', () => {
    expect(handler.isAiEnabled(makeReport({ status: 'healthy' }))).toBe(true);
    expect(handler.isAiEnabled(makeReport({ status: 'degraded' }))).toBe(false);
    expect(handler.isAiEnabled(makeReport({ status: 'unavailable' }))).toBe(false);
  });

  it('isHitlQueueAccepting returns false only when unavailable', () => {
    expect(handler.isHitlQueueAccepting(makeReport({ status: 'healthy' }))).toBe(true);
    expect(handler.isHitlQueueAccepting(makeReport({ status: 'degraded' }))).toBe(true);
    expect(handler.isHitlQueueAccepting(makeReport({ status: 'unavailable' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Health payload
// ---------------------------------------------------------------------------

describe('DegradationHandler — health payload', () => {
  it('returns structured payload for /api/health endpoint', () => {
    const payload = handler.getHealthPayload(makeReport());

    expect(payload['llm']).toBeDefined();
    const llm = payload['llm'] as Record<string, unknown>;
    expect(llm['status']).toBe('healthy');
    expect(llm['aiEnabled']).toBe(true);
    expect(llm['provider']).toBe('test');
    expect(llm['model']).toBe('test-model');
  });
});
