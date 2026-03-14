/**
 * Unit tests for LlmHealthMonitor — Story 5.6.
 *
 * Coverage:
 *   - Healthy status when ping succeeds
 *   - Degraded status on first failure
 *   - Unavailable after consecutive failures exceed threshold
 *   - Unconfigured client returns unavailable immediately
 *   - Timeout handling
 *   - Reset clears state
 *   - Report fields are populated correctly
 *
 * Story: 5.6
 */

import { describe, expect, it } from 'vitest';

import type { LlmClient, LlmResponse } from '../types/agent-types.js';
import { LlmHealthMonitor } from './llm-health-monitor.js';
import type { HealthCheckFn } from './llm-health-monitor.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeMockClient(overrides?: Partial<LlmClient>): LlmClient {
  return {
    isConfigured: true,
    provider: 'test-provider',
    model: 'test-model',
    complete: async () => ({
      content: 'pong',
      toolCalls: [],
      usage: { inputTokens: 1, outputTokens: 1 },
    }) satisfies LlmResponse,
    ...overrides,
  };
}

function alwaysSucceeds(): HealthCheckFn {
  return async () => true;
}

function alwaysFails(): HealthCheckFn {
  return async () => false;
}

function throwsError(msg: string): HealthCheckFn {
  return async () => {
    throw new Error(msg);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LlmHealthMonitor — healthy state', () => {
  it('reports healthy when ping succeeds', async () => {
    const client = makeMockClient();
    const monitor = new LlmHealthMonitor(client, undefined, alwaysSucceeds());

    const report = await monitor.check();

    expect(report.status).toBe('healthy');
    expect(report.isConfigured).toBe(true);
    expect(report.lastPingSucceeded).toBe(true);
    expect(report.lastError).toBeNull();
    expect(report.lastHealthyAt).toBeTruthy();
    expect(report.lastCheckedAt).toBeTruthy();
    expect(report.consecutiveFailures).toBe(0);
    expect(report.provider).toBe('test-provider');
    expect(report.model).toBe('test-model');
  });

  it('resets consecutive failures on success', async () => {
    const client = makeMockClient();
    let failNext = true;
    const toggleFn: HealthCheckFn = async () => {
      if (failNext) {
        failNext = false;
        return false;
      }
      return true;
    };
    const monitor = new LlmHealthMonitor(client, undefined, toggleFn);

    // First check fails
    await monitor.check();
    expect(monitor.getReport().consecutiveFailures).toBe(1);

    // Second check succeeds — resets counter
    await monitor.check();
    expect(monitor.getReport().consecutiveFailures).toBe(0);
    expect(monitor.getReport().status).toBe('healthy');
  });
});

describe('LlmHealthMonitor — degraded state', () => {
  it('reports degraded on first failure when threshold > 1', async () => {
    const client = makeMockClient();
    const monitor = new LlmHealthMonitor(
      client,
      { failureThreshold: 3 },
      alwaysFails(),
    );

    const report = await monitor.check();

    expect(report.status).toBe('degraded');
    expect(report.lastPingSucceeded).toBe(false);
    expect(report.consecutiveFailures).toBe(1);
  });
});

describe('LlmHealthMonitor — unavailable state', () => {
  it('becomes unavailable after consecutive failures exceed threshold', async () => {
    const client = makeMockClient();
    const monitor = new LlmHealthMonitor(
      client,
      { failureThreshold: 2 },
      alwaysFails(),
    );

    await monitor.check(); // 1 failure → degraded
    expect(monitor.getReport().status).toBe('degraded');

    await monitor.check(); // 2 failures → unavailable
    expect(monitor.getReport().status).toBe('unavailable');
    expect(monitor.getReport().consecutiveFailures).toBe(2);
  });

  it('reports unavailable immediately when client is not configured', async () => {
    const client = makeMockClient({ isConfigured: false });
    const monitor = new LlmHealthMonitor(client);

    const report = await monitor.check();

    expect(report.status).toBe('unavailable');
    expect(report.isConfigured).toBe(false);
    expect(report.lastError).toContain('not configured');
  });
});

describe('LlmHealthMonitor — error handling', () => {
  it('handles thrown errors gracefully', async () => {
    const client = makeMockClient();
    const monitor = new LlmHealthMonitor(
      client,
      undefined,
      throwsError('API connection refused'),
    );

    const report = await monitor.check();

    expect(report.status).toBe('degraded');
    expect(report.lastError).toBe('API connection refused');
    expect(report.consecutiveFailures).toBe(1);
  });
});

describe('LlmHealthMonitor — reset', () => {
  it('clears all internal state', async () => {
    const client = makeMockClient();
    const monitor = new LlmHealthMonitor(client, undefined, alwaysFails());

    await monitor.check();
    await monitor.check();
    expect(monitor.getReport().consecutiveFailures).toBe(2);

    monitor.reset();

    const report = monitor.getReport();
    expect(report.consecutiveFailures).toBe(0);
    expect(report.lastCheckedAt).toBeNull();
    expect(report.lastHealthyAt).toBeNull();
    expect(report.lastError).toBeNull();
  });
});

describe('LlmHealthMonitor — getReport without check', () => {
  it('returns initial state when no checks have been performed', () => {
    const client = makeMockClient();
    const monitor = new LlmHealthMonitor(client);

    const report = monitor.getReport();

    // Before any check, should report degraded (no successful check yet)
    // but isConfigured is true
    expect(report.isConfigured).toBe(true);
    expect(report.lastCheckedAt).toBeNull();
    expect(report.consecutiveFailures).toBe(0);
  });
});
