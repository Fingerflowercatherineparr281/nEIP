import { pgTable, text, bigint, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * wht_certificates — Withholding Tax Certificates (ใบหัก ณ ที่จ่าย).
 *
 * Covers both ภ.ง.ด.3 (payments to individuals) and ภ.ง.ด.53 (payments to
 * juristic persons).  Every payment that attracts WHT must generate one
 * certificate.
 *
 * Status transitions:
 *   draft → issued (certificate number assigned)
 *   issued → filed (submitted to Revenue Department)
 *   draft | issued → voided
 *
 * Rates are stored in basis points (1 bp = 0.01%, so 300 bp = 3%).
 * Amounts are stored in satang (1 THB = 100 satang).
 */
export const wht_certificates = pgTable('wht_certificates', {
  id: text('id').primaryKey(),

  /** Running document number, e.g. WHT-2026-00001 */
  document_number: text('document_number').notNull(),

  /** ภ.ง.ด.3 = payments to individuals / ภ.ง.ด.53 = payments to juristic persons */
  certificate_type: text('certificate_type', {
    enum: ['pnd3', 'pnd53'],
  }).notNull(),

  // Payer (ผู้จ่ายเงิน) — always the tenant's own company
  payer_name: text('payer_name').notNull(),
  payer_tax_id: text('payer_tax_id').notNull(),

  // Payee (ผู้รับเงิน)
  payee_name: text('payee_name').notNull(),
  payee_tax_id: text('payee_tax_id').notNull(),
  payee_address: text('payee_address').notNull(),

  /** Revenue Department income type code, e.g. "1", "2", "3" */
  income_type: text('income_type').notNull(),
  income_description: text('income_description').notNull(),

  payment_date: text('payment_date').notNull(), // YYYY-MM-DD

  income_amount_satang: bigint('income_amount_satang', { mode: 'bigint' }).notNull(),

  /** WHT rate in basis points (e.g. 300 = 3%) */
  wht_rate_basis_points: integer('wht_rate_basis_points').notNull(),

  wht_amount_satang: bigint('wht_amount_satang', { mode: 'bigint' }).notNull(),

  /** Month of the WHT return (1-12) */
  tax_month: integer('tax_month').notNull(),
  tax_year: integer('tax_year').notNull(),

  /** Optional link to the AP bill payment that triggered this certificate */
  bill_payment_id: text('bill_payment_id'),

  status: text('status', {
    enum: ['draft', 'issued', 'filed', 'voided'],
  }).notNull().default('draft'),

  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  created_by: text('created_by').notNull(),
  issued_at: timestamp('issued_at', { withTimezone: true }),
  filed_at: timestamp('filed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type WhtCertificate = typeof wht_certificates.$inferSelect;
export type NewWhtCertificate = typeof wht_certificates.$inferInsert;
