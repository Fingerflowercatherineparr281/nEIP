/**
 * Webhook routes barrel — Story 13.1.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { webhookRoutes } from './webhooks.js';

export async function webhookRoutesPlugin(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(webhookRoutes);
}
