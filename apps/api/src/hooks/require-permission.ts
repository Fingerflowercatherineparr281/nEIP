/**
 * require-permission.ts — Fastify preHandler factory for permission-based access control.
 *
 * Usage:
 *   import { requirePermission } from '../../hooks/require-permission.js';
 *
 *   fastify.post('/gl/journals', {
 *     preHandler: [requireAuth, requirePermission('gl:journal:create')],
 *   }, handler);
 *
 * Behaviour:
 *   1. Reads the authenticated user's ID and tenantId from `request.user`
 *      (populated by requireAuth / @fastify/jwt).
 *   2. Looks up the user's role permissions in the DB scoped to their tenant.
 *   3. Throws ForbiddenError (→ 403) if the required permission is absent.
 *   4. The tenant check is built into the SQL query — a user can never elevate
 *      with a role from a different tenant.
 *
 * Caching:
 *   Permission sets are cached per-request via a WeakMap keyed on the request
 *   object so that a route with multiple preHandlers only queries once.
 *
 * Architecture references:
 *   AR22  — Custom table-based RBAC
 *   FR36  — Role-based access control
 *   FR37  — Enforcement on all API routes
 */

import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { ForbiddenError } from '@neip/shared';
import type { Permission } from '../lib/permissions.js';

// ---------------------------------------------------------------------------
// Per-request permission cache
//
// WeakMap<request, Set<string>> — GC'd automatically when the request object
// is freed at the end of the request lifecycle.
// ---------------------------------------------------------------------------

const permissionCache = new WeakMap<FastifyRequest, Set<string>>();

// ---------------------------------------------------------------------------
// DB row type
// ---------------------------------------------------------------------------

interface PermissionRow {
  permission_id: string;
}

// ---------------------------------------------------------------------------
// Internal: load user's permissions from DB (with tenant isolation)
// ---------------------------------------------------------------------------

async function loadPermissions(request: FastifyRequest): Promise<Set<string>> {
  const cached = permissionCache.get(request);
  if (cached !== undefined) {
    return cached;
  }

  const { sub: userId, tenantId } = request.user;

  // Join user_roles → role_permissions → permissions, all scoped to the
  // authenticated user's tenant. Cross-tenant role elevation is impossible
  // because every join condition includes tenant_id.
  const rows = await request.server.sql<PermissionRow[]>`
    SELECT rp.permission_id
    FROM user_roles ur
    JOIN role_permissions rp
      ON rp.role_id = ur.role_id
     AND rp.tenant_id = ur.tenant_id
    WHERE ur.user_id   = ${userId}
      AND ur.tenant_id = ${tenantId}
  `;

  const perms = new Set(rows.map((r) => r.permission_id));
  permissionCache.set(request, perms);

  request.log.debug(
    { userId, tenantId, permCount: perms.size },
    'RBAC: loaded user permissions',
  );

  return perms;
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Returns a Fastify preHandler that asserts the authenticated user holds
 * `permission` within their tenant.
 *
 * Must be used **after** `requireAuth` in the preHandler chain so that
 * `request.user` is already populated.
 *
 * @param permission - One of the `Permission` string literals from permissions.ts
 */
export function requirePermission(permission: Permission): preHandlerHookHandler {
  return async function checkPermission(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const perms = await loadPermissions(request);

    if (!perms.has(permission)) {
      request.log.warn(
        {
          userId: request.user.sub,
          tenantId: request.user.tenantId,
          requiredPermission: permission,
        },
        'RBAC: permission denied',
      );

      throw new ForbiddenError({
        detail: `Permission '${permission}' is required to perform this action.`,
      });
    }
  };
}
