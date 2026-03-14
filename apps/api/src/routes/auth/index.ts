/**
 * Auth routes barrel — registers all /api/v1/auth/* routes.
 *
 * Routes:
 *   POST /api/v1/auth/register — create user account
 *   POST /api/v1/auth/login    — issue access + refresh token
 *   POST /api/v1/auth/refresh  — rotate refresh token
 *   POST /api/v1/auth/logout   — revoke refresh token
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { registerRoute } from './register.js';
import { loginRoute } from './login.js';
import { refreshRoute } from './refresh.js';
import { logoutRoute } from './logout.js';

export async function authRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(registerRoute);
  await fastify.register(loginRoute);
  await fastify.register(refreshRoute);
  await fastify.register(logoutRoute);
}
