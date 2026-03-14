/**
 * POST /api/v1/auth/refresh
 *
 * Rotates a refresh token: verifies the provided refresh token,
 * revokes it, issues a new access token and a new refresh token.
 *
 * Acceptance criteria:
 *   AC#4 — valid refresh token issues new access token, old refresh invalidated
 *   AC#5 — protected routes without valid JWT return 401
 *   AC#6 — expired tokens return 401 with clear message
 *
 * Architecture references: NFR-S7 (rotation)
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { AuthError, API_V1_PREFIX } from '@neip/shared';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} from '../../lib/tokens.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const refreshBodySchema = {
  type: 'object',
  required: ['refreshToken'],
  additionalProperties: false,
  properties: {
    refreshToken: { type: 'string', minLength: 1 },
  },
} as const;

const refreshResponseSchema = {
  type: 'object',
  properties: {
    accessToken: { type: 'string', description: 'New JWT access token (1 hour)' },
    refreshToken: { type: 'string', description: 'New refresh token (30 days)' },
    tokenType: { type: 'string', enum: ['Bearer'] },
    expiresIn: { type: 'number', description: 'Access token TTL in seconds' },
  },
} as const;

// ---------------------------------------------------------------------------
// DB row type
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  email: string;
  tenant_id: string;
}

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

interface RefreshBody {
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function refreshRoute(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.post<{ Body: RefreshBody }>(
    `${API_V1_PREFIX}/auth/refresh`,
    {
      schema: {
        description: 'Rotate a refresh token and issue a new access token',
        tags: ['auth'],
        body: refreshBodySchema,
        response: {
          200: {
            description: 'Token rotation successful',
            ...refreshResponseSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;

      // Verify signature, expiry, type, and store presence.
      const payload = verifyRefreshToken(fastify, refreshToken);

      // Revoke the consumed token before issuing new ones (rotation).
      revokeRefreshToken(payload.jti);

      // Reload user to ensure the account still exists and is active.
      const rows = await fastify.sql<[UserRow?]>`
        SELECT id, email, tenant_id
        FROM users
        WHERE id = ${payload.sub}
        LIMIT 1
      `;

      const user = rows[0];
      if (!user) {
        request.log.warn({ userId: payload.sub }, 'Refresh attempted for deleted user');
        throw new AuthError({ detail: 'User account no longer exists.' });
      }

      // Issue fresh tokens.
      const newAccessToken = signAccessToken(fastify, {
        sub: user.id,
        email: user.email,
        tenantId: user.tenant_id,
      });

      const newRefreshToken = signRefreshToken(fastify, user.id);

      request.log.info(
        { userId: user.id },
        'Refresh token rotated successfully',
      );

      return reply.status(200).send({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: 3600,
      });
    },
  );
}
