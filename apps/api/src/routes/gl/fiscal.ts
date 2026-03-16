/**
 * Fiscal Year and Period routes:
 *   GET  /api/v1/fiscal-years           — list fiscal years
 *   POST /api/v1/fiscal-years           — create fiscal year
 *   POST /api/v1/fiscal-periods/:id/close  — close period
 *   POST /api/v1/fiscal-periods/:id/reopen — reopen period
 *
 * Story 4.5a — GL + CoA + Fiscal API Routes
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ConflictError, ValidationError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { toISO } from '../../lib/to-iso.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { GL_PERIOD_READ, GL_PERIOD_CLOSE } from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const fiscalYearResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    year: { type: 'integer' },
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    periods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          periodNumber: { type: 'integer' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['open', 'closed'] },
        },
      },
    },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const createFiscalYearBodySchema = {
  type: 'object',
  required: ['year', 'startDate', 'endDate'],
  additionalProperties: false,
  properties: {
    year: { type: 'integer', minimum: 2000, maximum: 2100 },
    startDate: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
    endDate: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
  },
} as const;

const periodResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    periodNumber: { type: 'integer' },
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    status: { type: 'string', enum: ['open', 'closed'] },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateFiscalYearBody {
  year: number;
  startDate: string;
  endDate: string;
}

interface IdParams {
  id: string;
}

interface FiscalYearRow {
  id: string;
  year: number;
  start_date: string;
  end_date: string;
  status: string;
  tenant_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface FiscalPeriodRow {
  id: string;
  fiscal_year_id: string;
  period_number: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function fiscalRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // GET /api/v1/fiscal-years
  fastify.get(
    `${API_V1_PREFIX}/fiscal-years`,
    {
      schema: {
        description: 'List fiscal years for the current tenant',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'List of fiscal years with periods',
            type: 'object',
            properties: {
              items: { type: 'array', items: fiscalYearResponseSchema },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(GL_PERIOD_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;

      const fiscalYears = await fastify.sql<FiscalYearRow[]>`
        SELECT * FROM fiscal_years WHERE tenant_id = ${tenantId} ORDER BY year DESC
      `;

      const items = [];
      for (const fy of fiscalYears) {
        const periods = await fastify.sql<FiscalPeriodRow[]>`
          SELECT * FROM fiscal_periods WHERE fiscal_year_id = ${fy.id} ORDER BY period_number ASC
        `;

        items.push({
          id: fy.id,
          year: fy.year,
          startDate: fy.start_date,
          endDate: fy.end_date,
          periods: periods.map((p) => ({
            id: p.id,
            periodNumber: p.period_number,
            startDate: p.start_date,
            endDate: p.end_date,
            status: p.status,
          })),
          createdAt: toISO(fy.created_at),
        });
      }

      return reply.status(200).send({ items });
    },
  );

  // POST /api/v1/fiscal-years
  fastify.post<{ Body: CreateFiscalYearBody }>(
    `${API_V1_PREFIX}/fiscal-years`,
    {
      schema: {
        description: 'Create a new fiscal year with 12 monthly periods',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        body: createFiscalYearBodySchema,
        response: { 201: { description: 'Fiscal year created', ...fiscalYearResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(GL_PERIOD_CLOSE)],
    },
    async (request, reply) => {
      const { year, startDate, endDate } = request.body;
      const { tenantId } = request.user;

      // Check for duplicate year.
      const existing = await fastify.sql<[{ id: string }?]>`
        SELECT id FROM fiscal_years WHERE tenant_id = ${tenantId} AND year = ${year} LIMIT 1
      `;
      if (existing.length > 0) {
        throw new ConflictError({
          detail: `Fiscal year ${year} already exists for this organization.`,
        });
      }

      const fyId = crypto.randomUUID();
      const fyRows = await fastify.sql<[FiscalYearRow?]>`
        INSERT INTO fiscal_years (id, year, start_date, end_date, tenant_id)
        VALUES (${fyId}, ${year}, ${startDate}, ${endDate}, ${tenantId})
        RETURNING *
      `;
      const fy = fyRows[0];
      if (!fy) {
        throw new Error('Failed to create fiscal year.');
      }

      // Auto-generate 12 monthly periods.
      const start = new Date(startDate);
      const createdPeriods: Array<{
        id: string;
        periodNumber: number;
        startDate: string;
        endDate: string;
        status: string;
      }> = [];

      for (let i = 0; i < 12; i++) {
        const periodId = crypto.randomUUID();
        const periodStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const periodEnd = new Date(start.getFullYear(), start.getMonth() + i + 1, 0);

        await fastify.sql`
          INSERT INTO fiscal_periods (id, fiscal_year_id, period_number, start_date, end_date, status)
          VALUES (${periodId}, ${fyId}, ${i + 1}, ${periodStart.toISOString().slice(0, 10)}, ${periodEnd.toISOString().slice(0, 10)}, 'open')
        `;

        createdPeriods.push({
          id: periodId,
          periodNumber: i + 1,
          startDate: periodStart.toISOString().slice(0, 10),
          endDate: periodEnd.toISOString().slice(0, 10),
          status: 'open',
        });
      }

      request.log.info({ fyId, year, tenantId }, 'Fiscal year created');

      return reply.status(201).send({
        id: fy.id,
        year: fy.year,
        startDate: fy.start_date,
        endDate: fy.end_date,
        periods: createdPeriods,
        createdAt: toISO(fy.created_at),
      });
    },
  );

  // POST /api/v1/fiscal-periods/:id/close
  fastify.post<{ Params: IdParams }>(
    `${API_V1_PREFIX}/fiscal-periods/:id/close`,
    {
      schema: {
        description: 'Close a fiscal period (blocks new journal postings to this period)',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: { 200: { description: 'Period closed', ...periodResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(GL_PERIOD_CLOSE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      // Verify the period belongs to this tenant via fiscal_year.
      const rows = await fastify.sql<[FiscalPeriodRow?]>`
        UPDATE fiscal_periods fp
        SET status = 'closed', updated_at = NOW()
        FROM fiscal_years fy
        WHERE fp.id = ${id}
          AND fp.fiscal_year_id = fy.id
          AND fy.tenant_id = ${tenantId}
          AND fp.status = 'open'
        RETURNING fp.*
      `;

      const period = rows[0];
      if (!period) {
        // Check existence.
        const existing = await fastify.sql<[{ id: string; status: string }?]>`
          SELECT fp.id, fp.status FROM fiscal_periods fp
          JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
          WHERE fp.id = ${id} AND fy.tenant_id = ${tenantId}
          LIMIT 1
        `;
        if (!existing[0]) {
          throw new NotFoundError({ detail: `Fiscal period ${id} not found.` });
        }
        throw new ValidationError({
          detail: `Period ${id} is already closed.`,
        });
      }

      request.log.info({ periodId: id, tenantId }, 'Fiscal period closed');

      return reply.status(200).send({
        id: period.id,
        periodNumber: period.period_number,
        startDate: period.start_date,
        endDate: period.end_date,
        status: period.status,
        updatedAt: toISO(period.updated_at),
      });
    },
  );

  // POST /api/v1/fiscal-periods/:id/reopen
  fastify.post<{ Params: IdParams }>(
    `${API_V1_PREFIX}/fiscal-periods/:id/reopen`,
    {
      schema: {
        description: 'Reopen a closed fiscal period',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: { 200: { description: 'Period reopened', ...periodResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(GL_PERIOD_CLOSE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const rows = await fastify.sql<[FiscalPeriodRow?]>`
        UPDATE fiscal_periods fp
        SET status = 'open', updated_at = NOW()
        FROM fiscal_years fy
        WHERE fp.id = ${id}
          AND fp.fiscal_year_id = fy.id
          AND fy.tenant_id = ${tenantId}
          AND fp.status = 'closed'
        RETURNING fp.*
      `;

      const period = rows[0];
      if (!period) {
        const existing = await fastify.sql<[{ id: string; status: string }?]>`
          SELECT fp.id, fp.status FROM fiscal_periods fp
          JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
          WHERE fp.id = ${id} AND fy.tenant_id = ${tenantId}
          LIMIT 1
        `;
        if (!existing[0]) {
          throw new NotFoundError({ detail: `Fiscal period ${id} not found.` });
        }
        throw new ValidationError({
          detail: `Period ${id} is already open.`,
        });
      }

      request.log.info({ periodId: id, tenantId }, 'Fiscal period reopened');

      return reply.status(200).send({
        id: period.id,
        periodNumber: period.period_number,
        startDate: period.start_date,
        endDate: period.end_date,
        status: period.status,
        updatedAt: toISO(period.updated_at),
      });
    },
  );

  // POST /api/v1/fiscal-years/:id/close
  fastify.post<{ Params: IdParams }>(
    `${API_V1_PREFIX}/fiscal-years/:id/close`,
    {
      schema: {
        description: 'Close a fiscal year (requires all periods to be closed)',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: { 200: { description: 'Fiscal year closed', ...fiscalYearResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(GL_PERIOD_CLOSE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      // Check fiscal year exists and belongs to tenant
      const fyRows = await fastify.sql<[FiscalYearRow?]>`
        SELECT * FROM fiscal_years WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      const fy = fyRows[0];
      if (!fy) {
        throw new NotFoundError({ detail: `Fiscal year ${id} not found.` });
      }

      // Check for open periods
      const openPeriods = await fastify.sql<[{ count: string }?]>`
        SELECT count(*)::text as count FROM fiscal_periods
        WHERE fiscal_year_id = ${id} AND status = 'open'
      `;
      const openCount = parseInt(openPeriods[0]?.count ?? '0', 10);
      if (openCount > 0) {
        throw new ConflictError({
          detail: `Cannot close fiscal year — there are still ${String(openCount)} open periods.`,
        });
      }

      // Close the year
      const updatedRows = await fastify.sql<[FiscalYearRow?]>`
        UPDATE fiscal_years SET status = 'closed', updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;
      const updated = updatedRows[0];
      if (!updated) throw new NotFoundError({ detail: `Fiscal year ${id} not found.` });

      const periods = await fastify.sql<FiscalPeriodRow[]>`
        SELECT * FROM fiscal_periods WHERE fiscal_year_id = ${id} ORDER BY period_number ASC
      `;

      request.log.info({ fiscalYearId: id, tenantId }, 'Fiscal year closed');

      return reply.status(200).send({
        id: updated.id,
        year: updated.year,
        startDate: updated.start_date,
        endDate: updated.end_date,
        periods: periods.map((p) => ({
          id: p.id,
          periodNumber: p.period_number,
          startDate: p.start_date,
          endDate: p.end_date,
          status: p.status,
        })),
        createdAt: toISO(updated.created_at),
      });
    },
  );
}
