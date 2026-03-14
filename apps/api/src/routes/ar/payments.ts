/**
 * Payment routes:
 *   POST /api/v1/payments          — record payment
 *   GET  /api/v1/payments          — list payments
 *   POST /api/v1/payments/:id/match — match payment to invoices
 *
 * Story 4.5b — AR API Routes (Invoices + Payments)
 *
 * Note: Payment tables may not exist in the DB schema yet.
 * These routes use stub responses with TODO markers.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import {
  AR_PAYMENT_CREATE,
  AR_PAYMENT_READ,
  AR_PAYMENT_UPDATE,
} from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const createPaymentBodySchema = {
  type: 'object',
  required: ['amountSatang', 'paymentDate', 'paymentMethod'],
  additionalProperties: false,
  properties: {
    customerId: { type: 'string', description: 'Customer ID' },
    invoiceId: { type: 'string', description: 'Invoice to apply payment to (optional)' },
    amountSatang: { type: 'string', description: 'Payment amount in satang' },
    paymentDate: { type: 'string', format: 'date', description: 'Date of payment (YYYY-MM-DD)' },
    paymentMethod: {
      type: 'string',
      enum: ['cash', 'bank_transfer', 'cheque', 'credit_card', 'promptpay'],
      description: 'Payment method',
    },
    reference: { type: 'string', maxLength: 255, description: 'External reference number' },
    notes: { type: 'string', maxLength: 2000 },
  },
} as const;

const paymentResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    paymentNumber: { type: 'string' },
    customerId: { type: 'string', nullable: true },
    invoiceId: { type: 'string', nullable: true },
    amountSatang: { type: 'string' },
    paymentDate: { type: 'string', format: 'date' },
    paymentMethod: { type: 'string' },
    reference: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['unmatched', 'matched', 'voided'] },
    notes: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const matchPaymentBodySchema = {
  type: 'object',
  required: ['invoiceIds'],
  additionalProperties: false,
  properties: {
    invoiceIds: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
      description: 'Invoice IDs to match this payment against',
    },
  },
} as const;

const listQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    offset: { type: 'integer', minimum: 0, default: 0 },
    status: { type: 'string', enum: ['unmatched', 'matched', 'voided'] },
    customerId: { type: 'string' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreatePaymentBody {
  customerId?: string;
  invoiceId?: string;
  amountSatang: string;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

interface MatchPaymentBody {
  invoiceIds: string[];
}

interface PaymentListQuery {
  limit?: number;
  offset?: number;
  status?: string;
  customerId?: string;
  sortOrder?: string;
}

interface IdParams {
  id: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function paymentRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /api/v1/payments — record payment
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreatePaymentBody }>(
    `${API_V1_PREFIX}/payments`,
    {
      schema: {
        description: 'Record a new payment',
        tags: ['ar'],
        security: [{ bearerAuth: [] }],
        body: createPaymentBodySchema,
        response: { 201: { description: 'Payment recorded', ...paymentResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AR_PAYMENT_CREATE)],
    },
    async (request, reply) => {
      const {
        customerId, invoiceId, amountSatang, paymentDate, paymentMethod, reference, notes,
      } = request.body;
      const { tenantId, sub: userId } = request.user;

      const paymentId = crypto.randomUUID();
      const paymentNumber = `PMT-${Date.now()}`;

      // TODO: Insert into payments table when schema is available.
      // await fastify.sql`
      //   INSERT INTO payments (id, payment_number, customer_id, invoice_id, amount_satang, payment_date, payment_method, reference, notes, status, tenant_id, created_by)
      //   VALUES (${paymentId}, ${paymentNumber}, ${customerId ?? null}, ${invoiceId ?? null}, ${BigInt(amountSatang)}, ${paymentDate}, ${paymentMethod}, ${reference ?? null}, ${notes ?? null}, 'unmatched', ${tenantId}, ${userId})
      // `;

      request.log.info(
        { paymentId, paymentNumber, tenantId, userId },
        'Payment recorded (stub)',
      );

      return reply.status(201).send({
        id: paymentId,
        paymentNumber,
        customerId: customerId ?? null,
        invoiceId: invoiceId ?? null,
        amountSatang,
        paymentDate,
        paymentMethod,
        reference: reference ?? null,
        status: invoiceId ? 'matched' : 'unmatched',
        notes: notes ?? null,
        createdAt: new Date().toISOString(),
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/payments — list payments
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: PaymentListQuery }>(
    `${API_V1_PREFIX}/payments`,
    {
      schema: {
        description: 'List payments with pagination',
        tags: ['ar'],
        security: [{ bearerAuth: [] }],
        querystring: listQuerySchema,
        response: {
          200: {
            description: 'Paginated list of payments',
            type: 'object',
            properties: {
              items: { type: 'array', items: paymentResponseSchema },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(AR_PAYMENT_READ)],
    },
    async (request, reply) => {
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;

      // TODO: Query payments table when schema is available.
      request.log.debug({ tenantId: request.user.tenantId }, 'Listing payments (stub)');

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
  // POST /api/v1/payments/:id/match — match payment to invoices
  // -------------------------------------------------------------------------
  fastify.post<{ Params: IdParams; Body: MatchPaymentBody }>(
    `${API_V1_PREFIX}/payments/:id/match`,
    {
      schema: {
        description: 'Match a payment to one or more invoices',
        tags: ['ar'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: matchPaymentBodySchema,
        response: { 200: { description: 'Payment matched', ...paymentResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AR_PAYMENT_UPDATE)],
    },
    async (request, _reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      // TODO: Implement payment-to-invoice matching when schema is available.
      // 1. Verify payment exists and belongs to tenant
      // 2. Verify all invoice IDs exist and belong to tenant
      // 3. Update payment status to 'matched'
      // 4. Update invoice paid_satang and status accordingly
      request.log.debug(
        { paymentId: id, invoiceIds: request.body.invoiceIds, tenantId },
        'Match payment (stub)',
      );

      throw new NotFoundError({
        detail: `Payment ${id} not found. (AR payment table not yet available)`,
      });
    },
  );
}
