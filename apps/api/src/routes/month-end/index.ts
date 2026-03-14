/**
 * Month-end close routes barrel — registers all /api/v1/month-end/* routes.
 *
 * Routes:
 *   POST /api/v1/month-end/close     — initiate month-end close (queue job)
 *   GET  /api/v1/month-end/:jobId    — check progress/results
 *
 * Story: 12.1
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const closeBodySchema = {
  type: 'object',
  required: ['fiscalYear', 'fiscalPeriod'],
  additionalProperties: false,
  properties: {
    fiscalYear: {
      type: 'integer',
      minimum: 2000,
      maximum: 2100,
      description: 'Fiscal year number (e.g. 2025)',
    },
    fiscalPeriod: {
      type: 'integer',
      minimum: 1,
      maximum: 12,
      description: 'Fiscal period within the year (1-12)',
    },
  },
} as const;

const closeResponseSchema = {
  type: 'object',
  properties: {
    jobId: { type: 'string' },
    status: { type: 'string' },
    message: { type: 'string' },
  },
} as const;

const jobStatusResponseSchema = {
  type: 'object',
  properties: {
    jobId: { type: 'string' },
    state: { type: 'string' },
    data: { type: 'object', additionalProperties: true },
    createdOn: { type: 'string', format: 'date-time' },
    completedOn: { type: 'string', format: 'date-time', nullable: true },
  },
} as const;

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface CloseBody {
  fiscalYear: number;
  fiscalPeriod: number;
}

interface JobStatusParams {
  jobId: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function monthEndRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // POST /api/v1/month-end/close — initiate month-end close
  fastify.post<{ Body: CloseBody }>(
    `${API_V1_PREFIX}/month-end/close`,
    {
      schema: {
        description: 'Initiate a month-end close process by queuing a background job',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        body: closeBodySchema,
        response: {
          202: {
            description: 'Month-end close job queued',
            ...closeResponseSchema,
          },
        },
      },
      preHandler: [requireAuth, requirePermission('gl:period:close')],
    },
    async (request, reply) => {
      const { fiscalYear, fiscalPeriod } = request.body;
      const userId = request.user.sub;
      const tenantId = request.user.tenantId;
      const correlationId = request.id;

      // Verify the fiscal period exists and is currently open
      const periodRows = await fastify.sql<[{ id: string; status: string }?]>`
        SELECT fp.id, fp.status
        FROM fiscal_periods fp
        JOIN fiscal_years fy ON fy.id = fp.fiscal_year_id
        WHERE fy.tenant_id = ${tenantId}
          AND fy.year = ${fiscalYear}
          AND fp.period_number = ${fiscalPeriod}
        LIMIT 1
      `;

      const period = periodRows[0];
      if (!period) {
        return reply.status(404).send({
          type: 'https://problems.neip.app/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Fiscal period ${fiscalPeriod} of year ${fiscalYear} not found.`,
        });
      }

      if (period.status === 'closed') {
        return reply.status(409).send({
          type: 'https://problems.neip.app/conflict',
          title: 'Conflict',
          status: 409,
          detail: `Fiscal period ${fiscalPeriod} of year ${fiscalYear} is already closed.`,
        });
      }

      // Queue the month-end close job via pg-boss
      // In production, we would call boss.send() here. For now, we store
      // a job record and let the worker pick it up.
      const jobId = crypto.randomUUID();

      // Insert a job tracking record
      await fastify.sql`
        INSERT INTO domain_events (id, tenant_id, event_type, payload, created_at)
        VALUES (
          ${jobId},
          ${tenantId},
          ${'month-end.close.queued'},
          ${JSON.stringify({
            fiscalYear,
            fiscalPeriod,
            initiatedBy: userId,
            correlationId,
            tenantId,
          })},
          NOW()
        )
      `;

      request.log.info(
        { jobId, tenantId, fiscalYear, fiscalPeriod, initiatedBy: userId },
        'Month-end close job queued',
      );

      return reply.status(202).send({
        jobId,
        status: 'queued',
        message: `Month-end close for period ${fiscalPeriod}/${fiscalYear} has been queued.`,
      });
    },
  );

  // GET /api/v1/month-end/:jobId — check job progress/results
  fastify.get<{ Params: JobStatusParams }>(
    `${API_V1_PREFIX}/month-end/:jobId`,
    {
      schema: {
        description: 'Check the progress and results of a month-end close job',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['jobId'],
          properties: {
            jobId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Job status and results',
            ...jobStatusResponseSchema,
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { jobId } = request.params;
      const tenantId = request.user.tenantId;

      // Look up the job tracking record
      const eventRows = await fastify.sql<[{
        id: string;
        event_type: string;
        payload: unknown;
        created_at: Date;
      }?]>`
        SELECT id, event_type, payload, created_at
        FROM domain_events
        WHERE id = ${jobId}
          AND tenant_id = ${tenantId}
        LIMIT 1
      `;

      const event = eventRows[0];
      if (!event) {
        return reply.status(404).send({
          type: 'https://problems.neip.app/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Job ${jobId} not found.`,
        });
      }

      // Check for completion event
      const completionRows = await fastify.sql<[{
        id: string;
        payload: unknown;
        created_at: Date;
      }?]>`
        SELECT id, payload, created_at
        FROM domain_events
        WHERE event_type = ${'month-end.close.completed'}
          AND tenant_id = ${tenantId}
          AND (payload::jsonb ->> 'jobId') = ${jobId}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const completion = completionRows[0];

      if (completion) {
        return reply.status(200).send({
          jobId,
          state: 'completed',
          data: completion.payload,
          createdOn: event.created_at.toISOString(),
          completedOn: completion.created_at.toISOString(),
        });
      }

      // Check for error event
      const errorRows = await fastify.sql<[{
        id: string;
        payload: unknown;
        created_at: Date;
      }?]>`
        SELECT id, payload, created_at
        FROM domain_events
        WHERE event_type = ${'month-end.close.failed'}
          AND tenant_id = ${tenantId}
          AND (payload::jsonb ->> 'jobId') = ${jobId}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const errorEvent = errorRows[0];

      if (errorEvent) {
        return reply.status(200).send({
          jobId,
          state: 'failed',
          data: errorEvent.payload,
          createdOn: event.created_at.toISOString(),
          completedOn: errorEvent.created_at.toISOString(),
        });
      }

      // Still in progress
      return reply.status(200).send({
        jobId,
        state: 'processing',
        data: event.payload,
        createdOn: event.created_at.toISOString(),
      });
    },
  );
}
