/**
 * Tax Rate Service — loads tax rates with effective date lookup.
 *
 * Provides an interface for querying tax rates from the database,
 * with fallback to statutory defaults when no custom rate exists.
 *
 * Story: 11.1
 */

import type { TaxRate, TaxType, WhtIncomeType } from './types.js';

// ---------------------------------------------------------------------------
// Statutory default rates (Thai Revenue Department)
// ---------------------------------------------------------------------------

/** Default VAT rate: 7% = 700 basis points. */
const DEFAULT_VAT_RATE_BP = 700;

/** Default WHT rates by income type (basis points). */
const DEFAULT_WHT_RATES: ReadonlyMap<string, number> = new Map<string, number>([
  ['dividends', 1000],    // 10%
  ['rent', 500],          // 5%
  ['professional', 300],  // 3%
  ['services', 300],      // 3%
  ['prizes', 500],        // 5%
  ['advertising', 200],   // 2%
  ['transport', 100],     // 1%
  ['insurance', 100],     // 1%
]);

/** Sentinel date used for statutory defaults (1 Jan 1992, when VAT was introduced). */
const STATUTORY_EFFECTIVE_DATE = new Date('1992-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Port: TaxRateRepository (dependency injection for DB access)
// ---------------------------------------------------------------------------

/**
 * Repository interface for loading tax rates from the database.
 * Implementations are injected so the tax engine stays DB-agnostic.
 */
export interface TaxRateRepository {
  /**
   * Find the applicable tax rate for a given tax type, optional income type,
   * tenant, and transaction date.
   *
   * Must return the rate with the latest effective_from <= transactionDate,
   * or null if none exists.
   */
  findEffectiveRate(params: {
    taxType: TaxType;
    incomeType: string | null;
    tenantId: string;
    transactionDate: Date;
  }): Promise<TaxRate | null>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TaxRateService {
  private readonly repo: TaxRateRepository | null;

  /**
   * @param repo - Optional repository. When null, only statutory defaults are used.
   */
  constructor(repo: TaxRateRepository | null = null) {
    this.repo = repo;
  }

  /**
   * Get the effective VAT rate for a transaction date and tenant.
   *
   * Lookup order:
   *   1. Custom rate from DB (tenant-specific, effective date <= transactionDate)
   *   2. Statutory default (7%)
   */
  async getVatRate(
    tenantId: string,
    transactionDate: Date,
  ): Promise<{ rateBasisPoints: number; effectiveFrom: Date }> {
    if (this.repo) {
      const custom = await this.repo.findEffectiveRate({
        taxType: 'vat',
        incomeType: null,
        tenantId,
        transactionDate,
      });
      if (custom) {
        return {
          rateBasisPoints: custom.rateBasisPoints,
          effectiveFrom: custom.effectiveFrom,
        };
      }
    }
    return {
      rateBasisPoints: DEFAULT_VAT_RATE_BP,
      effectiveFrom: STATUTORY_EFFECTIVE_DATE,
    };
  }

  /**
   * Get the effective WHT rate for a given income type, transaction date, and tenant.
   *
   * Lookup order:
   *   1. Custom rate from DB (tenant-specific)
   *   2. Statutory default for the income type
   *   3. Throws if income type is unknown
   */
  async getWhtRate(
    incomeType: string,
    tenantId: string,
    transactionDate: Date,
  ): Promise<{ rateBasisPoints: number; effectiveFrom: Date }> {
    if (this.repo) {
      const custom = await this.repo.findEffectiveRate({
        taxType: 'wht',
        incomeType,
        tenantId,
        transactionDate,
      });
      if (custom) {
        return {
          rateBasisPoints: custom.rateBasisPoints,
          effectiveFrom: custom.effectiveFrom,
        };
      }
    }

    const defaultRate = DEFAULT_WHT_RATES.get(incomeType);
    if (defaultRate === undefined) {
      throw new Error(
        `Unknown WHT income type: "${incomeType}". ` +
        `Valid types: ${[...DEFAULT_WHT_RATES.keys()].join(', ')}`,
      );
    }

    return {
      rateBasisPoints: defaultRate,
      effectiveFrom: STATUTORY_EFFECTIVE_DATE,
    };
  }

  /**
   * Get all available WHT income type names (for validation / UI dropdowns).
   */
  getAvailableWhtIncomeTypes(): readonly WhtIncomeType[] {
    return [
      'dividends',
      'rent',
      'professional',
      'services',
      'prizes',
      'advertising',
      'transport',
      'insurance',
    ];
  }
}
