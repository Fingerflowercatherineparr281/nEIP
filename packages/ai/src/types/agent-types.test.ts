/**
 * Unit tests for agent type helpers.
 *
 * Covers:
 *   - ConfidenceScore branded type / validation
 *   - ConfidenceZone classification (all 5 zones + boundaries)
 *   - isAgentSuccess / isAgentFailure type guards
 *
 * Story: 5.2
 */

import { describe, expect, it } from 'vitest';
import { ValidationError } from '@neip/shared';

import {
  ConfidenceZone,
  classifyConfidence,
  isAgentFailure,
  isAgentSuccess,
  toConfidenceScore,
} from './agent-types.js';
import type { AgentFailure, AgentResult, AgentSuccess } from './agent-types.js';

// ---------------------------------------------------------------------------
// toConfidenceScore
// ---------------------------------------------------------------------------

describe('toConfidenceScore', () => {
  it('accepts valid scores within [0, 1]', () => {
    expect(() => toConfidenceScore(0)).not.toThrow();
    expect(() => toConfidenceScore(0.5)).not.toThrow();
    expect(() => toConfidenceScore(1)).not.toThrow();
  });

  it('throws RangeError for values below 0', () => {
    expect(() => toConfidenceScore(-0.01)).toThrow(RangeError);
  });

  it('throws RangeError for values above 1', () => {
    expect(() => toConfidenceScore(1.01)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// classifyConfidence — all 5 zones
// ---------------------------------------------------------------------------

describe('classifyConfidence', () => {
  it('returns AUTO for score >= 0.9', () => {
    expect(classifyConfidence(toConfidenceScore(0.9))).toBe(ConfidenceZone.AUTO);
    expect(classifyConfidence(toConfidenceScore(1.0))).toBe(ConfidenceZone.AUTO);
    expect(classifyConfidence(toConfidenceScore(0.95))).toBe(ConfidenceZone.AUTO);
  });

  it('returns SUGGEST for score in [0.75, 0.90)', () => {
    expect(classifyConfidence(toConfidenceScore(0.75))).toBe(ConfidenceZone.SUGGEST);
    expect(classifyConfidence(toConfidenceScore(0.85))).toBe(ConfidenceZone.SUGGEST);
    expect(classifyConfidence(toConfidenceScore(0.899))).toBe(ConfidenceZone.SUGGEST);
  });

  it('returns REVIEW for score in [0.50, 0.75)', () => {
    expect(classifyConfidence(toConfidenceScore(0.5))).toBe(ConfidenceZone.REVIEW);
    expect(classifyConfidence(toConfidenceScore(0.6))).toBe(ConfidenceZone.REVIEW);
    expect(classifyConfidence(toConfidenceScore(0.749))).toBe(ConfidenceZone.REVIEW);
  });

  it('returns MANUAL for score in [0.10, 0.50)', () => {
    expect(classifyConfidence(toConfidenceScore(0.1))).toBe(ConfidenceZone.MANUAL);
    expect(classifyConfidence(toConfidenceScore(0.3))).toBe(ConfidenceZone.MANUAL);
    expect(classifyConfidence(toConfidenceScore(0.499))).toBe(ConfidenceZone.MANUAL);
  });

  it('returns BLOCKED for score < 0.10', () => {
    expect(classifyConfidence(toConfidenceScore(0.0))).toBe(ConfidenceZone.BLOCKED);
    expect(classifyConfidence(toConfidenceScore(0.05))).toBe(ConfidenceZone.BLOCKED);
    expect(classifyConfidence(toConfidenceScore(0.099))).toBe(ConfidenceZone.BLOCKED);
  });

  it('has exactly 5 zone values', () => {
    const zones = Object.values(ConfidenceZone);
    expect(zones).toHaveLength(5);
    expect(zones).toContain('AUTO');
    expect(zones).toContain('SUGGEST');
    expect(zones).toContain('REVIEW');
    expect(zones).toContain('MANUAL');
    expect(zones).toContain('BLOCKED');
  });
});

// ---------------------------------------------------------------------------
// isAgentSuccess / isAgentFailure
// ---------------------------------------------------------------------------

describe('isAgentSuccess', () => {
  it('returns true for a successful result', () => {
    const result: AgentResult<string> = {
      success: true,
      data: 'hello',
      confidence: toConfidenceScore(0.95),
      zone: ConfidenceZone.AUTO,
      reasoning: ['step one'],
      durationMs: 42,
      completedAt: new Date().toISOString(),
    } satisfies AgentSuccess<string>;

    expect(isAgentSuccess(result)).toBe(true);
  });

  it('returns false for a failed result', () => {
    const result: AgentResult<string> = {
      success: false,
      error: new ValidationError({ detail: 'oops' }),
      confidence: toConfidenceScore(0),
      zone: ConfidenceZone.BLOCKED,
      reasoning: [],
      durationMs: 1,
      completedAt: new Date().toISOString(),
    } satisfies AgentFailure;

    expect(isAgentSuccess(result)).toBe(false);
  });
});

describe('isAgentFailure', () => {
  it('returns true for a failed result', () => {
    const result: AgentResult<number> = {
      success: false,
      error: new ValidationError({ detail: 'bad input' }),
      confidence: toConfidenceScore(0),
      zone: ConfidenceZone.BLOCKED,
      reasoning: ['pre-check failed'],
      durationMs: 5,
      completedAt: new Date().toISOString(),
    };

    expect(isAgentFailure(result)).toBe(true);
  });

  it('returns false for a successful result', () => {
    const result: AgentResult<number> = {
      success: true,
      data: 42,
      confidence: toConfidenceScore(0.8),
      zone: ConfidenceZone.SUGGEST,
      reasoning: ['computed value'],
      durationMs: 10,
      completedAt: new Date().toISOString(),
    };

    expect(isAgentFailure(result)).toBe(false);
  });
});
