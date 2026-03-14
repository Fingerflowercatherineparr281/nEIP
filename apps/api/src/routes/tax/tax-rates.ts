/**
 * Tax Rates CRUD routes — manage VAT and WHT rates with effective dates.
 *
 * Routes:
 *   GET    /api/v1/tax-rates          — list tax rates for a tenant
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

const PREFIX = `${API_V1_PREFIX}/tax-rates`;

export async function taxRateRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const { db } = fastify;

  // -------------------------------------------------------------------------
  // GET /api/v1/tax-rates?tenantId=...
  // -------------------------------------------------------------------------
  fastify.get(
    PREFIX,
    {
      schema: {
        description: 'List tax rates for a tenant',
        tags: ['tax'],
        querystring: {
          type: 'object',
          required: ['tenantId'],
          properties: {
            tenantId: { type: 'string' },
          },
        },
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
    },
    async (request, reply) => {
      const { tenantId } = request.query as { tenantId: string };

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
        effectiveFrom: r.effective_from.toISOString(),
        tenantId: r.tenant_id,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
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
        body: {
          type: 'object',
          required: ['taxType', 'rateBasisPoints', 'effectiveFrom', 'tenantId'],
          properties: {
            taxType: { type: 'string', enum: ['vat', 'wht'] },
            rateBasisPoints: { type: 'number', minimum: 0 },
            incomeType: { type: 'string', nullable: true },
            effectiveFrom: { type: 'string', format: 'date-time' },
            tenantId: { type: 'string' },
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
    },
    async (request, reply) => {
      const body = request.body as {
        taxType: 'vat' | 'wht';
        rateBasisPoints: number;
        incomeType?: string | null;
        effectiveFrom: string;
        tenantId: string;
      };

      const id = crypto.randomUUID();
      const now = new Date();

      await db.insert(tax_rates).values({
        id,
        tax_type: body.taxType,
        rate_basis_points: body.rateBasisPoints,
        income_type: body.incomeType ?? null,
        effective_from: new Date(body.effectiveFrom),
        tenant_id: body.tenantId,
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
          tenantId: body.tenantId,
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
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            rateBasisPoints: { type: 'number', minimum: 0 },
            effectiveFrom: { type: 'string', format: 'date-time' },
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
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        rateBasisPoints?: number;
        effectiveFrom?: string;
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

      await db
        .update(tax_rates)
        .set(updates)
        .where(eq(tax_rates.id, id));

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
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await db.delete(tax_rates).where(eq(tax_rates.id, id));
      return reply.status(204).send();
    },
  );
}
