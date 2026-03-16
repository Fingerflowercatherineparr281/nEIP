/**
 * Vendor routes:
 *   GET  /api/v1/vendors      — list vendors for current tenant
 *   POST /api/v1/vendors      — create vendor
 *   PUT  /api/v1/vendors/:id  — update vendor
 *
 * Story 10.3 — AP Vendor Management
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { toISO } from '../../lib/to-iso.js';
import {
  AP_VENDOR_CREATE,
  AP_VENDOR_READ,
  AP_VENDOR_UPDATE,
} from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const createVendorBodySchema = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    taxId: { type: 'string', maxLength: 50 },
    address: { type: 'string', maxLength: 1000 },
  },
} as const;

const updateVendorBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    taxId: { type: 'string', maxLength: 50 },
    address: { type: 'string', maxLength: 1000 },
  },
} as const;

const vendorResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    taxId: { type: 'string', nullable: true },
    address: { type: 'string', nullable: true },
    tenantId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const listQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    offset: { type: 'integer', minimum: 0, default: 0 },
    search: { type: 'string', maxLength: 255 },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateVendorBody {
  name: string;
  taxId?: string;
  address?: string;
}

interface UpdateVendorBody {
  name?: string;
  taxId?: string;
  address?: string;
}

interface VendorListQuery {
  limit?: number;
  offset?: number;
  search?: string;
}

interface IdParams {
  id: string;
}

interface VendorRow {
  id: string;
  name: string;
  tax_id: string | null;
  address: string | null;
  tenant_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CountRow {
  count: string;
}

// ---------------------------------------------------------------------------
// Serialisation helper
// ---------------------------------------------------------------------------

function serializeVendor(v: VendorRow) {
  return {
    id: v.id,
    name: v.name,
    taxId: v.tax_id,
    address: v.address,
    tenantId: v.tenant_id,
    createdAt: toISO(v.created_at),
    updatedAt: toISO(v.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function vendorRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /api/v1/vendors — list vendors
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: VendorListQuery }>(
    `${API_V1_PREFIX}/vendors`,
    {
      schema: {
        description: 'List vendors for the current tenant',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        querystring: listQuerySchema,
        response: {
          200: {
            description: 'Paginated list of vendors',
            type: 'object',
            properties: {
              items: { type: 'array', items: vendorResponseSchema },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(AP_VENDOR_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;
      const { search } = request.query;

      let countRows: CountRow[];
      let vendors: VendorRow[];

      if (search !== undefined && search !== '') {
        const pattern = `%${search}%`;
        countRows = await fastify.sql<CountRow[]>`
          SELECT COUNT(*)::text AS count
          FROM vendors
          WHERE tenant_id = ${tenantId}
            AND (name ILIKE ${pattern} OR tax_id ILIKE ${pattern})
        `;
        vendors = await fastify.sql<VendorRow[]>`
          SELECT * FROM vendors
          WHERE tenant_id = ${tenantId}
            AND (name ILIKE ${pattern} OR tax_id ILIKE ${pattern})
          ORDER BY name ASC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        countRows = await fastify.sql<CountRow[]>`
          SELECT COUNT(*)::text AS count FROM vendors WHERE tenant_id = ${tenantId}
        `;
        vendors = await fastify.sql<VendorRow[]>`
          SELECT * FROM vendors
          WHERE tenant_id = ${tenantId}
          ORDER BY name ASC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }

      const total = parseInt(countRows[0]?.count ?? '0', 10);
      const items = vendors.map(serializeVendor);

      return reply.status(200).send({ items, total, limit, offset, hasMore: offset + limit < total });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/vendors — create vendor
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateVendorBody }>(
    `${API_V1_PREFIX}/vendors`,
    {
      schema: {
        description: 'Create a new vendor',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        body: createVendorBodySchema,
        response: { 201: { description: 'Vendor created', ...vendorResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AP_VENDOR_CREATE)],
    },
    async (request, reply) => {
      const { name, taxId, address } = request.body;
      const { tenantId } = request.user;

      const id = crypto.randomUUID();

      const rows = await fastify.sql<[VendorRow]>`
        INSERT INTO vendors (id, name, tax_id, address, tenant_id)
        VALUES (${id}, ${name}, ${taxId ?? null}, ${address ?? null}, ${tenantId})
        RETURNING *
      `;
      const vendor = rows[0]!;

      request.log.info({ vendorId: id, tenantId }, 'Vendor created');

      return reply.status(201).send(serializeVendor(vendor));
    },
  );

  // -------------------------------------------------------------------------
  // PUT /api/v1/vendors/:id — update vendor
  // -------------------------------------------------------------------------
  fastify.put<{ Params: IdParams; Body: UpdateVendorBody }>(
    `${API_V1_PREFIX}/vendors/:id`,
    {
      schema: {
        description: 'Update an existing vendor',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: updateVendorBodySchema,
        response: { 200: { description: 'Vendor updated', ...vendorResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AP_VENDOR_UPDATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, taxId, address } = request.body;
      const { tenantId } = request.user;

      const existing = await fastify.sql<[VendorRow?]>`
        SELECT id FROM vendors WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!existing[0]) {
        throw new NotFoundError({ detail: `Vendor ${id} not found.` });
      }

      const rows = await fastify.sql<[VendorRow]>`
        UPDATE vendors
        SET name       = COALESCE(${name ?? null}, name),
            tax_id     = COALESCE(${taxId ?? null}, tax_id),
            address    = COALESCE(${address ?? null}, address),
            updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;
      const vendor = rows[0]!;

      request.log.info({ vendorId: id, tenantId }, 'Vendor updated');

      return reply.status(200).send(serializeVendor(vendor));
    },
  );
}
