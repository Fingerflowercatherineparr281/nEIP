/**
 * Audit log routes — Story 2.8.
 *
 * Endpoints:
 *   GET /api/v1/audit-logs   — query audit trail with optional filters
 *
 * Access control: requires `role:read` permission (admin-level).
 *
 * Query parameters:
 *   resourceType  — filter by resource type (e.g. "invoice")
 *   resourceId    — filter by resource ID
 *   userId        — filter by acting user
 *   startDate     — ISO 8601 date string (inclusive lower bound on timestamp)
 *   endDate       — ISO 8601 date string (inclusive upper bound on timestamp)
 *   limit         — max rows to return (default 50, max 500)
 *   offset        — pagination offset (default 0)
 *
 * Response: { items: AuditLogOutput[], total: number, limit: number, offset: number }
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { API_V1_PREFIX } from '@neip/shared';
import { AuditService } from '@neip/core';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { ROLE_READ } from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON schemas
// ---------------------------------------------------------------------------

const auditLogItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    tenantId: { type: 'string' },
    action: { type: 'string' },
    resourceType: { type: 'string' },
    resourceId: { type: 'string' },
    changes: {
      oneOf: [
        {
          type: 'object',
          properties: {
            before: { type: 'object', nullable: true },
            after: { type: 'object', nullable: true },
          },
        },
        { type: 'null' },
      ],
    },
    requestId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
  },
} as const;

const queryStringSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    resourceType: { type: 'string' },
    resourceId: { type: 'string' },
    userId: { type: 'string' },
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time' },
    limit: { type: 'string', pattern: '^[0-9]+$' },
    offset: { type: 'string', pattern: '^[0-9]+$' },
  },
} as const;

const listResponseSchema = {
  type: 'object',
  properties: {
    items: { type: 'array', items: auditLogItemSchema },
    total: { type: 'integer' },
    limit: { type: 'integer' },
    offset: { type: 'integer' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditQueryString {
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: string;
  offset?: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function auditRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const auditService = new AuditService(fastify.db);

  // -------------------------------------------------------------------------
  // GET /api/v1/audit-logs — query audit trail
  // -------------------------------------------------------------------------

  fastify.get<{ Querystring: AuditQueryString }>(
    `${API_V1_PREFIX}/audit-logs`,
    {
      preHandler: [requireAuth, requirePermission(ROLE_READ)],
      schema: {
        tags: ['audit'],
        description: 'ค้นหาบันทึกการตรวจสอบพร้อมตัวกรอง — Query the audit trail with optional filters',
        summary: 'Query the audit trail with optional filters',
        security: [{ bearerAuth: [] }],
        querystring: queryStringSchema,
        response: {
          200: listResponseSchema,
        },
      },
    },
    async (request, _reply) => {
      const { tenantId } = request.user;
      const {
        resourceType,
        resourceId,
        userId,
        startDate,
        endDate,
        limit: limitStr,
        offset: offsetStr,
      } = request.query;

      const limit = Math.min(
        limitStr !== undefined ? parseInt(limitStr, 10) : 50,
        500,
      );
      const offset = offsetStr !== undefined ? parseInt(offsetStr, 10) : 0;

      const items = await auditService.query({
        tenantId,
        resourceType,
        resourceId,
        userId,
        startDate: startDate !== undefined ? new Date(startDate) : undefined,
        endDate: endDate !== undefined ? new Date(endDate) : undefined,
      });

      // Apply pagination manually — AuditService.query() returns all matching rows.
      const paged = items.slice(offset, offset + limit);

      return {
        items: paged.map((entry) => ({
          ...entry,
          timestamp: entry.timestamp.toISOString(),
        })),
        total: items.length,
        limit,
        offset,
      };
    },
  );
}
