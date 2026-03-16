/**
 * GET /api/v1/organizations/:id
 *
 * Returns organization details for the authenticated user's tenant.
 * Enforces tenant isolation — users can only view their own org.
 *
 * Story 4.4 — Tenant Management
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ForbiddenError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { toISO } from '../../lib/to-iso.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const getOrgResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    settings: { type: 'object', additionalProperties: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

// ---------------------------------------------------------------------------
// DB row type
// ---------------------------------------------------------------------------

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  settings: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

// ---------------------------------------------------------------------------
// Route params
// ---------------------------------------------------------------------------

interface OrgParams {
  id: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function getOrganizationRoute(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get<{ Params: OrgParams }>(
    `${API_V1_PREFIX}/organizations/:id`,
    {
      schema: {
        description: 'Get organization details by ID',
        tags: ['tenants'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Organization UUID' },
          },
        },
        response: {
          200: {
            description: 'Organization details',
            ...getOrgResponseSchema,
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      // Enforce tenant isolation — users can only view their own org.
      if (id !== tenantId) {
        throw new ForbiddenError({
          detail: 'You can only view your own organization.',
        });
      }

      const rows = await fastify.sql<[TenantRow?]>`
        SELECT id, name, slug, settings, created_at, updated_at
        FROM tenants
        WHERE id = ${id}
        LIMIT 1
      `;

      const tenant = rows[0];
      if (!tenant) {
        throw new NotFoundError({
          detail: `Organization ${id} not found.`,
        });
      }

      return reply.status(200).send({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        settings: tenant.settings,
        createdAt: toISO(tenant.created_at),
        updatedAt: toISO(tenant.updated_at),
      });
    },
  );
}
