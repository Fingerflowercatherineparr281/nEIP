/**
 * Invoice routes:
 *   POST /api/v1/invoices          — create invoice
 *   GET  /api/v1/invoices          — list invoices
 *   GET  /api/v1/invoices/:id      — get invoice detail
 *   POST /api/v1/invoices/:id/void — void invoice
 *
 * Story 4.5b — AR API Routes (Invoices + Payments)
 *
 * Note: Invoice and payment tables may not exist in the DB schema yet.
 * These routes use raw SQL with TODO markers for when the schema is available.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import {
  AR_INVOICE_CREATE,
  AR_INVOICE_READ,
  AR_INVOICE_VOID,
} from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const invoiceLineSchema = {
  type: 'object',
  required: ['description', 'quantity', 'unitPriceSatang'],
  additionalProperties: false,
  properties: {
    description: { type: 'string', minLength: 1, maxLength: 500 },
    quantity: { type: 'number', minimum: 0.01 },
    unitPriceSatang: { type: 'string', description: 'Unit price in satang' },
    accountId: { type: 'string', description: 'Revenue account ID' },
  },
} as const;

const createInvoiceBodySchema = {
  type: 'object',
  required: ['customerId', 'dueDate', 'lines'],
  additionalProperties: false,
  properties: {
    customerId: { type: 'string', description: 'Customer ID' },
    dueDate: { type: 'string', format: 'date', description: 'Payment due date (YYYY-MM-DD)' },
    notes: { type: 'string', maxLength: 2000 },
    lines: {
      type: 'array',
      minItems: 1,
      items: invoiceLineSchema,
    },
  },
} as const;

const invoiceResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    invoiceNumber: { type: 'string' },
    customerId: { type: 'string' },
    status: { type: 'string', enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'void'] },
    totalSatang: { type: 'string' },
    paidSatang: { type: 'string' },
    dueDate: { type: 'string', format: 'date' },
    notes: { type: 'string', nullable: true },
    lines: { type: 'array', items: { type: 'object' } },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const listQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    offset: { type: 'integer', minimum: 0, default: 0 },
    status: { type: 'string', enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'void'] },
    customerId: { type: 'string' },
    sortBy: { type: 'string', enum: ['createdAt', 'dueDate', 'totalSatang'], default: 'createdAt' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateInvoiceBody {
  customerId: string;
  dueDate: string;
  notes?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPriceSatang: string;
    accountId?: string;
  }>;
}

interface InvoiceListQuery {
  limit?: number;
  offset?: number;
  status?: string;
  customerId?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface IdParams {
  id: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function invoiceRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /api/v1/invoices — create invoice
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateInvoiceBody }>(
    `${API_V1_PREFIX}/invoices`,
    {
      schema: {
        description: 'Create a new invoice',
        tags: ['ar'],
        security: [{ bearerAuth: [] }],
        body: createInvoiceBodySchema,
        response: { 201: { description: 'Invoice created', ...invoiceResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AR_INVOICE_CREATE)],
    },
    async (request, reply) => {
      const { customerId, dueDate, notes, lines } = request.body;
      const { tenantId, sub: userId } = request.user;

      // Calculate total.
      let totalSatang = 0n;
      const processedLines = lines.map((line, index) => {
        const lineTotal = BigInt(line.unitPriceSatang) * BigInt(Math.round(line.quantity * 100)) / 100n;
        totalSatang += lineTotal;
        return {
          id: crypto.randomUUID(),
          lineNumber: index + 1,
          description: line.description,
          quantity: line.quantity,
          unitPriceSatang: line.unitPriceSatang,
          totalSatang: lineTotal.toString(),
          accountId: line.accountId ?? null,
        };
      });

      const invoiceId = crypto.randomUUID();
      const invoiceNumber = `INV-${Date.now()}`;

      // TODO: Insert into invoices table when schema is available.
      // For now, return a stub response that matches the expected shape.
      // The actual DB insert would look like:
      // await fastify.sql`
      //   INSERT INTO invoices (id, invoice_number, customer_id, status, total_satang, paid_satang, due_date, notes, tenant_id, created_by)
      //   VALUES (${invoiceId}, ${invoiceNumber}, ${customerId}, 'draft', ${totalSatang}, 0, ${dueDate}, ${notes ?? null}, ${tenantId}, ${userId})
      // `;

      request.log.info(
        { invoiceId, invoiceNumber, customerId, tenantId, userId },
        'Invoice created (stub)',
      );

      return reply.status(201).send({
        id: invoiceId,
        invoiceNumber,
        customerId,
        status: 'draft',
        totalSatang: totalSatang.toString(),
        paidSatang: '0',
        dueDate,
        notes: notes ?? null,
        lines: processedLines,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/invoices — list invoices
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: InvoiceListQuery }>(
    `${API_V1_PREFIX}/invoices`,
    {
      schema: {
        description: 'List invoices with pagination and filtering',
        tags: ['ar'],
        security: [{ bearerAuth: [] }],
        querystring: listQuerySchema,
        response: {
          200: {
            description: 'Paginated list of invoices',
            type: 'object',
            properties: {
              items: { type: 'array', items: invoiceResponseSchema },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(AR_INVOICE_READ)],
    },
    async (request, reply) => {
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;

      // TODO: Query invoices table when schema is available.
      // For now, return empty list stub.
      request.log.debug({ tenantId: request.user.tenantId }, 'Listing invoices (stub)');

      return reply.status(200).send({
        items: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/invoices/:id — get invoice detail
  // -------------------------------------------------------------------------
  fastify.get<{ Params: IdParams }>(
    `${API_V1_PREFIX}/invoices/:id`,
    {
      schema: {
        description: 'Get invoice details by ID',
        tags: ['ar'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: { 200: { description: 'Invoice details', ...invoiceResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AR_INVOICE_READ)],
    },
    async (request, _reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      // TODO: Query invoices table when schema is available.
      // For now, return 404 as no invoices are persisted yet.
      request.log.debug({ invoiceId: id, tenantId }, 'Get invoice detail (stub)');

      throw new NotFoundError({
        detail: `Invoice ${id} not found. (AR invoice table not yet available)`,
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/invoices/:id/void — void invoice
  // -------------------------------------------------------------------------
  fastify.post<{ Params: IdParams }>(
    `${API_V1_PREFIX}/invoices/:id/void`,
    {
      schema: {
        description: 'Void an invoice (cannot be undone)',
        tags: ['ar'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: { 200: { description: 'Invoice voided', ...invoiceResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AR_INVOICE_VOID)],
    },
    async (request, _reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      // TODO: Update invoices table when schema is available.
      // Status transition: draft|sent → void (paid/partial cannot be voided).
      request.log.debug({ invoiceId: id, tenantId }, 'Void invoice (stub)');

      throw new NotFoundError({
        detail: `Invoice ${id} not found. (AR invoice table not yet available)`,
      });
    },
  );
}
