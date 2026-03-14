/**
 * interpretation-rules.ts — NPAEs and PAEs interpretation rule framework.
 *
 * Architecture reference: Story 13.3 (NPAEs/PAEs Event Replay Architecture)
 *
 * Defines the base rule interfaces and default rule sets for Thai Accounting
 * Standards:
 *  - NPAEs (Non-Publicly Accountable Entities) — simplified standards
 *  - PAEs  (Publicly Accountable Entities) — full TFRS/IFRS standards
 *
 * Each rule maps an event type to a handler that produces materialized
 * entries from a domain event, applying standard-specific interpretation.
 */

import type { DomainEvent } from '@neip/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported Thai accounting standards. */
export type AccountingStandard = 'NPAEs' | 'PAEs';

/**
 * A single materialized entry produced by applying an interpretation rule
 * to a domain event. Represents a line in a financial statement or ledger.
 */
export interface MaterializedEntry {
  /** Account code from the chart of accounts. */
  readonly accountCode: string;
  /** Debit amount in satang (smallest Thai currency unit). */
  readonly debit: number;
  /** Credit amount in satang. */
  readonly credit: number;
  /** Description / narration for this entry. */
  readonly description: string;
  /** The accounting standard that produced this entry. */
  readonly standard: AccountingStandard;
  /** Optional metadata for standard-specific details. */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Context passed to rule handlers, providing access to lookup data
 * and configuration needed during event interpretation.
 */
export interface RuleContext {
  /** Tenant identifier for multi-tenant scoping. */
  readonly tenantId: string;
  /** Fiscal year being replayed. */
  readonly fiscalYear: number;
  /** The accounting standard being applied. */
  readonly standard: AccountingStandard;
  /** Running balances keyed by account code (mutable during replay). */
  readonly balances: Map<string, { debit: number; credit: number }>;
}

/**
 * A single interpretation rule that processes one type of domain event.
 *
 * The handler receives the raw domain event and a context object,
 * and returns zero or more materialized entries.
 */
export interface Rule {
  /** The domain event type this rule handles (e.g. 'JournalEntryCreated'). */
  readonly eventType: string;
  /** Handler that interprets the event under the given standard. */
  readonly handler: (event: DomainEvent, context: RuleContext) => MaterializedEntry[];
}

/**
 * Complete interpretation rule set for a given accounting standard.
 */
export interface InterpretationRules {
  /** The accounting standard these rules implement. */
  readonly standard: AccountingStandard;
  /** Ordered list of rules to apply during replay. */
  readonly rules: readonly Rule[];
}

// ---------------------------------------------------------------------------
// Base NPAEs Rules
// ---------------------------------------------------------------------------

/**
 * NPAEs base rule set.
 *
 * NPAEs (Non-Publicly Accountable Entities) use simplified recognition:
 * - Revenue recognised at point of invoice issuance
 * - Expenses recognised at point of bill receipt
 * - No fair-value adjustments required
 * - Simplified lease accounting (operating lease model)
 */
export const NPAES_RULES: InterpretationRules = {
  standard: 'NPAEs',
  rules: [
    {
      eventType: 'JournalEntryPosted',
      handler: (event: DomainEvent, context: RuleContext): MaterializedEntry[] => {
        const payload = event.payload as {
          lines?: Array<{
            accountCode: string;
            debit: number;
            credit: number;
            description?: string;
          }>;
          memo?: string;
        };

        if (!payload.lines) return [];

        return payload.lines.map((line) => {
          // Update running balances
          const balance = context.balances.get(line.accountCode) ?? { debit: 0, credit: 0 };
          balance.debit += line.debit;
          balance.credit += line.credit;
          context.balances.set(line.accountCode, balance);

          return {
            accountCode: line.accountCode,
            debit: line.debit,
            credit: line.credit,
            description: line.description ?? payload.memo ?? '',
            standard: 'NPAEs' as const,
          };
        });
      },
    },
    {
      eventType: 'InvoiceCreated',
      handler: (event: DomainEvent, context: RuleContext): MaterializedEntry[] => {
        const payload = event.payload as {
          totalAmount?: number;
          revenueAccountCode?: string;
          receivableAccountCode?: string;
          description?: string;
        };

        if (!payload.totalAmount) return [];

        const revenueCode = payload.revenueAccountCode ?? '4100';
        const receivableCode = payload.receivableAccountCode ?? '1200';
        const desc = payload.description ?? 'Invoice revenue recognition (NPAEs)';

        // NPAEs: recognise revenue at invoice issuance
        const entries: MaterializedEntry[] = [
          {
            accountCode: receivableCode,
            debit: payload.totalAmount,
            credit: 0,
            description: desc,
            standard: 'NPAEs',
          },
          {
            accountCode: revenueCode,
            debit: 0,
            credit: payload.totalAmount,
            description: desc,
            standard: 'NPAEs',
          },
        ];

        // Update balances
        for (const entry of entries) {
          const balance = context.balances.get(entry.accountCode) ?? { debit: 0, credit: 0 };
          balance.debit += entry.debit;
          balance.credit += entry.credit;
          context.balances.set(entry.accountCode, balance);
        }

        return entries;
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Base PAEs Rules
// ---------------------------------------------------------------------------

/**
 * PAEs base rule set.
 *
 * PAEs (Publicly Accountable Entities) follow full TFRS/IFRS:
 * - Revenue recognised per TFRS 15 (five-step model)
 * - Fair value measurement where required
 * - TFRS 16 lease accounting (right-of-use assets)
 * - Expected credit loss model for receivables
 */
export const PAES_RULES: InterpretationRules = {
  standard: 'PAEs',
  rules: [
    {
      eventType: 'JournalEntryPosted',
      handler: (event: DomainEvent, context: RuleContext): MaterializedEntry[] => {
        const payload = event.payload as {
          lines?: Array<{
            accountCode: string;
            debit: number;
            credit: number;
            description?: string;
          }>;
          memo?: string;
        };

        if (!payload.lines) return [];

        return payload.lines.map((line) => {
          const balance = context.balances.get(line.accountCode) ?? { debit: 0, credit: 0 };
          balance.debit += line.debit;
          balance.credit += line.credit;
          context.balances.set(line.accountCode, balance);

          return {
            accountCode: line.accountCode,
            debit: line.debit,
            credit: line.credit,
            description: line.description ?? payload.memo ?? '',
            standard: 'PAEs' as const,
          };
        });
      },
    },
    {
      eventType: 'InvoiceCreated',
      handler: (event: DomainEvent, context: RuleContext): MaterializedEntry[] => {
        const payload = event.payload as {
          totalAmount?: number;
          revenueAccountCode?: string;
          receivableAccountCode?: string;
          description?: string;
        };

        if (!payload.totalAmount) return [];

        const revenueCode = payload.revenueAccountCode ?? '4100';
        const receivableCode = payload.receivableAccountCode ?? '1200';
        const desc = payload.description ?? 'Invoice revenue recognition (PAEs/TFRS 15)';

        // PAEs: revenue recognised per TFRS 15 five-step model
        // For the base framework, the recognition point is similar but
        // additional metadata is captured for disclosure requirements.
        const entries: MaterializedEntry[] = [
          {
            accountCode: receivableCode,
            debit: payload.totalAmount,
            credit: 0,
            description: desc,
            standard: 'PAEs',
            metadata: {
              tfrs15Step: 'satisfaction-of-performance-obligation',
              recognitionBasis: 'point-in-time',
            },
          },
          {
            accountCode: revenueCode,
            debit: 0,
            credit: payload.totalAmount,
            description: desc,
            standard: 'PAEs',
            metadata: {
              tfrs15Step: 'satisfaction-of-performance-obligation',
              recognitionBasis: 'point-in-time',
            },
          },
        ];

        for (const entry of entries) {
          const balance = context.balances.get(entry.accountCode) ?? { debit: 0, credit: 0 };
          balance.debit += entry.debit;
          balance.credit += entry.credit;
          context.balances.set(entry.accountCode, balance);
        }

        return entries;
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Rule set lookup
// ---------------------------------------------------------------------------

/**
 * Get the default rule set for a given accounting standard.
 */
export function getDefaultRules(standard: AccountingStandard): InterpretationRules {
  switch (standard) {
    case 'NPAEs':
      return NPAES_RULES;
    case 'PAEs':
      return PAES_RULES;
  }
}
