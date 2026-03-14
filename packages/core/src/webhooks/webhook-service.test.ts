/**
 * Tests for WebhookService — Story 13.1.
 *
 * Strategy: unit tests for HMAC signature computation/verification
 * and delivery retry logic using a mock fetch.
 */

import { describe, it, expect } from 'vitest';
import {
  computeSignature,
  verifySignature,
  MAX_DELIVERY_ATTEMPTS,
} from './webhook-service.js';

// ---------------------------------------------------------------------------
// HMAC Signature Tests
// ---------------------------------------------------------------------------

describe('computeSignature', () => {
  it('should produce a deterministic sha256-prefixed signature', () => {
    // Given
    const secret = 'test-secret-key-1234567890';
    const timestamp = '1700000000';
    const body = '{"type":"JournalEntryCreated","id":"evt-1"}';

    // When
    const sig1 = computeSignature(secret, timestamp, body);
    const sig2 = computeSignature(secret, timestamp, body);

    // Then
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('should produce different signatures for different secrets', () => {
    const timestamp = '1700000000';
    const body = '{"type":"test"}';

    const sig1 = computeSignature('secret-a', timestamp, body);
    const sig2 = computeSignature('secret-b', timestamp, body);

    expect(sig1).not.toBe(sig2);
  });

  it('should produce different signatures for different timestamps', () => {
    const secret = 'shared-secret';
    const body = '{"type":"test"}';

    const sig1 = computeSignature(secret, '1700000000', body);
    const sig2 = computeSignature(secret, '1700000001', body);

    expect(sig1).not.toBe(sig2);
  });

  it('should produce different signatures for different bodies', () => {
    const secret = 'shared-secret';
    const timestamp = '1700000000';

    const sig1 = computeSignature(secret, timestamp, '{"a":1}');
    const sig2 = computeSignature(secret, timestamp, '{"a":2}');

    expect(sig1).not.toBe(sig2);
  });
});

describe('verifySignature', () => {
  it('should return true for a valid signature', () => {
    const secret = 'test-secret-key-1234567890';
    const timestamp = '1700000000';
    const body = '{"type":"JournalEntryCreated"}';

    const signature = computeSignature(secret, timestamp, body);
    const valid = verifySignature(secret, timestamp, body, signature);

    expect(valid).toBe(true);
  });

  it('should return false for an invalid signature', () => {
    const secret = 'test-secret-key-1234567890';
    const timestamp = '1700000000';
    const body = '{"type":"JournalEntryCreated"}';

    const valid = verifySignature(secret, timestamp, body, 'sha256=invalid');

    expect(valid).toBe(false);
  });

  it('should return false when tampered body is used', () => {
    const secret = 'test-secret-key-1234567890';
    const timestamp = '1700000000';
    const originalBody = '{"type":"JournalEntryCreated"}';
    const tamperedBody = '{"type":"JournalEntryDeleted"}';

    const signature = computeSignature(secret, timestamp, originalBody);
    const valid = verifySignature(secret, timestamp, tamperedBody, signature);

    expect(valid).toBe(false);
  });

  it('should return false for wrong secret', () => {
    const timestamp = '1700000000';
    const body = '{"type":"test"}';

    const signature = computeSignature('correct-secret', timestamp, body);
    const valid = verifySignature('wrong-secret', timestamp, body, signature);

    expect(valid).toBe(false);
  });

  it('should return false for length mismatch', () => {
    const valid = verifySignature('secret', '123', 'body', 'short');
    expect(valid).toBe(false);
  });
});

describe('MAX_DELIVERY_ATTEMPTS', () => {
  it('should be 5', () => {
    expect(MAX_DELIVERY_ATTEMPTS).toBe(5);
  });
});
