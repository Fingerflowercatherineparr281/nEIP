/**
 * Tests for Money Value Object (Story 2.1)
 * Architecture reference: AR18, AR25, AR28
 */

import { describe, it, expect } from 'vitest';
import { Money } from './money.js';

// ---------------------------------------------------------------------------
// Factory: fromSatang
// ---------------------------------------------------------------------------
describe('Money.fromSatang', () => {
  it('creates a Money instance with the exact satang amount', () => {
    const m = Money.fromSatang(500n);
    expect(m.amount).toBe(500n);
    expect(m.currency).toBe('THB');
  });

  it('creates a zero Money instance', () => {
    const m = Money.fromSatang(0n);
    expect(m.amount).toBe(0n);
  });

  it('creates a negative Money instance', () => {
    const m = Money.fromSatang(-875000n);
    expect(m.amount).toBe(-875000n);
  });

  it('handles very large amounts without precision loss', () => {
    // ฿999,999,999.99 = 99_999_999_999n satang
    const m = Money.fromSatang(99_999_999_999n);
    expect(m.amount).toBe(99_999_999_999n);
  });
});

// ---------------------------------------------------------------------------
// Factory: fromBaht
// ---------------------------------------------------------------------------
describe('Money.fromBaht', () => {
  it('converts whole baht to satang', () => {
    const m = Money.fromBaht(50000);
    expect(m.amount).toBe(5_000_000n);
  });

  it('converts fractional baht to satang', () => {
    const m = Money.fromBaht(8750.75);
    expect(m.amount).toBe(875075n);
  });

  it('handles zero', () => {
    const m = Money.fromBaht(0);
    expect(m.amount).toBe(0n);
  });

  it('handles negative baht', () => {
    const m = Money.fromBaht(-8750);
    expect(m.amount).toBe(-875000n);
  });

  it('handles negative fractional baht', () => {
    const m = Money.fromBaht(-8750.75);
    expect(m.amount).toBe(-875075n);
  });

  it('handles very large baht amount', () => {
    // ฿999,999,999.99
    const m = Money.fromBaht(999_999_999.99);
    expect(m.amount).toBe(99_999_999_999n);
  });

  it('throws for non-finite input (Infinity)', () => {
    expect(() => Money.fromBaht(Infinity)).toThrow(RangeError);
  });

  it('throws for non-finite input (NaN)', () => {
    expect(() => Money.fromBaht(NaN)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Arithmetic: add
// ---------------------------------------------------------------------------
describe('Money#add', () => {
  it('adds two positive amounts', () => {
    const a = Money.fromSatang(10000n); // ฿100
    const b = Money.fromSatang(5000n);  // ฿50
    expect(a.add(b).amount).toBe(15000n);
  });

  it('adds a positive and a negative amount', () => {
    const a = Money.fromSatang(10000n);
    const b = Money.fromSatang(-3000n);
    expect(a.add(b).amount).toBe(7000n);
  });

  it('adds two zero amounts', () => {
    const zero = Money.fromSatang(0n);
    expect(zero.add(zero).amount).toBe(0n);
  });

  it('is immutable — original instances are unchanged', () => {
    const a = Money.fromSatang(10000n);
    const b = Money.fromSatang(5000n);
    const c = a.add(b);
    expect(a.amount).toBe(10000n);
    expect(b.amount).toBe(5000n);
    expect(c.amount).toBe(15000n);
  });
});

// ---------------------------------------------------------------------------
// Arithmetic: subtract
// ---------------------------------------------------------------------------
describe('Money#subtract', () => {
  it('subtracts a smaller from a larger amount', () => {
    const a = Money.fromSatang(10000n);
    const b = Money.fromSatang(3000n);
    expect(a.subtract(b).amount).toBe(7000n);
  });

  it('produces a negative result when subtracting larger from smaller', () => {
    const a = Money.fromSatang(3000n);
    const b = Money.fromSatang(10000n);
    expect(a.subtract(b).amount).toBe(-7000n);
  });

  it('is immutable — original instances are unchanged', () => {
    const a = Money.fromSatang(10000n);
    const b = Money.fromSatang(3000n);
    a.subtract(b);
    expect(a.amount).toBe(10000n);
    expect(b.amount).toBe(3000n);
  });
});

// ---------------------------------------------------------------------------
// Arithmetic: multiply (Thai tax round-half-up)
// ---------------------------------------------------------------------------
describe('Money#multiply', () => {
  it('multiplies by a whole-number factor', () => {
    const m = Money.fromBaht(100);
    expect(m.multiply(3).amount).toBe(30000n); // ฿300
  });

  it('multiplies by a fractional factor', () => {
    // ฿100 × 0.07 = ฿7.00 (700 satang)
    const m = Money.fromBaht(100);
    expect(m.multiply(0.07).amount).toBe(700n);
  });

  it('rounds half-up: 150 satang × 0.07 = 11 satang (฿0.11)', () => {
    // 150 × 0.07 = 10.5 satang → round half-up → 11 satang
    const m = Money.fromSatang(150n);
    expect(m.multiply(0.07).amount).toBe(11n);
  });

  it('rounds half-up for repeating decimals: ฿1 × 1/3', () => {
    // 100 satang × (1/3) ≈ 33.333... → round → 33 satang
    const m = Money.fromSatang(100n);
    const result = m.multiply(1 / 3);
    expect(result.amount).toBe(33n);
  });

  it('handles multiplication by zero', () => {
    const m = Money.fromBaht(5000);
    expect(m.multiply(0).amount).toBe(0n);
  });

  it('handles multiplication by negative factor', () => {
    const m = Money.fromBaht(100);
    expect(m.multiply(-1).amount).toBe(-10000n);
  });

  it('handles multiplication of negative money by positive factor', () => {
    const m = Money.fromSatang(-10000n);
    expect(m.multiply(0.07).amount).toBe(-700n);
  });

  it('handles VAT calculation: ฿50,000 × 7% = ฿3,500', () => {
    const m = Money.fromBaht(50000);
    expect(m.multiply(0.07).amount).toBe(350000n); // 350000 satang = ฿3,500
  });

  it('is immutable', () => {
    const m = Money.fromSatang(15000n);
    m.multiply(2);
    expect(m.amount).toBe(15000n);
  });

  it('throws for Infinity factor', () => {
    const m = Money.fromSatang(100n);
    expect(() => m.multiply(Infinity)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Arithmetic: negate
// ---------------------------------------------------------------------------
describe('Money#negate', () => {
  it('negates a positive amount', () => {
    const m = Money.fromSatang(10000n);
    expect(m.negate().amount).toBe(-10000n);
  });

  it('negates a negative amount to positive', () => {
    const m = Money.fromSatang(-10000n);
    expect(m.negate().amount).toBe(10000n);
  });

  it('negates zero to zero', () => {
    const m = Money.fromSatang(0n);
    expect(m.negate().amount).toBe(0n);
  });

  it('is immutable', () => {
    const m = Money.fromSatang(10000n);
    m.negate();
    expect(m.amount).toBe(10000n);
  });
});

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------
describe('Money#allocate', () => {
  it('allocates ฿100 into 3 parts with remainder to first bucket', () => {
    // 100 × 100 satang = 10000 satang ÷ 3 = 3333 remainder 1
    // → [3334, 3333, 3333]
    const m = Money.fromBaht(100);
    const parts = m.allocate(3);
    expect(parts.length).toBe(3);
    expect(parts[0]?.amount).toBe(3334n); // ฿33.34
    expect(parts[1]?.amount).toBe(3333n); // ฿33.33
    expect(parts[2]?.amount).toBe(3333n); // ฿33.33
  });

  it('sum of allocated parts equals the original', () => {
    const m = Money.fromBaht(100);
    const parts = m.allocate(3);
    const total = parts.reduce((acc, p) => acc.add(p), Money.fromSatang(0n));
    expect(total.amount).toBe(m.amount);
  });

  it('allocates evenly divisible amount', () => {
    const m = Money.fromBaht(90);
    const parts = m.allocate(3);
    parts.forEach(p => expect(p.amount).toBe(3000n));
  });

  it('allocates into 1 part — returns same amount', () => {
    const m = Money.fromBaht(75);
    const parts = m.allocate(1);
    expect(parts.length).toBe(1);
    expect(parts[0]?.amount).toBe(m.amount);
  });

  it('allocates ฿1 into 3 parts: [34, 33, 33] satang', () => {
    // 100 satang ÷ 3 = 33 remainder 1 → [34, 33, 33]
    const m = Money.fromBaht(1);
    const parts = m.allocate(3);
    expect(parts[0]?.amount).toBe(34n);
    expect(parts[1]?.amount).toBe(33n);
    expect(parts[2]?.amount).toBe(33n);
  });

  it('allocates ฿10 into 4 parts with no remainder', () => {
    // 1000 satang ÷ 4 = 250 each
    const m = Money.fromBaht(10);
    const parts = m.allocate(4);
    parts.forEach(p => expect(p.amount).toBe(250n));
  });

  it('allocates zero into multiple parts', () => {
    const m = Money.fromSatang(0n);
    const parts = m.allocate(3);
    parts.forEach(p => expect(p.amount).toBe(0n));
  });

  it('allocates negative amount distributing remainder to first buckets', () => {
    // -100 satang ÷ 3 = -33 remainder -1 → [-34, -33, -33]
    const m = Money.fromSatang(-100n);
    const parts = m.allocate(3);
    expect(parts[0]?.amount).toBe(-34n);
    expect(parts[1]?.amount).toBe(-33n);
    expect(parts[2]?.amount).toBe(-33n);
    const total = parts.reduce((acc, p) => acc.add(p), Money.fromSatang(0n));
    expect(total.amount).toBe(-100n);
  });

  it('throws for non-integer parts', () => {
    const m = Money.fromBaht(100);
    expect(() => m.allocate(1.5)).toThrow(RangeError);
  });

  it('throws for zero parts', () => {
    const m = Money.fromBaht(100);
    expect(() => m.allocate(0)).toThrow(RangeError);
  });

  it('throws for negative parts', () => {
    const m = Money.fromBaht(100);
    expect(() => m.allocate(-3)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Formatting: format
// ---------------------------------------------------------------------------
describe('Money#format', () => {
  it('formats zero as ฿0.00', () => {
    expect(Money.fromSatang(0n).format()).toBe('฿0.00');
  });

  it('formats ฿50,000.00', () => {
    expect(Money.fromBaht(50000).format()).toBe('฿50,000.00');
  });

  it('formats a fractional amount ฿8,750.75', () => {
    expect(Money.fromBaht(8750.75).format()).toBe('฿8,750.75');
  });

  it('formats negative as -฿8,750.00', () => {
    expect(Money.fromBaht(-8750).format()).toBe('-฿8,750.00');
  });

  it('formats a large amount with commas ฿999,999,999.99', () => {
    expect(Money.fromSatang(99_999_999_999n).format()).toBe('฿999,999,999.99');
  });

  it('formats amounts under ฿1,000 without commas', () => {
    expect(Money.fromBaht(999.99).format()).toBe('฿999.99');
  });

  it('formats exactly ฿1,000.00', () => {
    expect(Money.fromBaht(1000).format()).toBe('฿1,000.00');
  });

  it('formats satang-only amount ฿0.01', () => {
    expect(Money.fromSatang(1n).format()).toBe('฿0.01');
  });

  it('formats satang-only negative amount -฿0.01', () => {
    expect(Money.fromSatang(-1n).format()).toBe('-฿0.01');
  });
});

// ---------------------------------------------------------------------------
// Formatting: formatAccounting
// ---------------------------------------------------------------------------
describe('Money#formatAccounting', () => {
  it('formats positive as ฿50,000.00', () => {
    expect(Money.fromBaht(50000).formatAccounting()).toBe('฿50,000.00');
  });

  it('formats negative as (฿8,750.00)', () => {
    expect(Money.fromBaht(-8750).formatAccounting()).toBe('(฿8,750.00)');
  });

  it('formats zero as ฿0.00', () => {
    expect(Money.fromSatang(0n).formatAccounting()).toBe('฿0.00');
  });

  it('formats negative fractional as (฿8,750.75)', () => {
    expect(Money.fromBaht(-8750.75).formatAccounting()).toBe('(฿8,750.75)');
  });
});

// ---------------------------------------------------------------------------
// Comparisons
// ---------------------------------------------------------------------------
describe('Money comparisons', () => {
  describe('isZero', () => {
    it('returns true for zero', () => {
      expect(Money.fromSatang(0n).isZero()).toBe(true);
    });

    it('returns false for positive', () => {
      expect(Money.fromSatang(1n).isZero()).toBe(false);
    });

    it('returns false for negative', () => {
      expect(Money.fromSatang(-1n).isZero()).toBe(false);
    });
  });

  describe('isPositive', () => {
    it('returns true for positive amount', () => {
      expect(Money.fromSatang(100n).isPositive()).toBe(true);
    });

    it('returns false for zero', () => {
      expect(Money.fromSatang(0n).isPositive()).toBe(false);
    });

    it('returns false for negative', () => {
      expect(Money.fromSatang(-100n).isPositive()).toBe(false);
    });
  });

  describe('isNegative', () => {
    it('returns true for negative amount', () => {
      expect(Money.fromSatang(-100n).isNegative()).toBe(true);
    });

    it('returns false for zero', () => {
      expect(Money.fromSatang(0n).isNegative()).toBe(false);
    });

    it('returns false for positive', () => {
      expect(Money.fromSatang(100n).isNegative()).toBe(false);
    });
  });

  describe('equals', () => {
    it('returns true for equal amounts', () => {
      const a = Money.fromSatang(10000n);
      const b = Money.fromSatang(10000n);
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different amounts', () => {
      const a = Money.fromSatang(10000n);
      const b = Money.fromSatang(9999n);
      expect(a.equals(b)).toBe(false);
    });

    it('returns true for two zero values', () => {
      expect(Money.fromSatang(0n).equals(Money.fromSatang(0n))).toBe(true);
    });
  });

  describe('greaterThan', () => {
    it('returns true when this > other', () => {
      const a = Money.fromSatang(10000n);
      const b = Money.fromSatang(9999n);
      expect(a.greaterThan(b)).toBe(true);
    });

    it('returns false when this < other', () => {
      const a = Money.fromSatang(9999n);
      const b = Money.fromSatang(10000n);
      expect(a.greaterThan(b)).toBe(false);
    });

    it('returns false when equal', () => {
      const a = Money.fromSatang(10000n);
      const b = Money.fromSatang(10000n);
      expect(a.greaterThan(b)).toBe(false);
    });
  });

  describe('lessThan', () => {
    it('returns true when this < other', () => {
      const a = Money.fromSatang(9999n);
      const b = Money.fromSatang(10000n);
      expect(a.lessThan(b)).toBe(true);
    });

    it('returns false when this > other', () => {
      const a = Money.fromSatang(10000n);
      const b = Money.fromSatang(9999n);
      expect(a.lessThan(b)).toBe(false);
    });

    it('returns false when equal', () => {
      const a = Money.fromSatang(10000n);
      expect(a.lessThan(a)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('large amount: ฿999,999,999.99 arithmetic precision', () => {
    const a = Money.fromSatang(99_999_999_999n);
    const b = Money.fromSatang(1n);
    expect(a.add(b).amount).toBe(100_000_000_000n);
  });

  it('chained operations remain immutable', () => {
    const base = Money.fromBaht(100);
    const result = base
      .add(Money.fromBaht(50))
      .subtract(Money.fromBaht(25))
      .multiply(2);
    expect(base.amount).toBe(10000n); // unchanged
    expect(result.amount).toBe(25000n); // (100 + 50 - 25) × 2 = 250 baht
  });

  it('add and negate cancel out to zero', () => {
    const m = Money.fromBaht(12345.67);
    expect(m.add(m.negate()).isZero()).toBe(true);
  });

  it('fromBaht and fromSatang are consistent', () => {
    const a = Money.fromBaht(100);
    const b = Money.fromSatang(10000n);
    expect(a.equals(b)).toBe(true);
  });

  it('currency is always THB', () => {
    expect(Money.fromSatang(0n).currency).toBe('THB');
    expect(Money.fromBaht(100).currency).toBe('THB');
    expect(Money.fromBaht(100).add(Money.fromBaht(50)).currency).toBe('THB');
    expect(Money.fromBaht(100).multiply(1.07).currency).toBe('THB');
    expect(Money.fromBaht(100).negate().currency).toBe('THB');
  });
});
