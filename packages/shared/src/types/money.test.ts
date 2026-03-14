import { describe, it, expect } from 'vitest';
import { makeMoney, fromBaht } from './money.js';

/**
 * Unit tests for the Money value object.
 * Verifies bigint-based satang arithmetic (AR18).
 */
describe('makeMoney', () => {
  it('creates a Money value with the given satang amount and THB currency', () => {
    const money = makeMoney(500n);
    expect(money.amount).toBe(500n);
    expect(money.currency).toBe('THB');
  });

  it('creates a zero-value Money when amount is 0n', () => {
    const money = makeMoney(0n);
    expect(money.amount).toBe(0n);
    expect(money.currency).toBe('THB');
  });

  it('creates a Money value for large amounts without precision loss', () => {
    // 1,000,000 baht = 100,000,000 satang
    const money = makeMoney(100_000_000n);
    expect(money.amount).toBe(100_000_000n);
  });
});

describe('fromBaht', () => {
  it('converts whole baht to satang (100 satang per baht)', () => {
    const money = fromBaht(1n);
    expect(money.amount).toBe(100n);
    expect(money.currency).toBe('THB');
  });

  it('combines baht and satang correctly', () => {
    // ฿10.50
    const money = fromBaht(10n, 50n);
    expect(money.amount).toBe(1050n);
  });

  it('defaults satang to 0 when not provided', () => {
    const money = fromBaht(5n);
    expect(money.amount).toBe(500n);
  });

  it('handles zero baht and zero satang', () => {
    const money = fromBaht(0n, 0n);
    expect(money.amount).toBe(0n);
  });

  it('handles large baht values without precision loss', () => {
    // ฿1,000,000.99
    const money = fromBaht(1_000_000n, 99n);
    expect(money.amount).toBe(100_000_099n);
  });
});
