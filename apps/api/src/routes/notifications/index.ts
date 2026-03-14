/**
 * Notification routes barrel — registers all /api/v1/notifications/* routes.
 *
 * Routes:
 *   GET    /api/v1/notifications/settings  — user preferences
 *   PUT    /api/v1/notifications/settings  — update preferences
 *   GET    /api/v1/notifications           — notification history
 *
 * Story 14.1 — Notification System
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { notificationRoutes as notificationHandlers } from './notifications.js';

export async function notificationRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(notificationHandlers);
}
