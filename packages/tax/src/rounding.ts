/**
 * Thai tax rounding — round half-up (กรมสรรพากร).
 *
 * All calculations are done in bigint to avoid floating-point imprecision.
 * Rates are expressed in basis points (1 bp = 0.01%), so 7% = 700 bp.
 *
 * Formula: tax = (amount * rateBasisPoints + 5000) / 10000
 *          (the +5000 implements round-half-up for the /10000 division)
 *
 * Story: 11.1
 */

/**
 * Calculate tax amount using bigint-only arithmetic with round-half-up.
 *
 * @param amountSatang  - Base amount in satang (bigint).
 * @param rateBasisPoints - Tax rate in basis points (e.g. 700 = 7.00%).
 * @returns Tax amount in satang, rounded half-up.
 */
export function calculateTaxAmount(
  amountSatang: bigint,
  rateBasisPoints: number,
): bigint {
  if (rateBasisPoints < 0 || !Number.isInteger(rateBasisPoints)) {
    throw new RangeError(
      `rateBasisPoints must be a non-negative integer, got ${String(rateBasisPoints)}`,
    );
  }

  if (amountSatang < 0n) {
    throw new RangeError(
      `amountSatang must be non-negative, got ${String(amountSatang)}`,
    );
  }

  if (rateBasisPoints === 0) {
    return 0n;
  }

  const rate = BigInt(rateBasisPoints);
  const raw = amountSatang * rate;

  // Round half-up: add half of divisor (10000/2 = 5000) before integer division.
  const DIVISOR = 10000n;
  const HALF = 5000n;

  return (raw + HALF) / DIVISOR;
}
