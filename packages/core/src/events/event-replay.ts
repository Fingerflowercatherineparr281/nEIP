/**
 * event-replay.ts — Event replay engine for NPAEs/PAEs dual-standard reporting.
 *
 * Architecture reference: Story 13.3 (NPAEs/PAEs Event Replay Architecture)
 *
 * Responsibilities:
 *  - Read events from the Event Store for a given tenant + fiscal year.
 *  - Apply interpretation rules to produce materialized view data.
 *  - Support both NPAEs and PAEs standards through pluggable rule sets.
 *  - Performance target: < 60s for 50K events.
 *
 * The replay engine processes events in version order and applies each
 * matching rule to produce MaterializedEntry records. The result includes
 * all entries plus summary balances per account.
 */

import { eq, and, asc } from 'drizzle-orm';
import type { DbClient } from '@neip/db';
import { domain_events } from '@neip/db';
import type { DomainEvent } from '@neip/shared';
import type {
  InterpretationRules,
  MaterializedEntry,
  RuleContext,
  AccountingStandard,
  Rule,
} from './interpretation-rules.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Summary balance for a single account after replay.
 */
export interface AccountBalance {
  readonly accountCode: string;
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly netBalance: number;
}

/**
 * Result of replaying events through an interpretation rule set.
 */
export interface ReplayResult {
  /** The accounting standard used for this replay. */
  readonly standard: AccountingStandard;
  /** Tenant the replay was executed for. */
  readonly tenantId: string;
  /** Fiscal year replayed. */
  readonly fiscalYear: number;
  /** Total number of events processed. */
  readonly eventsProcessed: number;
  /** All materialized entries produced by the rules. */
  readonly entries: readonly MaterializedEntry[];
  /** Per-account balance summaries. */
  readonly balances: readonly AccountBalance[];
  /** Replay duration in milliseconds. */
  readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// Replay Engine
// ---------------------------------------------------------------------------

/**
 * Replay domain events through interpretation rules to produce materialized
 * financial data for a given accounting standard.
 *
 * Events are read from the Event Store in version order, filtered by tenant
 * and optional fiscal year, then each event is matched against the rule set.
 *
 * @param db               - Drizzle database client.
 * @param tenantId         - Tenant to replay events for.
 * @param fiscalYear       - Fiscal year to filter events (uses fiscal_year column).
 * @param interpretationRules - Rule set defining how events map to entries.
 *
 * @returns ReplayResult with all materialized entries and account balances.
 */
export async function replay(
  db: DbClient,
  tenantId: string,
  fiscalYear: number,
  interpretationRules: InterpretationRules,
): Promise<ReplayResult> {
  const startTime = performance.now();

  // ------------------------------------------------------------------
  // 1. Load events from Event Store
  // ------------------------------------------------------------------

  const rows = await db
    .select()
    .from(domain_events)
    .where(
      and(
        eq(domain_events.tenant_id, tenantId),
        eq(domain_events.fiscal_year, fiscalYear),
      ),
    )
    .orderBy(asc(domain_events.version));

  // ------------------------------------------------------------------
  // 2. Build rule index for O(1) lookup by event type
  // ------------------------------------------------------------------

  const ruleIndex = new Map<string, Rule[]>();
  for (const rule of interpretationRules.rules) {
    const existing = ruleIndex.get(rule.eventType);
    if (existing) {
      existing.push(rule);
    } else {
      ruleIndex.set(rule.eventType, [rule]);
    }
  }

  // ------------------------------------------------------------------
  // 3. Process events through rules
  // ------------------------------------------------------------------

  const context: RuleContext = {
    tenantId,
    fiscalYear,
    standard: interpretationRules.standard,
    balances: new Map(),
  };

  const allEntries: MaterializedEntry[] = [];

  for (const row of rows) {
    const event: DomainEvent = {
      id: row.id,
      type: row.type,
      tenantId: row.tenant_id,
      payload: row.payload,
      version: row.version,
      timestamp: row.timestamp,
    };

    const matchingRules = ruleIndex.get(event.type);
    if (!matchingRules) continue;

    for (const rule of matchingRules) {
      const entries = rule.handler(event, context);
      allEntries.push(...entries);
    }
  }

  // ------------------------------------------------------------------
  // 4. Build account balance summaries from the context
  // ------------------------------------------------------------------

  const balances: AccountBalance[] = [];
  for (const [accountCode, balance] of context.balances) {
    balances.push({
      accountCode,
      totalDebit: balance.debit,
      totalCredit: balance.credit,
      netBalance: balance.debit - balance.credit,
    });
  }

  // Sort balances by account code for deterministic output
  balances.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const durationMs = performance.now() - startTime;

  return {
    standard: interpretationRules.standard,
    tenantId,
    fiscalYear,
    eventsProcessed: rows.length,
    entries: allEntries,
    balances,
    durationMs,
  };
}
