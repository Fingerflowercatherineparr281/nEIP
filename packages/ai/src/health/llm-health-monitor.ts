/**
 * LLM Health Monitor — Story 5.6.
 *
 * Monitors LLM API availability and API key validity.
 * Exposes a tri-state status: healthy, degraded, unavailable.
 *
 * The monitor is designed to be polled periodically (e.g. from a health
 * check endpoint or cron timer). It does not start its own timer —
 * the caller controls the check interval.
 *
 * Architecture references: AR11, FR62-FR64
 * Story: 5.6
 */

// ---------------------------------------------------------------------------
// Ambient timer globals — same pattern as base-agent.ts
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function setTimeout(callback: () => void, ms: number): any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function clearTimeout(id: any): void;

import type { LlmClient } from '../types/agent-types.js';

// ---------------------------------------------------------------------------
// Status types
// ---------------------------------------------------------------------------

/** Tri-state LLM service status */
export type LlmServiceStatus = 'healthy' | 'degraded' | 'unavailable';

/** Detailed health check result */
export interface LlmHealthReport {
  /** Overall status */
  readonly status: LlmServiceStatus;
  /** Whether the LLM client is configured (API key present) */
  readonly isConfigured: boolean;
  /** Whether the last health check ping succeeded */
  readonly lastPingSucceeded: boolean;
  /** Error message from last failed ping, if any */
  readonly lastError: string | null;
  /** ISO 8601 timestamp of last successful health check */
  readonly lastHealthyAt: string | null;
  /** ISO 8601 timestamp of last health check attempt */
  readonly lastCheckedAt: string | null;
  /** Number of consecutive failed health checks */
  readonly consecutiveFailures: number;
  /** Provider and model info */
  readonly provider: string;
  readonly model: string;
}

/** Configuration for the health monitor */
export interface LlmHealthMonitorConfig {
  /**
   * Number of consecutive failures before status transitions
   * from 'degraded' to 'unavailable'.
   * @default 3
   */
  readonly failureThreshold?: number | undefined;
  /**
   * Timeout in ms for the health check ping.
   * @default 5000
   */
  readonly pingTimeoutMs?: number | undefined;
}

// ---------------------------------------------------------------------------
// Health check function type
// ---------------------------------------------------------------------------

/**
 * A function that tests LLM connectivity.
 * Returns true if the LLM is reachable, false otherwise.
 * Should be lightweight (minimal token usage).
 */
export type HealthCheckFn = () => Promise<boolean>;

// ---------------------------------------------------------------------------
// Default health check — tries a minimal completion
// ---------------------------------------------------------------------------

/**
 * Creates a default health check function that sends a minimal prompt
 * to the LLM to verify connectivity.
 */
export function createDefaultHealthCheck(client: LlmClient): HealthCheckFn {
  return async () => {
    if (!client.isConfigured) return false;
    try {
      await client.complete(
        [{ role: 'user', content: 'ping' }],
        { maxTokens: 1 },
      );
      return true;
    } catch {
      return false;
    }
  };
}

// ---------------------------------------------------------------------------
// LlmHealthMonitor
// ---------------------------------------------------------------------------

/**
 * Monitors LLM API health and exposes status for the /api/health endpoint.
 *
 * Usage:
 *   const monitor = new LlmHealthMonitor(llmClient);
 *   await monitor.check();
 *   const report = monitor.getReport();
 */
export class LlmHealthMonitor {
  private readonly client: LlmClient;
  private readonly healthCheckFn: HealthCheckFn;
  private readonly failureThreshold: number;
  private readonly pingTimeoutMs: number;

  private _lastPingSucceeded = false;
  private _lastError: string | null = null;
  private _lastHealthyAt: string | null = null;
  private _lastCheckedAt: string | null = null;
  private _consecutiveFailures = 0;

  constructor(
    client: LlmClient,
    config?: LlmHealthMonitorConfig,
    healthCheckFn?: HealthCheckFn,
  ) {
    this.client = client;
    this.failureThreshold = config?.failureThreshold ?? 3;
    this.pingTimeoutMs = config?.pingTimeoutMs ?? 5000;
    this.healthCheckFn = healthCheckFn ?? createDefaultHealthCheck(client);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Perform a health check ping against the LLM API.
   * Updates internal state with the result.
   */
  async check(): Promise<LlmHealthReport> {
    this._lastCheckedAt = new Date().toISOString();

    if (!this.client.isConfigured) {
      this._lastPingSucceeded = false;
      this._lastError = 'LLM client is not configured — no API key present.';
      this._consecutiveFailures++;
      return this.getReport();
    }

    try {
      const succeeded = await this.withTimeout(
        this.healthCheckFn(),
        this.pingTimeoutMs,
      );

      if (succeeded) {
        this._lastPingSucceeded = true;
        this._lastError = null;
        this._lastHealthyAt = new Date().toISOString();
        this._consecutiveFailures = 0;
      } else {
        this._lastPingSucceeded = false;
        this._lastError = 'Health check ping returned false.';
        this._consecutiveFailures++;
      }
    } catch (err) {
      this._lastPingSucceeded = false;
      this._lastError = err instanceof Error ? err.message : String(err);
      this._consecutiveFailures++;
    }

    return this.getReport();
  }

  /**
   * Get the current health report without performing a new check.
   */
  getReport(): LlmHealthReport {
    return {
      status: this.deriveStatus(),
      isConfigured: this.client.isConfigured,
      lastPingSucceeded: this._lastPingSucceeded,
      lastError: this._lastError,
      lastHealthyAt: this._lastHealthyAt,
      lastCheckedAt: this._lastCheckedAt,
      consecutiveFailures: this._consecutiveFailures,
      provider: this.client.provider,
      model: this.client.model,
    };
  }

  /**
   * Reset internal state (useful for testing or after reconfiguration).
   */
  reset(): void {
    this._lastPingSucceeded = false;
    this._lastError = null;
    this._lastHealthyAt = null;
    this._lastCheckedAt = null;
    this._consecutiveFailures = 0;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private deriveStatus(): LlmServiceStatus {
    if (!this.client.isConfigured) return 'unavailable';
    if (this._lastPingSucceeded) return 'healthy';
    if (this._consecutiveFailures >= this.failureThreshold) return 'unavailable';
    return 'degraded';
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }
}
