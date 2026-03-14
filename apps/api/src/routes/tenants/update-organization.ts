/**
 * PUT /api/v1/organizations/:id
 *
 * Updates organization name and settings.
 * Requires Owner role. Enforces tenant isolation.
 *
 * Story 4.4 — Tenant Management
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ForbiddenError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { USER_UPDATE } from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const updateOrgBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Organization display name',
    },
    businessType: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Business type',
    },
  },
} as const;

const updateOrgResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    settings: { type: 'object', additionalProperties: true },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgParams {
  id: string;
}

interface UpdateOrgBody {
  name?: string;
  businessType?: string;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  settings: unknown;
  updated_at: Date;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function updateOrganizationRoute(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.put<{ Params: OrgParams; Body: UpdateOrgBody }>(
    `${API_V1_PREFIX}/organizations/:id`,
    {
      schema: {
        description: 'Update organization settings',
        tags: ['tenants'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: updateOrgBodySchema,
        response: {
          200: {
            description: 'Organization updated',
            ...updateOrgResponseSchema,
          },
        },
      },
      preHandler: [requireAuth, requirePermission(USER_UPDATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      if (id !== tenantId) {
        throw new ForbiddenError({
          detail: 'You can only update your own organization.',
        });
      }

      const { name, businessType } = request.body;

      // Build SET clause dynamically based on provided fields.
      // For simplicity, update settings JSON if businessType is given.
      let row: TenantRow | undefined;

      if (name !== undefined && businessType !== undefined) {
        const rows = await fastify.sql<[TenantRow?]>`
          UPDATE tenants
          SET name = ${name},
              settings = jsonb_set(COALESCE(settings, '{}')::jsonb, '{businessType}', ${JSON.stringify(businessType)}::jsonb),
              updated_at = NOW()
          WHERE id = ${id}
          RETURNING id, name, slug, settings, updated_at
        `;
        row = rows[0];
      } else if (name !== undefined) {
        const rows = await fastify.sql<[TenantRow?]>`
          UPDATE tenants SET name = ${name}, updated_at = NOW()
          WHERE id = ${id}
          RETURNING id, name, slug, settings, updated_at
        `;
        row = rows[0];
      } else if (businessType !== undefined) {
        const rows = await fastify.sql<[TenantRow?]>`
          UPDATE tenants
          SET settings = jsonb_set(COALESCE(settings, '{}')::jsonb, '{businessType}', ${JSON.stringify(businessType)}::jsonb),
              updated_at = NOW()
          WHERE id = ${id}
          RETURNING id, name, slug, settings, updated_at
        `;
        row = rows[0];
      } else {
        // No fields to update — just return current state.
        const rows = await fastify.sql<[TenantRow?]>`
          SELECT id, name, slug, settings, updated_at FROM tenants WHERE id = ${id} LIMIT 1
        `;
        row = rows[0];
      }

      if (!row) {
        throw new NotFoundError({
          detail: `Organization ${id} not found.`,
        });
      }

      request.log.info(
        { tenantId: id, updatedBy: request.user.sub },
        'Organization updated',
      );

      return reply.status(200).send({
        id: row.id,
        name: row.name,
        slug: row.slug,
        settings: row.settings,
        updatedAt: row.updated_at.toISOString(),
      });
    },
  );
}
