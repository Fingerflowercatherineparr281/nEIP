/**
 * EventStore — append-only persistence layer for domain events.
 *
 * Architecture reference: AR16 (Event Sourcing), Story 2.3.
 *
 * Responsibilities:
 *  - Assign UUIDv7 identifiers to new events.
 *  - Enforce optimistic concurrency via expectedVersion check.
 *  - Persist events in the domain_events table (append-only).
 *  - Provide ordered stream retrieval and type-filtered queries.
 *
 * Immutability guarantee: no UPDATE or DELETE methods exist on this class.
 * Any attempt to modify persisted events must fail at the type level.
 */

import { eq, and, asc } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { DomainEvent } from '@neip/shared';
import { ConflictError } from '@neip/shared';
import type { DbClient } from '@neip/db';
import { domain_events } from '@neip/db';

// ---------------------------------------------------------------------------
// Input type for appending an event
// ---------------------------------------------------------------------------

/**
 * Shape passed to `EventStore.append`.
 *
 * The caller supplies domain-layer fields; `id` and `timestamp` are assigned
 * by the store so that callers never have to generate them manually.
 */
export interface AppendEventInput<T = unknown> {
  /** Fully-qualified event type, e.g. 'JournalEntryCreated'. */
  readonly type: string;
  /** Identifier of the aggregate this event belongs to. */
  readonly aggregateId: string;
  /** Type name of the aggregate, e.g. 'JournalEntry'. */
  readonly aggregateType: string;
  /** Tenant identifier for multi-tenancy isolation. */
  readonly tenantId: string;
  /** Domain-specific payload. */
  readonly payload: T;
  /** Monotonically increasing version for this aggregate stream. */
  readonly version: number;
  /** Optional fiscal year for future partitioning. */
  readonly fiscalYear?: number | undefined;
}

// ---------------------------------------------------------------------------
// EventStore
// ---------------------------------------------------------------------------

/**
 * Append-only event store backed by the `domain_events` PostgreSQL table.
 *
 * Instantiate with a Drizzle `DbClient` (created via `createClient()`).
 *
 * Optimistic concurrency:
 *   When `expectedVersion` is supplied to `append`, the store first checks
 *   that the current maximum version for the aggregate equals `expectedVersion`.
 *   A mismatch throws `ConflictError`. Without `expectedVersion`, the database
 *   unique constraint on `(aggregate_id, version)` still prevents duplicates
 *   and throws `ConflictError` on violation.
 */
export class EventStore {
  readonly #db: DbClient;

  constructor(db: DbClient) {
    this.#db = db;
  }

  // -------------------------------------------------------------------------
  // append
  // -------------------------------------------------------------------------

  /**
   * Persist a new domain event.
   *
   * @param input         - Event data (without `id` and `timestamp`).
   * @param expectedVersion - When provided, the store verifies the most recent
   *                          version in the stream matches this value before
   *                          inserting. Throws `ConflictError` on mismatch.
   *
   * @returns The fully-formed `DomainEvent<T>` as stored (id + timestamp
   *          assigned by this method).
   *
   * @throws ConflictError  if optimistic concurrency check fails or the DB
   *                        unique constraint on (aggregate_id, version) fires.
   */
  async append<T>(
    input: AppendEventInput<T>,
    expectedVersion?: number,
  ): Promise<DomainEvent<T>> {
    // ------------------------------------------------------------------
    // 1. Optimistic concurrency pre-check
    // ------------------------------------------------------------------
    if (expectedVersion !== undefined) {
      const currentVersion = await this.#currentVersion(input.aggregateId);
      if (currentVersion !== expectedVersion) {
        throw new ConflictError({
          detail:
            `Optimistic concurrency conflict for aggregate "${input.aggregateId}": ` +
            `expected version ${expectedVersion}, ` +
            `but current version is ${currentVersion ?? 'none'}.`,
        });
      }
    }

    // ------------------------------------------------------------------
    // 2. Build the row
    // ------------------------------------------------------------------
    const id = uuidv7();
    const timestamp = new Date();

    const row: typeof domain_events.$inferInsert = {
      id,
      type: input.type,
      aggregate_id: input.aggregateId,
      aggregate_type: input.aggregateType,
      tenant_id: input.tenantId,
      // The jsonb column accepts unknown; the type-system erases T here.
      payload: input.payload as Record<string, unknown>,
      version: input.version,
      timestamp,
    };

    if (input.fiscalYear !== undefined) {
      row.fiscal_year = input.fiscalYear;
    }

    // ------------------------------------------------------------------
    // 3. Insert — unique constraint on (aggregate_id, version) fires if
    //    a concurrent writer already inserted the same version.
    // ------------------------------------------------------------------
    try {
      await this.#db.insert(domain_events).values(row);
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError({
          detail:
            `Duplicate version ${input.version} for aggregate "${input.aggregateId}".`,
          cause: err,
        });
      }
      throw err;
    }

    // ------------------------------------------------------------------
    // 4. Return as DomainEvent<T>
    // ------------------------------------------------------------------
    return {
      id,
      type: input.type,
      tenantId: input.tenantId,
      payload: input.payload,
      version: input.version,
      timestamp,
    } satisfies DomainEvent<T>;
  }

  // -------------------------------------------------------------------------
  // getStream
  // -------------------------------------------------------------------------

  /**
   * Return all events for a given aggregate, ordered ascending by version.
   *
   * Returns an empty array when the aggregate has no events.
   */
  async getStream<T = unknown>(aggregateId: string): Promise<ReadonlyArray<DomainEvent<T>>> {
    const rows = await this.#db
      .select()
      .from(domain_events)
      .where(eq(domain_events.aggregate_id, aggregateId))
      .orderBy(asc(domain_events.version));

    return rows.map((r) => rowToDomainEvent<T>(r));
  }

  // -------------------------------------------------------------------------
  // getByType
  // -------------------------------------------------------------------------

  /**
   * Return all events matching a given event `type` within a tenant,
   * ordered ascending by version.
   *
   * Returns an empty array when no matching events exist.
   */
  async getByType<T = unknown>(
    type: string,
    tenantId: string,
  ): Promise<ReadonlyArray<DomainEvent<T>>> {
    const rows = await this.#db
      .select()
      .from(domain_events)
      .where(and(eq(domain_events.type, type), eq(domain_events.tenant_id, tenantId)))
      .orderBy(asc(domain_events.version));

    return rows.map((r) => rowToDomainEvent<T>(r));
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Fetch the current maximum version for an aggregate stream.
   * Returns `undefined` when the stream is empty (no events yet).
   */
  async #currentVersion(aggregateId: string): Promise<number | undefined> {
    const rows = await this.#db
      .select({ version: domain_events.version })
      .from(domain_events)
      .where(eq(domain_events.aggregate_id, aggregateId))
      .orderBy(asc(domain_events.version));

    if (rows.length === 0) return undefined;

    // rows is ordered ascending; last element has the max version.
    const last = rows[rows.length - 1];
    return last?.version;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type DomainEventRowSelect = typeof domain_events.$inferSelect;

/**
 * Convert a Drizzle select row to the `DomainEvent<T>` interface shape.
 *
 * The `payload` column is typed as `unknown` in the Drizzle schema; the
 * caller is responsible for narrowing `T` appropriately.
 */
function rowToDomainEvent<T>(row: DomainEventRowSelect): DomainEvent<T> {
  return {
    id: row.id,
    type: row.type,
    tenantId: row.tenant_id,
    payload: row.payload as T,
    version: row.version,
    timestamp: row.timestamp,
  };
}

/**
 * Detect PostgreSQL unique-constraint violation (error code 23505).
 * Works with both `postgres.js` driver errors and generic errors.
 */
function isUniqueViolation(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  // postgres.js surfaces `code` on the error object directly.
  return e['code'] === '23505';
}
