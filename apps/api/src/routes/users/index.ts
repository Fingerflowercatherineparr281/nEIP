/**
 * Users routes barrel — registers all /api/v1/users/* routes.
 *
 * Routes:
 *   POST /api/v1/users/invite — Owner invites a user with role assignment
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { inviteRoute } from './invite.js';

export async function userRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(inviteRoute);
}
