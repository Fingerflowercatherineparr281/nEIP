/**
 * VAT (Value Added Tax / ภาษีมูลค่าเพิ่ม) calculation.
 *
 * Standard rate: 7% (configurable via tax_rates table effective dates).
 * Rounding: half-up per Thai Revenue Department rules (กรมสรรพากร).
 * All amounts: bigint satang — NO floating point.
 *
 * Story: 11.1
 */

import type { TaxResult } from './types.js';
import { calculateTaxAmount } from './rounding.js';
import type { TaxRateService } from './tax-rate-service.js';

/**
 * Calculate VAT on an amount.
 *
 * @param amountSatang    - Base amount in satang (before VAT).
 * @param transactionDate - Date of the transaction (for rate effective-date lookup).
 * @param rateService     - Service to look up the applicable rate.
 * @param tenantId        - Tenant ID for rate lookup.
 * @returns TaxResult with base, tax, total, rate, and effective date.
 */
export async function calculateVAT(
  amountSatang: bigint,
  transactionDate: Date,
  rateService: TaxRateService,
  tenantId: string,
): Promise<TaxResult> {
  const { rateBasisPoints, effectiveFrom } = await rateService.getVatRate(
    tenantId,
    transactionDate,
  );

  const taxAmount = calculateTaxAmount(amountSatang, rateBasisPoints);

  return {
    baseAmount: amountSatang,
    taxAmount,
    totalAmount: amountSatang + taxAmount,
    ratePercent: rateBasisPoints / 100,
    rateEffectiveDate: effectiveFrom,
  };
}

/**
 * Calculate VAT with an explicit rate (no DB lookup).
 * Useful for tests and scenarios where the rate is already known.
 *
 * @param amountSatang    - Base amount in satang.
 * @param rateBasisPoints - Rate in basis points (e.g. 700 = 7%).
 * @param effectiveDate   - Date the rate became effective.
 * @returns TaxResult.
 */
export function calculateVATDirect(
  amountSatang: bigint,
  rateBasisPoints: number,
  effectiveDate: Date,
): TaxResult {
  const taxAmount = calculateTaxAmount(amountSatang, rateBasisPoints);

  return {
    baseAmount: amountSatang,
    taxAmount,
    totalAmount: amountSatang + taxAmount,
    ratePercent: rateBasisPoints / 100,
    rateEffectiveDate: effectiveDate,
  };
}
