/**
 * POST /api/v1/auth/login
 *
 * Authenticates a user by email + password (argon2 verify) and returns
 * a short-lived access token (1 hr) and long-lived refresh token (30 days).
 *
 * Acceptance criteria:
 *   AC#3 — login returns JWT access token (1hr) + refresh token (30 days)
 *   AC#8 — all auth events logged (success + failure)
 *
 * Architecture references: AR21 (argon2), NFR-S3 (JWT), NFR-S7 (token TTLs)
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import * as argon2 from 'argon2';
import { AuthError, API_V1_PREFIX } from '@neip/shared';
import { signAccessToken, signRefreshToken } from '../../lib/tokens.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1 },
  },
} as const;

const loginResponseSchema = {
  type: 'object',
  properties: {
    accessToken: { type: 'string', description: 'JWT access token (1 hour)' },
    refreshToken: { type: 'string', description: 'Opaque refresh token (30 days)' },
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
  password_hash: string;
  tenant_id: string;
}

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

interface LoginBody {
  email: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function loginRoute(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.post<{ Body: LoginBody }>(
    `${API_V1_PREFIX}/auth/login`,
    {
      schema: {
        description: 'Authenticate with email and password',
        tags: ['auth'],
        body: loginBodySchema,
        response: {
          200: {
            description: 'Authentication successful',
            ...loginResponseSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const normalizedEmail = email.toLowerCase();

      // Look up user by email (case-insensitive).
      const rows = await fastify.sql<[UserRow?]>`
        SELECT id, email, password_hash, tenant_id
        FROM users
        WHERE email = ${normalizedEmail}
        LIMIT 1
      `;

      const user = rows[0];

      // Use a constant-time generic message so we don't leak whether the
      // email exists (timing-safe: argon2.verify runs regardless of result).
      if (!user) {
        // Run a dummy hash to prevent timing attacks through early-exit.
        await argon2.hash('dummy-password-to-prevent-timing-attack');
        request.log.warn({ email: normalizedEmail }, 'Login attempt — unknown email');
        throw new AuthError({ detail: 'Invalid email or password.' });
      }

      const valid = await argon2.verify(user.password_hash, password);

      if (!valid) {
        request.log.warn({ userId: user.id, email: normalizedEmail }, 'Login attempt — wrong password');
        throw new AuthError({ detail: 'Invalid email or password.' });
      }

      // Issue tokens.
      const accessToken = signAccessToken(fastify, {
        sub: user.id,
        email: user.email,
        tenantId: user.tenant_id,
      });

      const refreshToken = signRefreshToken(fastify, user.id);

      request.log.info(
        { userId: user.id, email: user.email },
        'User logged in successfully',
      );

      return reply.status(200).send({
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 3600, // 1 hour in seconds
      });
    },
  );
}
