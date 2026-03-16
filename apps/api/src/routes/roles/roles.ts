/**
 * Role management routes:
 *   POST   /api/v1/roles      — create custom role
 *   GET    /api/v1/roles      — list roles
 *   PUT    /api/v1/roles/:id  — update role permissions
 *   DELETE /api/v1/roles/:id  — delete custom role
 *
 * Story 13.2 — Enhanced RBAC: Custom Permissions
 *
 * Default roles (Owner, Accountant, Approver) cannot be deleted.
 * Custom roles support arbitrary permission sets using the resource:action format.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  API_V1_PREFIX,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { toISO } from '../../lib/to-iso.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { ROLE_ASSIGN, ROLE_READ } from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ROLE_NAMES = new Set(['Owner', 'Accountant', 'Approver']);

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const roleResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    tenantId: { type: 'string' },
    permissions: { type: 'array', items: { type: 'string' } },
    isDefault: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const createRoleBodySchema = {
  type: 'object',
  required: ['name', 'permissions'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    permissions: {
      type: 'array',
      items: { type: 'string', pattern: '^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)?$' },
      minItems: 1,
    },
  },
} as const;

const updateRoleBodySchema = {
  type: 'object',
  required: ['permissions'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    permissions: {
      type: 'array',
      items: { type: 'string', pattern: '^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)?$' },
      minItems: 1,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateRoleBody {
  name: string;
  permissions: string[];
}

interface UpdateRoleBody {
  name?: string;
  permissions: string[];
}

interface RoleParams {
  id: string;
}

interface RoleRow {
  id: string;
  name: string;
  tenant_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PermissionRow {
  permission_id: string;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function roleRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // -----------------------------------------------------------------------
  // POST /api/v1/roles — create custom role
  // -----------------------------------------------------------------------

  fastify.post<{ Body: CreateRoleBody }>(
    `${API_V1_PREFIX}/roles`,
    {
      preHandler: [requireAuth, requirePermission(ROLE_ASSIGN)],
      schema: {
        tags: ['roles'],
        description: 'สร้างบทบาทที่กำหนดเองพร้อมชุดสิทธิ์ — Create a custom role with a set of permissions',
        summary: 'Create a custom role with permissions',
        body: createRoleBodySchema,
        response: {
          201: roleResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { name, permissions } = request.body;

      // Check for duplicate name
      const existing = await fastify.sql<RoleRow[]>`
        SELECT id FROM roles
        WHERE name = ${name} AND tenant_id = ${tenantId}
        LIMIT 1
      `;

      if (existing.length > 0) {
        throw new ConflictError({
          detail: `Role "${name}" already exists in this tenant.`,
        });
      }

      const roleId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      // Insert the role
      await fastify.sql`
        INSERT INTO roles (id, name, tenant_id)
        VALUES (${roleId}, ${name}, ${tenantId})
      `;

      // Insert role_permissions — ensure each permission exists
      for (const permId of permissions) {
        // Upsert permission if it doesn't exist
        await fastify.sql`
          INSERT INTO permissions (id, name, description)
          VALUES (${permId}, ${permId}, ${'Custom permission: ' + permId})
          ON CONFLICT (id) DO NOTHING
        `;

        await fastify.sql`
          INSERT INTO role_permissions (role_id, permission_id, tenant_id)
          VALUES (${roleId}, ${permId}, ${tenantId})
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `;
      }

      return reply.status(201).send({
        id: roleId,
        name,
        tenantId,
        permissions,
        isDefault: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/v1/roles — list roles
  // -----------------------------------------------------------------------

  fastify.get(
    `${API_V1_PREFIX}/roles`,
    {
      preHandler: [requireAuth, requirePermission(ROLE_READ)],
      schema: {
        tags: ['roles'],
        description: 'รายการบทบาทและสิทธิ์ทั้งหมดของ tenant — List all roles and their permissions for the tenant',
        summary: 'List all roles for the tenant',
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: roleResponseSchema,
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const { tenantId } = request.user;

      const roleRows = await fastify.sql<RoleRow[]>`
        SELECT id, name, tenant_id, created_at, updated_at
        FROM roles
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at ASC
      `;

      const data = [];

      for (const role of roleRows) {
        const permRows = await fastify.sql<PermissionRow[]>`
          SELECT permission_id
          FROM role_permissions
          WHERE role_id = ${role.id} AND tenant_id = ${tenantId}
        `;

        data.push({
          id: role.id,
          name: role.name,
          tenantId: role.tenant_id,
          permissions: permRows.map((r) => r.permission_id),
          isDefault: DEFAULT_ROLE_NAMES.has(role.name),
          createdAt: toISO(role.created_at),
          updatedAt: toISO(role.updated_at),
        });
      }

      return { data };
    },
  );

  // -----------------------------------------------------------------------
  // PUT /api/v1/roles/:id — update role permissions
  // -----------------------------------------------------------------------

  fastify.put<{ Params: RoleParams; Body: UpdateRoleBody }>(
    `${API_V1_PREFIX}/roles/:id`,
    {
      preHandler: [requireAuth, requirePermission(ROLE_ASSIGN)],
      schema: {
        tags: ['roles'],
        description: 'อัปเดตสิทธิ์ของบทบาท — Update the permissions assigned to a role',
        summary: 'Update role permissions',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: updateRoleBodySchema,
        response: {
          200: roleResponseSchema,
        },
      },
    },
    async (request, _reply) => {
      const { tenantId } = request.user;
      const { id } = request.params;
      const { name, permissions } = request.body;

      // Verify role exists and belongs to tenant
      const roleRows = await fastify.sql<RoleRow[]>`
        SELECT id, name, tenant_id, created_at, updated_at
        FROM roles
        WHERE id = ${id} AND tenant_id = ${tenantId}
        LIMIT 1
      `;

      if (roleRows.length === 0) {
        throw new NotFoundError({
          detail: `Role ${id} not found.`,
        });
      }

      const role = roleRows[0]!;
      const finalName = name ?? role.name;
      const nowIso = new Date().toISOString();

      // Update role
      await fastify.sql`
        UPDATE roles
        SET name = ${finalName}, updated_at = NOW()
        WHERE id = ${id}
      `;

      // Replace permissions: delete existing, insert new
      await fastify.sql`
        DELETE FROM role_permissions
        WHERE role_id = ${id} AND tenant_id = ${tenantId}
      `;

      for (const permId of permissions) {
        await fastify.sql`
          INSERT INTO permissions (id, name, description)
          VALUES (${permId}, ${permId}, ${'Custom permission: ' + permId})
          ON CONFLICT (id) DO NOTHING
        `;

        await fastify.sql`
          INSERT INTO role_permissions (role_id, permission_id, tenant_id)
          VALUES (${id}, ${permId}, ${tenantId})
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `;
      }

      return {
        id,
        name: finalName,
        tenantId,
        permissions,
        isDefault: DEFAULT_ROLE_NAMES.has(finalName),
        createdAt: toISO(role.created_at),
        updatedAt: nowIso,
      };
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /api/v1/roles/:id — delete custom role
  // -----------------------------------------------------------------------

  fastify.delete<{ Params: RoleParams }>(
    `${API_V1_PREFIX}/roles/:id`,
    {
      preHandler: [requireAuth, requirePermission(ROLE_ASSIGN)],
      schema: {
        tags: ['roles'],
        description: 'ลบบทบาทที่กำหนดเอง (บทบาทเริ่มต้นไม่สามารถลบได้) — Delete a custom role (default roles cannot be deleted)',
        summary: 'Delete a custom role (default roles cannot be deleted)',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params;

      // Verify role exists
      const roleRows = await fastify.sql<RoleRow[]>`
        SELECT id, name, tenant_id, created_at, updated_at
        FROM roles
        WHERE id = ${id} AND tenant_id = ${tenantId}
        LIMIT 1
      `;

      if (roleRows.length === 0) {
        throw new NotFoundError({
          detail: `Role ${id} not found.`,
        });
      }

      const role = roleRows[0]!;

      // Prevent deletion of default roles
      if (DEFAULT_ROLE_NAMES.has(role.name)) {
        throw new ForbiddenError({
          detail: `Default role "${role.name}" cannot be deleted.`,
        });
      }

      // RBAC-006: Prevent deletion of roles that have users assigned
      const userRows = await fastify.sql<{ user_id: string }[]>`
        SELECT user_id FROM user_roles
        WHERE role_id = ${id} AND tenant_id = ${tenantId}
        LIMIT 1
      `;
      if (userRows.length > 0) {
        throw new ConflictError({
          detail: `Role "${role.name}" cannot be deleted because it has users assigned.`,
        });
      }

      // Delete role_permissions first, then the role
      await fastify.sql`
        DELETE FROM role_permissions
        WHERE role_id = ${id} AND tenant_id = ${tenantId}
      `;

      await fastify.sql`
        DELETE FROM roles
        WHERE id = ${id} AND tenant_id = ${tenantId}
      `;

      return reply.status(204).send();
    },
  );
}
