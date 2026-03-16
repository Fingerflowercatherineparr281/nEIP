/**
 * Firm routes barrel — registers all /api/v1/firm/* routes.
 *
 * Routes:
 *   POST   /api/v1/firm/clients      — assign client org to firm user
 *   GET    /api/v1/firm/clients      — list firm's client organizations
 *   DELETE /api/v1/firm/clients/:id  — unassign client org
 *
 * Story: 12.2
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { API_V1_PREFIX, ConflictError } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { toISO } from '../../lib/to-iso.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const assignClientBodySchema = {
  type: 'object',
  required: ['clientTenantId'],
  additionalProperties: false,
  properties: {
    clientTenantId: {
      type: 'string',
      description: 'The tenant ID of the client organization to assign',
    },
    label: {
      type: 'string',
      maxLength: 255,
      description: 'Optional display label for the client',
    },
  },
} as const;

const assignClientResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    firmTenantId: { type: 'string' },
    clientTenantId: { type: 'string' },
    label: { type: 'string', nullable: true },
    status: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const listClientsResponseSchema = {
  type: 'object',
  properties: {
    clients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          clientTenantId: { type: 'string' },
          clientName: { type: 'string' },
          label: { type: 'string', nullable: true },
          status: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    total: { type: 'integer' },
  },
} as const;

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface AssignClientBody {
  clientTenantId: string;
  label?: string;
}

interface UnassignParams {
  id: string;
}

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface AssignmentRow {
  id: string;
  firm_tenant_id: string;
  client_tenant_id: string;
  label: string | null;
  status: string;
  created_at: Date | string;
}

interface ClientListRow {
  id: string;
  client_tenant_id: string;
  client_name: string;
  label: string | null;
  status: string;
  created_at: Date | string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function firmRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // POST /api/v1/firm/clients — assign client org to firm
  fastify.post<{ Body: AssignClientBody }>(
    `${API_V1_PREFIX}/firm/clients`,
    {
      schema: {
        description: 'Assign a client organization to this firm',
        tags: ['tenants'],
        security: [{ bearerAuth: [] }],
        body: assignClientBodySchema,
        response: {
          201: {
            description: 'Client assigned successfully',
            ...assignClientResponseSchema,
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { clientTenantId, label } = request.body;
      const firmTenantId = request.user.tenantId;
      const userId = request.user.sub;

      // Verify the client tenant exists
      const clientRows = await fastify.sql<[{ id: string }?]>`
        SELECT id FROM tenants WHERE id = ${clientTenantId} LIMIT 1
      `;

      if (!clientRows[0]) {
        return reply.status(404).send({
          type: 'https://problems.neip.app/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Client organization ${clientTenantId} not found.`,
        });
      }

      // Prevent self-assignment
      if (clientTenantId === firmTenantId) {
        return reply.status(400).send({
          type: 'https://problems.neip.app/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: 'Cannot assign your own organization as a client.',
        });
      }

      // Check for existing assignment
      const existingRows = await fastify.sql<[{ id: string }?]>`
        SELECT id FROM firm_client_assignments
        WHERE firm_tenant_id = ${firmTenantId}
          AND client_tenant_id = ${clientTenantId}
        LIMIT 1
      `;

      if (existingRows[0]) {
        throw new ConflictError({
          detail: `Client organization ${clientTenantId} is already assigned to this firm.`,
        });
      }

      const assignmentId = crypto.randomUUID();

      const rows = await fastify.sql<[AssignmentRow?]>`
        INSERT INTO firm_client_assignments (id, firm_tenant_id, client_tenant_id, assigned_by, label, status)
        VALUES (${assignmentId}, ${firmTenantId}, ${clientTenantId}, ${userId}, ${label ?? null}, 'active')
        RETURNING id, firm_tenant_id, client_tenant_id, label, status, created_at
      `;

      const assignment = rows[0];
      if (!assignment) {
        throw new Error('Failed to create assignment — no row returned.');
      }

      request.log.info(
        { assignmentId, firmTenantId, clientTenantId, assignedBy: userId },
        'Client organization assigned to firm',
      );

      return reply.status(201).send({
        id: assignment.id,
        firmTenantId: assignment.firm_tenant_id,
        clientTenantId: assignment.client_tenant_id,
        label: assignment.label,
        status: assignment.status,
        createdAt: toISO(assignment.created_at),
      });
    },
  );

  // GET /api/v1/firm/clients — list firm's client organizations
  fastify.get(
    `${API_V1_PREFIX}/firm/clients`,
    {
      schema: {
        description: "List all client organizations assigned to this firm",
        tags: ['tenants'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'Client list',
            ...listClientsResponseSchema,
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const firmTenantId = request.user.tenantId;

      const rows = await fastify.sql<ClientListRow[]>`
        SELECT
          fca.id,
          fca.client_tenant_id,
          t.name AS client_name,
          fca.label,
          fca.status,
          fca.created_at
        FROM firm_client_assignments fca
        JOIN tenants t ON t.id = fca.client_tenant_id
        WHERE fca.firm_tenant_id = ${firmTenantId}
          AND fca.status = 'active'
        ORDER BY t.name ASC
      `;

      return reply.status(200).send({
        clients: rows.map((r) => ({
          id: r.id,
          clientTenantId: r.client_tenant_id,
          clientName: r.client_name,
          label: r.label,
          status: r.status,
          createdAt: toISO(r.created_at),
        })),
        total: rows.length,
      });
    },
  );

  // DELETE /api/v1/firm/clients/:id — unassign client org
  fastify.delete<{ Params: UnassignParams }>(
    `${API_V1_PREFIX}/firm/clients/:id`,
    {
      schema: {
        description: 'Unassign a client organization from this firm',
        tags: ['tenants'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          204: {
            description: 'Client unassigned successfully',
            type: 'null',
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const firmTenantId = request.user.tenantId;

      // Soft-delete: set status to inactive (preserves audit trail)
      const result = await fastify.sql`
        UPDATE firm_client_assignments
        SET status = 'inactive', updated_at = NOW()
        WHERE id = ${id}
          AND firm_tenant_id = ${firmTenantId}
          AND status = 'active'
      `;

      if (result.count === 0) {
        return reply.status(404).send({
          type: 'https://problems.neip.app/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Assignment ${id} not found or already inactive.`,
        });
      }

      request.log.info(
        { assignmentId: id, firmTenantId },
        'Client organization unassigned from firm',
      );

      return reply.status(204).send();
    },
  );
}
