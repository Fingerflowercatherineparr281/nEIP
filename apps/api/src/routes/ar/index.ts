/**
 * AR routes barrel — registers all /api/v1/ AR-related routes.
 *
 * Routes:
 *   POST /api/v1/invoices              — create invoice
 *   GET  /api/v1/invoices              — list invoices
 *   GET  /api/v1/invoices/:id          — get invoice detail
 *   POST /api/v1/invoices/:id/void     — void invoice
 *   POST /api/v1/payments              — record payment
 *   GET  /api/v1/payments              — list payments
 *   POST /api/v1/payments/:id/match    — match payment to invoices
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { invoiceRoutes } from './invoices.js';
import { paymentRoutes } from './payments.js';

export async function arRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(invoiceRoutes);
  await fastify.register(paymentRoutes);
}
