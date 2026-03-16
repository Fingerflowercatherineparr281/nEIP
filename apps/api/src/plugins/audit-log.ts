/**
 * Audit-log plugin — automatic mutation audit trail for every API response.
 *
 * Architecture reference: Story 2.8.
 *
 * Strategy:
 *   1. `onSend` captures the serialised response body and stores it on the
 *      request object so it remains readable after the stream is flushed.
 *   2. `onResponse` examines every completed request and, for successful
 *      mutations (POST/PUT/PATCH/DELETE on non-auth, non-health paths),
 *      fire-and-forgets an AuditService.record() call.
 *
 * Non-blocking guarantee:
 *   All audit writes are fire-and-forget (`void`). A failed write is logged
 *   at `error` level but never surfaces to the caller. This ensures audit
 *   failures are completely transparent to API consumers.
 *
 * Paths skipped:
 *   - /api/v1/auth/*        — authentication endpoints
 *   - /api/health           — health probes
 *   - GET requests          — read-only, not audited
 *   - 4xx / 5xx responses   — failed requests are not audited
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { AuditService } from '@neip/core';

// ---------------------------------------------------------------------------
// Module augmentation — decorate FastifyInstance and FastifyRequest
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyInstance {
    /** AuditService instance available for manual use in route handlers. */
    audit: AuditService;
  }

  interface FastifyRequest {
    /**
     * Captured response body payload stored by the `onSend` hook so it can
     * be read by the later `onResponse` hook.
     */
    _auditResponseBody?: unknown;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** HTTP methods that represent mutations worth auditing. */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** URL prefixes that should never be audited. */
const SKIP_PREFIXES = ['/api/v1/auth/', '/api/health'];

/** Mapping from HTTP method to a human-readable action name. */
const METHOD_TO_ACTION: Readonly<Record<string, string>> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a request should produce an audit log entry.
 *
 * Returns false for:
 *   - Non-mutation HTTP methods (GET, HEAD, OPTIONS, …)
 *   - Auth and health check paths
 *   - Responses with 4xx or 5xx status codes
 */
function shouldAudit(request: FastifyRequest, statusCode: number): boolean {
  if (!MUTATION_METHODS.has(request.method)) return false;

  for (const prefix of SKIP_PREFIXES) {
    if (request.url.startsWith(prefix)) return false;
  }

  // Only audit successful responses
  if (statusCode >= 400) return false;

  return true;
}

/**
 * Derive a lowercase, kebab-cased resource type from a URL path.
 *
 * Examples:
 *   /api/v1/invoices           → invoice
 *   /api/v1/invoices/abc-123   → invoice
 *   /api/v1/journal-entries    → journal-entry
 *   /api/v1/tax-rates/xyz      → tax-rate
 */
function resourceTypeFromUrl(url: string): string {
  // Strip query string
  const path = url.split('?')[0] ?? url;

  // Split on "/" and drop empty segments + "api" + version segment
  const segments = path.split('/').filter((s) => s !== '' && s !== 'api');

  // The first remaining segment after the version ("v1") is the resource collection
  // e.g. ["v1", "invoices", "abc-123"] → "invoices"
  const versionIndex = segments.findIndex((s) => /^v\d+$/.test(s));
  const resourceSegment =
    versionIndex !== -1 ? segments[versionIndex + 1] : segments[0];

  if (resourceSegment === undefined || resourceSegment === '') {
    return 'unknown';
  }

  // Pluralise → singular: strip trailing "s" for simple cases.
  // E.g. "invoices" → "invoice", "journal-entries" → "journal-entry"
  const singular = resourceSegment.endsWith('ies')
    ? resourceSegment.slice(0, -3) + 'y'
    : resourceSegment.endsWith('s')
    ? resourceSegment.slice(0, -1)
    : resourceSegment;

  return singular;
}

/**
 * Attempt to extract a resource ID from multiple sources in priority order:
 *
 *   1. Response body `.id` field  (most reliable for POST create)
 *   2. URL path parameter `:id`   (reliable for PUT/DELETE on /:id routes)
 *   3. Falls back to 'unknown'
 */
function extractResourceId(request: FastifyRequest, body: unknown): string {
  // 1. Response body
  if (
    body !== null &&
    typeof body === 'object' &&
    'id' in (body as Record<string, unknown>)
  ) {
    return String((body as Record<string, unknown>)['id']);
  }

  // 2. URL path — last UUID/ULID/alphanumeric segment that looks like an ID
  const path = (request.url.split('?')[0] ?? request.url);
  const segments = path.split('/').filter(Boolean);
  // Walk backwards to find the first segment that looks like an ID (not a verb/action)
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!;
    // Treat as ID if it contains a digit or is a UUID-like string and is not a verb
    if (/[0-9]/.test(seg) || seg.length > 20) {
      return seg;
    }
  }

  return 'unknown';
}

/**
 * Parse the captured body from the `onSend` payload.
 * The payload may be a string, Buffer, or null/undefined.
 */
function parseBody(payload: unknown): unknown {
  if (payload === null || payload === undefined) return undefined;

  let str: string;
  if (typeof payload === 'string') {
    str = payload;
  } else if (Buffer.isBuffer(payload)) {
    str = payload.toString('utf8');
  } else {
    return payload;
  }

  if (str.trim() === '') return undefined;

  try {
    return JSON.parse(str) as unknown;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

async function auditLogPlugin(fastify: FastifyInstance): Promise<void> {
  // Instantiate AuditService using the already-decorated Drizzle client.
  const auditService = new AuditService(fastify.db);

  // Decorate fastify so route handlers can call fastify.audit.record() manually.
  fastify.decorate('audit', auditService);

  // -------------------------------------------------------------------------
  // onSend — capture response body before it leaves the process
  //
  // We must capture here because after `onResponse` the payload stream has
  // already been consumed; reading it would return empty data.
  // -------------------------------------------------------------------------

  fastify.addHook(
    'onSend',
    (
      request: FastifyRequest,
      _reply: FastifyReply,
      payload: unknown,
      done: (err?: Error | null, payload?: unknown) => void,
    ) => {
      // Only capture for mutation methods we care about — avoids storing large
      // GET list payloads in memory unnecessarily.
      if (MUTATION_METHODS.has(request.method)) {
        request._auditResponseBody = parseBody(payload);
      }
      done(null, payload);
    },
  );

  // -------------------------------------------------------------------------
  // onResponse — write the audit log entry after the response has been sent
  //
  // This runs after the response has been fully flushed to the client.
  // Any error here must never propagate — the response is already sent.
  // -------------------------------------------------------------------------

  fastify.addHook(
    'onResponse',
    (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
      const statusCode = reply.statusCode;

      if (!shouldAudit(request, statusCode)) {
        done();
        return;
      }

      // Extract identity — require both userId and tenantId for a useful entry.
      const userId = request.user?.sub;
      const tenantId = request.user?.tenantId;

      if (userId === undefined || tenantId === undefined) {
        done();
        return;
      }

      const body = request._auditResponseBody;
      const action = METHOD_TO_ACTION[request.method] ?? request.method.toLowerCase();
      const resourceType = resourceTypeFromUrl(request.url);
      const resourceId = extractResourceId(request, body);

      // Build the changes snapshot — for DELETE we record nothing after,
      // for create/update we store the response body as `after`.
      const changes =
        action === 'delete'
          ? undefined
          : body !== undefined
          ? { after: body as Record<string, unknown> }
          : undefined;

      // Fire-and-forget — do NOT await, do NOT let errors surface.
      void auditService
        .record({
          userId,
          tenantId,
          action,
          resourceType,
          resourceId,
          changes,
          requestId: request.id,
        })
        .catch((err: unknown) => {
          request.log.error(
            { err, requestId: request.id, url: request.url },
            'audit-log: failed to write audit entry',
          );
        });

      done();
    },
  );
}

export default fp(auditLogPlugin, {
  fastify: '5.x',
  name: 'audit-log',
  // Must run after the DB decorator is applied (handled by registration order in app.ts)
  dependencies: [],
});
