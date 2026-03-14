/**
 * Webhook routes:
 *   POST   /api/v1/webhooks      — register a webhook
 *   GET    /api/v1/webhooks      — list webhooks
 *   DELETE /api/v1/webhooks/:id  — remove a webhook
 *
 * Story 13.1 — Webhook Registration + Delivery
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { API_V1_PREFIX, NotFoundError } from '@neip/shared';
import { WebhookService } from '@neip/core';
import { requireAuth } from '../../hooks/require-auth.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const webhookResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    tenantId: { type: 'string' },
    url: { type: 'string', format: 'uri' },
    events: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['active', 'failing'] },
    lastDeliveryAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const createWebhookBodySchema = {
  type: 'object',
  required: ['url', 'events', 'secret'],
  additionalProperties: false,
  properties: {
    url: { type: 'string', format: 'uri', minLength: 1 },
    events: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
    },
    secret: { type: 'string', minLength: 16, maxLength: 256 },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateWebhookBody {
  url: string;
  events: string[];
  secret: string;
}

interface WebhookParams {
  id: string;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function webhookRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const webhookService = new WebhookService(fastify.db);

  // -----------------------------------------------------------------------
  // POST /api/v1/webhooks — register webhook
  // -----------------------------------------------------------------------

  fastify.post<{ Body: CreateWebhookBody }>(
    `${API_V1_PREFIX}/webhooks`,
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['webhooks'],
        summary: 'Register a webhook',
        body: createWebhookBodySchema,
        response: {
          201: webhookResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const webhook = await webhookService.register({
        tenantId,
        url: request.body.url,
        events: request.body.events,
        secret: request.body.secret,
      });

      return reply.status(201).send(webhook);
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/v1/webhooks — list webhooks
  // -----------------------------------------------------------------------

  fastify.get(
    `${API_V1_PREFIX}/webhooks`,
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['webhooks'],
        summary: 'List webhooks',
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: webhookResponseSchema,
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const { tenantId } = request.user;
      const data = await webhookService.list(tenantId);
      return { data };
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /api/v1/webhooks/:id — remove webhook
  // -----------------------------------------------------------------------

  fastify.delete<{ Params: WebhookParams }>(
    `${API_V1_PREFIX}/webhooks/:id`,
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['webhooks'],
        summary: 'Delete a webhook',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const deleted = await webhookService.delete(request.params.id, tenantId);

      if (!deleted) {
        throw new NotFoundError({
          detail: `Webhook ${request.params.id} not found.`,
        });
      }

      return reply.status(204).send();
    },
  );
}
