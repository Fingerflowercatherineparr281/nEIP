/**
 * Zod schemas for each supported import type.
 *
 * These schemas validate individual rows after CSV/Excel parsing.
 * Each schema maps column names to expected types and constraints.
 *
 * Story 8.1 — Import Engine
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Coerce string to trimmed non-empty string */
const trimmedString = z.string().trim().min(1, 'Field is required');

/** Coerce string to a valid date string (YYYY-MM-DD) */
const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format');

/** Coerce string/number to a valid decimal amount. Treats empty strings as undefined. */
const amountString = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const s = String(v).trim();
    return s === '' ? undefined : s;
  })
  .pipe(
    z
      .string()
      .regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a valid amount with up to 2 decimal places')
      .optional(),
  );

// ---------------------------------------------------------------------------
// Journal Entry import schema
// ---------------------------------------------------------------------------

export const journalEntryRowSchema = z.object({
  /** Date of the journal entry (YYYY-MM-DD) */
  date: dateString,
  /** Account code (e.g. "1100", "4100") */
  accountCode: trimmedString,
  /** Description / memo */
  description: trimmedString,
  /** Debit amount (leave empty for credit-only lines) */
  debit: amountString.optional(),
  /** Credit amount (leave empty for debit-only lines) */
  credit: amountString.optional(),
  /** Optional reference / document number */
  reference: z.string().trim().optional(),
}).refine(
  (row) => {
    const hasDebit = row.debit !== undefined && row.debit !== '' && row.debit !== '0';
    const hasCredit = row.credit !== undefined && row.credit !== '' && row.credit !== '0';
    return hasDebit || hasCredit;
  },
  { message: 'Each row must have either a debit or credit amount' },
);

export type JournalEntryRow = z.infer<typeof journalEntryRowSchema>;

// ---------------------------------------------------------------------------
// Chart of Accounts import schema
// ---------------------------------------------------------------------------

export const chartOfAccountsRowSchema = z.object({
  /** Account code (unique identifier) */
  code: trimmedString,
  /** Account name */
  name: trimmedString,
  /** Account type: asset, liability, equity, revenue, expense */
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense'], {
    error: 'Type must be one of: asset, liability, equity, revenue, expense',
  }),
  /** Parent account code (optional for sub-accounts) */
  parentCode: z.string().trim().optional(),
  /** Whether this account is active */
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === 'boolean') return v;
      const lower = v.toLowerCase().trim();
      return lower === 'true' || lower === 'yes' || lower === '1';
    })
    .optional(),
});

export type ChartOfAccountsRow = z.infer<typeof chartOfAccountsRowSchema>;

// ---------------------------------------------------------------------------
// Contacts import schema
// ---------------------------------------------------------------------------

export const contactRowSchema = z.object({
  /** Contact name (company or individual) */
  name: trimmedString,
  /** Contact type: customer, vendor, both */
  type: z.enum(['customer', 'vendor', 'both'], {
    error: 'Type must be one of: customer, vendor, both',
  }),
  /** Tax ID (optional) */
  taxId: z.string().trim().optional(),
  /** Email address (optional) */
  email: z.string().email('Must be a valid email address').optional().or(z.literal('')),
  /** Phone number (optional) */
  phone: z.string().trim().optional(),
  /** Address (optional) */
  address: z.string().trim().optional(),
});

export type ContactRow = z.infer<typeof contactRowSchema>;

// ---------------------------------------------------------------------------
// Import type registry
// ---------------------------------------------------------------------------

export const IMPORT_TYPES = {
  journal_entries: journalEntryRowSchema,
  chart_of_accounts: chartOfAccountsRowSchema,
  contacts: contactRowSchema,
} as const;

export type ImportType = keyof typeof IMPORT_TYPES;

/** Column definitions for auto-mapping — maps common header names to schema fields */
export const COLUMN_ALIASES: Record<ImportType, Record<string, string>> = {
  journal_entries: {
    'date': 'date',
    'entry date': 'date',
    'transaction date': 'date',
    'account code': 'accountCode',
    'account': 'accountCode',
    'account_code': 'accountCode',
    'description': 'description',
    'memo': 'description',
    'debit': 'debit',
    'debit amount': 'debit',
    'credit': 'credit',
    'credit amount': 'credit',
    'reference': 'reference',
    'ref': 'reference',
    'doc number': 'reference',
  },
  chart_of_accounts: {
    'code': 'code',
    'account code': 'code',
    'account_code': 'code',
    'name': 'name',
    'account name': 'name',
    'account_name': 'name',
    'type': 'type',
    'account type': 'type',
    'account_type': 'type',
    'parent code': 'parentCode',
    'parent_code': 'parentCode',
    'parent': 'parentCode',
    'is active': 'isActive',
    'is_active': 'isActive',
    'active': 'isActive',
  },
  contacts: {
    'name': 'name',
    'contact name': 'name',
    'company name': 'name',
    'type': 'type',
    'contact type': 'type',
    'tax id': 'taxId',
    'tax_id': 'taxId',
    'tin': 'taxId',
    'email': 'email',
    'email address': 'email',
    'phone': 'phone',
    'phone number': 'phone',
    'telephone': 'phone',
    'address': 'address',
  },
} as const;
