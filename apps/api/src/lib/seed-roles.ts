/**
 * seed-roles.ts — Seeds default RBAC roles and permissions into the DB.
 *
 * Creates the three default roles (Owner, Accountant, Approver) for a given
 * tenant and assigns the correct permission sets to each. Idempotent: skips
 * rows that already exist using ON CONFLICT DO NOTHING.
 *
 * Called during tenant provisioning and in the dev/test seed scripts.
 *
 * Architecture references:
 *   AR22  — Custom table-based RBAC
 *   FR36  — Default roles defined at tenant creation
 *
 * Tables touched (all in @neip/db schema):
 *   permissions        — global, tenant-agnostic permission definitions
 *   roles              — tenant-scoped role records
 *   role_permissions   — many-to-many join (role × permission × tenant)
 */

import type { Sql } from 'postgres';
import {
  ALL_PERMISSIONS,
  ACCOUNTANT_PERMISSIONS,
  APPROVER_PERMISSIONS,
  ROLE_OWNER,
  ROLE_ACCOUNTANT,
  ROLE_APPROVER,
  type Permission,
  type DefaultRoleName,
} from './permissions.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeedRolesResult {
  /** IDs of the three created/existing roles, keyed by role name. */
  roleIds: Record<DefaultRoleName, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure a permission row exists in the global `permissions` table.
 * Uses INSERT … ON CONFLICT DO NOTHING so it is safe to call multiple times.
 * Returns the canonical permission ID (which equals its name string).
 */
async function upsertPermission(sql: Sql, name: Permission): Promise<void> {
  await sql`
    INSERT INTO permissions (id, name, description)
    VALUES (${name}, ${name}, ${name})
    ON CONFLICT (name) DO NOTHING
  `;
}

/**
 * Ensure a role row exists for the given tenant.
 * Returns the role ID (UUIDv4) — either newly created or existing.
 */
async function upsertRole(
  sql: Sql,
  tenantId: string,
  roleName: DefaultRoleName,
): Promise<string> {
  // Attempt insert; return existing ID on conflict.
  const inserted = await sql<[{ id: string }?]>`
    INSERT INTO roles (id, name, tenant_id)
    VALUES (${crypto.randomUUID()}, ${roleName}, ${tenantId})
    ON CONFLICT (name, tenant_id) DO NOTHING
    RETURNING id
  `;

  if (inserted[0]) {
    return inserted[0].id;
  }

  // Row already existed — fetch its ID.
  const existing = await sql<[{ id: string }]>`
    SELECT id FROM roles
    WHERE name = ${roleName} AND tenant_id = ${tenantId}
    LIMIT 1
  `;

  const row = existing[0];
  if (!row) {
    throw new Error(
      `seed-roles: failed to resolve role "${roleName}" for tenant "${tenantId}"`,
    );
  }
  return row.id;
}

/**
 * Assign a permission to a role within a tenant.
 * Silently skips duplicate assignments.
 */
async function assignPermission(
  sql: Sql,
  roleId: string,
  permissionId: Permission,
  tenantId: string,
): Promise<void> {
  await sql`
    INSERT INTO role_permissions (role_id, permission_id, tenant_id)
    VALUES (${roleId}, ${permissionId}, ${tenantId})
    ON CONFLICT DO NOTHING
  `;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Seed the three default roles (Owner / Accountant / Approver) and their
 * permission assignments for the given tenant.
 *
 * Safe to call multiple times — all writes use ON CONFLICT DO NOTHING.
 *
 * @param sql      - postgres.js Sql tagged-template client from `fastify.sql`
 * @param tenantId - ID of the tenant to create roles for
 * @returns        Object containing the role IDs keyed by role name
 */
export async function seedRoles(sql: Sql, tenantId: string): Promise<SeedRolesResult> {
  // 1. Ensure all permission definitions exist in the global permissions table.
  for (const perm of ALL_PERMISSIONS) {
    await upsertPermission(sql, perm);
  }

  // 2. Create the three default roles for this tenant.
  const [ownerId, accountantId, approverId] = await Promise.all([
    upsertRole(sql, tenantId, ROLE_OWNER),
    upsertRole(sql, tenantId, ROLE_ACCOUNTANT),
    upsertRole(sql, tenantId, ROLE_APPROVER),
  ]);

  // 3. Assign permissions to each role.
  const ownerAssignments = ALL_PERMISSIONS.map((perm) =>
    assignPermission(sql, ownerId, perm, tenantId),
  );
  const accountantAssignments = ACCOUNTANT_PERMISSIONS.map((perm) =>
    assignPermission(sql, accountantId, perm, tenantId),
  );
  const approverAssignments = APPROVER_PERMISSIONS.map((perm) =>
    assignPermission(sql, approverId, perm, tenantId),
  );

  await Promise.all([...ownerAssignments, ...accountantAssignments, ...approverAssignments]);

  return {
    roleIds: {
      [ROLE_OWNER]: ownerId,
      [ROLE_ACCOUNTANT]: accountantId,
      [ROLE_APPROVER]: approverId,
    },
  };
}
