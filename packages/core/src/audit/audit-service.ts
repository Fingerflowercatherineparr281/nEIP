/**
 * Audit Trail Service — immutable audit logging for all business operations.
 *
 * Architecture reference: Story 2.8.
 *
 * Features:
 *   - Records userId, tenantId, action, resourceType, resourceId, changes, timestamp, requestId
 *   - Immutable — no update/delete
 *   - Queryable by resource, user, time range
 *   - Redacts sensitive fields (passwords, API keys)
 *   - Can be used as middleware hook for automatic audit logging
 */

import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { DbClient } from '@neip/db';
import { audit_logs } from '@neip/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields that are automatically redacted from audit log changes. */
const SENSITIVE_FIELDS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'apiKey',
  'api_key',
  'secret',
  'secretKey',
  'secret_key',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
]);

const REDACTED_VALUE = '[REDACTED]' as const;

/** Input for recording an audit log entry. */
export interface AuditLogInput {
  readonly userId: string;
  readonly tenantId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly changes?: AuditChanges | undefined;
  readonly requestId: string;
}

/** Before/after change snapshot for auditing. */
export interface AuditChanges {
  readonly before?: Record<string, unknown> | undefined;
  readonly after?: Record<string, unknown> | undefined;
}

/** Output shape of an audit log entry. */
export interface AuditLogOutput {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly changes: AuditChanges | null;
  readonly requestId: string;
  readonly timestamp: Date;
}

/** Filters for querying audit logs. */
export interface AuditLogQuery {
  readonly tenantId: string;
  readonly resourceType?: string | undefined;
  readonly resourceId?: string | undefined;
  readonly userId?: string | undefined;
  readonly startDate?: Date | undefined;
  readonly endDate?: Date | undefined;
}

// ---------------------------------------------------------------------------
// AuditService
// ---------------------------------------------------------------------------

/**
 * Immutable audit trail service.
 *
 * Records business operation history with before/after snapshots.
 * Sensitive fields are automatically redacted from change payloads.
 */
export class AuditService {
  readonly #db: DbClient;

  constructor(db: DbClient) {
    this.#db = db;
  }

  /**
   * Record an audit log entry.
   *
   * Sensitive fields in the `changes` payload are automatically redacted.
   */
  async record(input: AuditLogInput): Promise<AuditLogOutput> {
    const id = uuidv7();
    const timestamp = new Date();

    const redactedChanges = input.changes !== undefined
      ? redactChanges(input.changes)
      : null;

    await this.#db.insert(audit_logs).values({
      id,
      user_id: input.userId,
      tenant_id: input.tenantId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      changes: redactedChanges as Record<string, unknown> | null,
      request_id: input.requestId,
      timestamp,
    });

    return {
      id,
      userId: input.userId,
      tenantId: input.tenantId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      changes: redactedChanges,
      requestId: input.requestId,
      timestamp,
    };
  }

  /**
   * Query audit logs with optional filters.
   *
   * Results are ordered by timestamp ascending.
   */
  async query(filter: AuditLogQuery): Promise<ReadonlyArray<AuditLogOutput>> {
    const conditions = [eq(audit_logs.tenant_id, filter.tenantId)];

    if (filter.resourceType !== undefined) {
      conditions.push(eq(audit_logs.resource_type, filter.resourceType));
    }
    if (filter.resourceId !== undefined) {
      conditions.push(eq(audit_logs.resource_id, filter.resourceId));
    }
    if (filter.userId !== undefined) {
      conditions.push(eq(audit_logs.user_id, filter.userId));
    }
    if (filter.startDate !== undefined) {
      conditions.push(gte(audit_logs.timestamp, filter.startDate));
    }
    if (filter.endDate !== undefined) {
      conditions.push(lte(audit_logs.timestamp, filter.endDate));
    }

    const rows = await this.#db
      .select()
      .from(audit_logs)
      .where(and(...conditions))
      .orderBy(asc(audit_logs.timestamp));

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      changes: row.changes as AuditChanges | null,
      requestId: row.request_id,
      timestamp: row.timestamp,
    }));
  }
}

// ---------------------------------------------------------------------------
// Middleware hook for automatic audit logging
// ---------------------------------------------------------------------------

/**
 * Create a middleware-style wrapper that automatically logs tool executions.
 *
 * Usage:
 *   const auditedHandler = withAuditLogging(auditService, originalHandler, 'JournalEntry');
 */
export function withAuditLogging<TInput, TOutput>(
  auditService: AuditService,
  resourceType: string,
  handler: (
    params: TInput,
    ctx: { tenantId: string; userId: string; requestId: string },
  ) => Promise<{ success: boolean; data?: TOutput }>,
): typeof handler {
  return async (params, ctx) => {
    const result = await handler(params, ctx);

    if (result.success) {
      await auditService.record({
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        action: 'execute',
        resourceType,
        resourceId: extractResourceId(result.data),
        changes: {
          after: typeof result.data === 'object' && result.data !== null
            ? result.data as Record<string, unknown>
            : undefined,
        },
        requestId: ctx.requestId,
      });
    }

    return result;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Redact sensitive fields from a changes object (before/after snapshots).
 */
function redactChanges(changes: AuditChanges): AuditChanges {
  const result: AuditChanges = {};

  if (changes.before !== undefined) {
    (result as { before: Record<string, unknown> }).before = redactFields(changes.before);
  }
  if (changes.after !== undefined) {
    (result as { after: Record<string, unknown> }).after = redactFields(changes.after);
  }

  return result;
}

/**
 * Replace values of sensitive keys with '[REDACTED]'.
 */
function redactFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key)) {
      result[key] = REDACTED_VALUE;
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Attempt to extract a resource ID from the handler result data.
 */
function extractResourceId(data: unknown): string {
  if (data !== null && typeof data === 'object' && 'id' in data) {
    return String((data as Record<string, unknown>)['id']);
  }
  return 'unknown';
}
