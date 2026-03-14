/**
 * Role routes barrel — Story 13.2.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { roleRoutes } from './roles.js';

export async function roleRoutesPlugin(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(roleRoutes);
}
