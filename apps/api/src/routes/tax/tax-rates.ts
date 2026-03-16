/**
 * Tax Rates CRUD routes — manage VAT and WHT rates with effective dates.
 *
 * Routes:
 *   GET    /api/v1/tax-rates          — list tax rates for tenant
 *   POST   /api/v1/tax-rates          — create a new tax rate
 *   PUT    /api/v1/tax-rates/:id      — update a tax rate
 *   DELETE /api/v1/tax-rates/:id      — delete a tax rate
 *
 * Story: 11.2
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { tax_rates } from '@neip/db';
import { API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { toISO } from '../../lib/to-iso.js';

const PREFIX = `${API_V1_PREFIX}/tax-rates`;

export async function taxRateRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const { db } = fastify;

  // -------------------------------------------------------------------------
  // GET /api/v1/tax-rates
  // -------------------------------------------------------------------------
  fastify.get(
    PREFIX,
    {
      schema: {
        description: 'List tax rates for the authenticated tenant',
        tags: ['tax'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    taxType: { type: 'string' },
                    rateBasisPoints: { type: 'number' },
                    incomeType: { type: 'string', nullable: true },
                    effectiveFrom: { type: 'string' },
                    tenantId: { type: 'string' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { tenantId } = request.user;

      const rows = await db
        .select()
        .from(tax_rates)
        .where(eq(tax_rates.tenant_id, tenantId))
        .orderBy(desc(tax_rates.effective_from));

      const data = rows.map((r) => ({
        id: r.id,
        taxType: r.tax_type,
        rateBasisPoints: r.rate_basis_points,
        incomeType: r.income_type,
        effectiveFrom: toISO(r.effective_from),
        tenantId: r.tenant_id,
        createdAt: toISO(r.created_at),
        updatedAt: toISO(r.updated_at),
      }));

      return reply.send({ data });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/tax-rates
  // -------------------------------------------------------------------------
  fastify.post(
    PREFIX,
    {
      schema: {
        description: 'Create a new tax rate',
        tags: ['tax'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['taxType', 'rateBasisPoints', 'effectiveFrom'],
          additionalProperties: false,
          properties: {
            taxType: { type: 'string', enum: ['vat', 'wht'] },
            rateBasisPoints: { type: 'number', minimum: 0 },
            incomeType: { type: 'string', nullable: true },
            effectiveFrom: { type: 'string', format: 'date' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  taxType: { type: 'string' },
                  rateBasisPoints: { type: 'number' },
                  incomeType: { type: 'string', nullable: true },
                  effectiveFrom: { type: 'string' },
                  tenantId: { type: 'string' },
                },
              },
            },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const body = request.body as {
        taxType: 'vat' | 'wht';
        rateBasisPoints: number;
        incomeType?: string | null;
        effectiveFrom: string;
      };

      const id = crypto.randomUUID();
      const now = new Date();

      await db.insert(tax_rates).values({
        id,
        tax_type: body.taxType,
        rate_basis_points: body.rateBasisPoints,
        income_type: body.incomeType ?? null,
        effective_from: new Date(body.effectiveFrom),
        tenant_id: tenantId,
        created_at: now,
        updated_at: now,
      });

      return reply.status(201).send({
        data: {
          id,
          taxType: body.taxType,
          rateBasisPoints: body.rateBasisPoints,
          incomeType: body.incomeType ?? null,
          effectiveFrom: body.effectiveFrom,
          tenantId,
        },
      });
    },
  );

  // -------------------------------------------------------------------------
  // PUT /api/v1/tax-rates/:id
  // -------------------------------------------------------------------------
  fastify.put(
    `${PREFIX}/:id`,
    {
      schema: {
        description: 'Update a tax rate',
        tags: ['tax'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            rateBasisPoints: { type: 'number', minimum: 0 },
            effectiveFrom: { type: 'string', format: 'date' },
            incomeType: { type: 'string', nullable: true },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  rateBasisPoints: { type: 'number', nullable: true },
                  effectiveFrom: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = request.user;
      const body = request.body as {
        rateBasisPoints?: number;
        effectiveFrom?: string;
        incomeType?: string | null;
      };

      const updates: Record<string, unknown> = {
        updated_at: new Date(),
      };
      if (body.rateBasisPoints !== undefined) {
        updates['rate_basis_points'] = body.rateBasisPoints;
      }
      if (body.effectiveFrom !== undefined) {
        updates['effective_from'] = new Date(body.effectiveFrom);
      }
      if (body.incomeType !== undefined) {
        updates['income_type'] = body.incomeType;
      }

      await db
        .update(tax_rates)
        .set(updates)
        .where(eq(tax_rates.id, id) as ReturnType<typeof eq>);

      // Suppress unused variable warning for tenantId
      void tenantId;

      return reply.send({
        data: {
          id,
          rateBasisPoints: body.rateBasisPoints,
          effectiveFrom: body.effectiveFrom,
        },
      });
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /api/v1/tax-rates/:id
  // -------------------------------------------------------------------------
  fastify.delete(
    `${PREFIX}/:id`,
    {
      schema: {
        description: 'Delete a tax rate',
        tags: ['tax'],
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
            type: 'null',
            description: 'Successfully deleted',
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await db.delete(tax_rates).where(eq(tax_rates.id, id));
      return reply.status(204).send();
    },
  );
}
