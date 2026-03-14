/**
 * Money Value Object — Thai Baht (THB) implementation.
 *
 * All amounts are stored as bigint in satang (สตางค์).
 * 100 satang = ฿1.00
 *
 * Architecture reference: AR18
 * Story: 2.1
 */

import type { Money as MoneyInterface } from '@neip/shared';

/**
 * Immutable Money value object for Thai Baht.
 *
 * Rules:
 * - Internal amount is always bigint in satang.
 * - Currency is always 'THB'.
 * - All arithmetic returns a new Money instance.
 * - Multiplication uses Thai tax round-half-up (กรมสรรพากร).
 */
export class Money implements MoneyInterface {
  readonly amount: bigint;
  readonly currency: 'THB' = 'THB';

  private constructor(amount: bigint) {
    this.amount = amount;
  }

  // ---------------------------------------------------------------------------
  // Static factories
  // ---------------------------------------------------------------------------

  /**
   * Create a Money instance from a satang amount.
   * This is the primary factory — no rounding required.
   */
  static fromSatang(amount: bigint): Money {
    return new Money(amount);
  }

  /**
   * Create a Money instance from a baht amount given as a number.
   *
   * The number must be a finite value with at most 2 decimal places.
   * Internally, the value is converted to satang using string parsing
   * to avoid any floating-point imprecision.
   *
   * @example Money.fromBaht(50000)    → ฿50,000.00
   * @example Money.fromBaht(8750.75)  → ฿8,750.75
   */
  static fromBaht(amount: number): Money {
    if (!Number.isFinite(amount)) {
      throw new RangeError(`Money.fromBaht: amount must be finite, got ${amount}`);
    }

    // Use string-based conversion to avoid floating-point drift.
    // Round to 2 decimal places using round-half-up before converting.
    const rounded = roundHalfUpNumber(amount);

    // Convert to string with exactly 2 decimal places.
    const str = rounded.toFixed(2);
    const [bahtStr, satangStr] = str.split('.');

    const bahtPart = BigInt(bahtStr ?? '0');
    const satangPart = BigInt(satangStr ?? '00');

    // Preserve sign for negative values: both parts carry the sign from bahtPart.
    if (amount < 0) {
      // toFixed(-8750.75) → "-8750.75" → bahtPart = -8750n, satangPart = 75n
      // We need: -(8750n * 100n + 75n) = -875075n
      const absAmount = bahtPart < 0n ? -bahtPart : bahtPart;
      return new Money(-(absAmount * 100n + satangPart));
    }

    return new Money(bahtPart * 100n + satangPart);
  }

  // ---------------------------------------------------------------------------
  // Arithmetic — all operations return new instances (immutability)
  // ---------------------------------------------------------------------------

  /** Add another Money value. */
  add(other: Money): Money {
    return new Money(this.amount + other.amount);
  }

  /** Subtract another Money value. */
  subtract(other: Money): Money {
    return new Money(this.amount - other.amount);
  }

  /**
   * Multiply by a numeric factor.
   *
   * Uses Thai tax round-half-up (กรมสรรพากร FR30):
   * Intermediate result is computed with sub-satang precision, then rounded
   * to the nearest satang using add-50-then-integer-divide.
   *
   * @example Money.fromSatang(150n).multiply(0.07) → 11n satang (฿0.11)
   */
  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new RangeError(`Money.multiply: factor must be finite, got ${factor}`);
    }

    // To avoid floating-point, we express the factor as a rational number
    // with enough decimal precision (up to 10 significant digits) and compute
    // entirely in bigint.
    //
    // Strategy: scale factor to an integer by multiplying by 10^SCALE_DIGITS,
    // do the bigint multiplication, then round-half-up back to satang.
    const SCALE_DIGITS = 10;
    const SCALE = 10n ** BigInt(SCALE_DIGITS);

    // Round the factor to SCALE_DIGITS decimal places to get an exact bigint.
    const factorScaled = BigInt(Math.round(factor * Number(SCALE)));

    // Raw result in (satang * SCALE) units.
    const rawProduct = this.amount * factorScaled;

    // Round-half-up to nearest satang.
    // For positive: add SCALE/2, divide by SCALE.
    // For negative: subtract SCALE/2, divide by SCALE.
    const half = SCALE / 2n;
    let satang: bigint;
    if (rawProduct >= 0n) {
      satang = (rawProduct + half) / SCALE;
    } else {
      satang = (rawProduct - half) / SCALE;
    }

    return new Money(satang);
  }

  /** Negate the value (returns a new Money with the sign flipped). */
  negate(): Money {
    return new Money(-this.amount);
  }

  // ---------------------------------------------------------------------------
  // Allocation
  // ---------------------------------------------------------------------------

  /**
   * Allocate this Money into `parts` equal shares, distributing any remainder
   * (due to indivisibility in satang) to the first buckets.
   *
   * @example Money.fromBaht(100).allocate(3)
   *          → [฿33.34, ฿33.33, ฿33.33]  (remainder 1 satang → first bucket)
   *
   * @param parts - Number of equal parts, must be a positive integer.
   */
  allocate(parts: number): Money[] {
    if (!Number.isInteger(parts) || parts <= 0) {
      throw new RangeError(`Money.allocate: parts must be a positive integer, got ${parts}`);
    }

    const n = BigInt(parts);
    const base = this.amount / n;
    const remainder = this.amount % n;

    // Distribute the remainder (one satang per bucket from the front).
    // Works correctly for both positive and negative amounts because bigint
    // division truncates toward zero and the remainder carries the right sign.
    return Array.from({ length: parts }, (_, i) => {
      const extra = BigInt(i) < (remainder < 0n ? -remainder : remainder) ? 1n : 0n;
      const sign = remainder < 0n ? -1n : 1n;
      return new Money(base + sign * extra);
    });
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  /**
   * Format as Thai Baht: `฿50,000.00`
   * Negative values: `-฿50,000.00`
   */
  format(): string {
    const abs = this.amount < 0n ? -this.amount : this.amount;
    const baht = abs / 100n;
    const satang = abs % 100n;

    const bahtStr = formatWithCommas(baht);
    const satangStr = satang.toString().padStart(2, '0');

    const formatted = `฿${bahtStr}.${satangStr}`;
    return this.amount < 0n ? `-${formatted}` : formatted;
  }

  /**
   * Format in accounting style.
   * Negative values are wrapped in parentheses: `(฿8,750.00)`
   * Positive/zero values: `฿8,750.00`
   */
  formatAccounting(): string {
    if (this.amount < 0n) {
      const abs = new Money(-this.amount);
      return `(${abs.format()})`;
    }
    return this.format();
  }

  // ---------------------------------------------------------------------------
  // Comparisons
  // ---------------------------------------------------------------------------

  isZero(): boolean {
    return this.amount === 0n;
  }

  isPositive(): boolean {
    return this.amount > 0n;
  }

  isNegative(): boolean {
    return this.amount < 0n;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount;
  }

  greaterThan(other: Money): boolean {
    return this.amount > other.amount;
  }

  lessThan(other: Money): boolean {
    return this.amount < other.amount;
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  toString(): string {
    return this.format();
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Round a number to 2 decimal places using round-half-up semantics.
 * Used only in the `fromBaht` factory for number-to-bigint conversion.
 */
function roundHalfUpNumber(value: number): number {
  // Multiply by 100, apply Math.round (which is round-half-up for positives),
  // then divide. For negatives, Math.round is round-half-to-positive-infinity,
  // which is actually round-half-up in the accounting sense.
  return Math.round(value * 100) / 100;
}

/**
 * Format a non-negative bigint with thousands commas.
 * e.g. 50000n → "50,000"
 */
function formatWithCommas(value: bigint): string {
  const str = value.toString();
  const result: string[] = [];
  const offset = str.length % 3;

  for (let i = 0; i < str.length; i++) {
    if (i !== 0 && (i - offset) % 3 === 0) {
      result.push(',');
    }
    result.push(str[i] as string);
  }

  return result.join('');
}
