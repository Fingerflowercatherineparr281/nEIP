/**
 * POST /api/v1/auth/logout
 *
 * Revokes the provided refresh token so it cannot be used again.
 * The client is responsible for discarding the access token (it will expire
 * naturally within 1 hour — short-lived by design).
 *
 * Acceptance criteria:
 *   AC#7 — refresh tokens revokable via /api/v1/auth/logout
 *   AC#8 — all auth events logged
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { API_V1_PREFIX } from '@neip/shared';
import { verifyRefreshToken, revokeRefreshToken } from '../../lib/tokens.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const logoutBodySchema = {
  type: 'object',
  required: ['refreshToken'],
  additionalProperties: false,
  properties: {
    refreshToken: { type: 'string', minLength: 1 },
  },
} as const;

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

interface LogoutBody {
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function logoutRoute(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.post<{ Body: LogoutBody }>(
    `${API_V1_PREFIX}/auth/logout`,
    {
      schema: {
        description: 'Revoke a refresh token (logout)',
        tags: ['auth'],
        body: logoutBodySchema,
        response: {
          204: {
            description: 'Logged out — refresh token revoked',
            type: 'null',
          },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;

      // Verify the token is well-formed and extract the jti.
      // If verification fails (expired / invalid) we still return 204 to
      // avoid leaking information — the token is effectively gone either way.
      try {
        const payload = verifyRefreshToken(fastify, refreshToken);
        revokeRefreshToken(payload.jti);
        request.log.info({ userId: payload.sub }, 'User logged out — refresh token revoked');
      } catch {
        // Token already invalid/expired — idempotent logout is fine.
        request.log.debug('Logout called with invalid/already-expired refresh token');
      }

      return reply.status(204).send();
    },
  );
}
