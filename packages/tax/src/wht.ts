/**
 * WHT (Withholding Tax / ภาษีหัก ณ ที่จ่าย) calculation.
 *
 * WHT rates vary by income type:
 *   - dividends:    10%
 *   - rent:          5%
 *   - professional:  3%
 *   - services:      3%
 *   - prizes:        5%
 *   - advertising:   2%
 *   - transport:     1%
 *   - insurance:     1%
 *
 * Configurable via tax_rates table with effective dates.
 * All amounts: bigint satang — NO floating point.
 * Rounding: half-up per Thai Revenue Department rules.
 *
 * Story: 11.1
 */

import type { TaxResult } from './types.js';
import { calculateTaxAmount } from './rounding.js';
import type { TaxRateService } from './tax-rate-service.js';

/**
 * Calculate WHT on an amount.
 *
 * @param amountSatang    - Payment amount in satang (before WHT deduction).
 * @param incomeType      - Type of income (determines the WHT rate).
 * @param transactionDate - Date of the transaction (for rate lookup).
 * @param rateService     - Service to look up the applicable rate.
 * @param tenantId        - Tenant ID for rate lookup.
 * @returns TaxResult where totalAmount = baseAmount - taxAmount (net of WHT).
 */
export async function calculateWHT(
  amountSatang: bigint,
  incomeType: string,
  transactionDate: Date,
  rateService: TaxRateService,
  tenantId: string,
): Promise<TaxResult> {
  const { rateBasisPoints, effectiveFrom } = await rateService.getWhtRate(
    incomeType,
    tenantId,
    transactionDate,
  );

  const taxAmount = calculateTaxAmount(amountSatang, rateBasisPoints);

  return {
    baseAmount: amountSatang,
    taxAmount,
    // WHT is deducted: payee receives base minus WHT
    totalAmount: amountSatang - taxAmount,
    ratePercent: rateBasisPoints / 100,
    rateEffectiveDate: effectiveFrom,
  };
}

/**
 * Calculate WHT with an explicit rate (no DB lookup).
 * Useful for tests and scenarios where the rate is already known.
 *
 * @param amountSatang    - Payment amount in satang.
 * @param rateBasisPoints - Rate in basis points (e.g. 300 = 3%).
 * @param effectiveDate   - Date the rate became effective.
 * @returns TaxResult.
 */
export function calculateWHTDirect(
  amountSatang: bigint,
  rateBasisPoints: number,
  effectiveDate: Date,
): TaxResult {
  const taxAmount = calculateTaxAmount(amountSatang, rateBasisPoints);

  return {
    baseAmount: amountSatang,
    taxAmount,
    totalAmount: amountSatang - taxAmount,
    ratePercent: rateBasisPoints / 100,
    rateEffectiveDate: effectiveDate,
  };
}
