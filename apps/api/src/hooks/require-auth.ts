/**
 * require-auth.ts — Fastify preHandler hook for JWT-protected routes.
 *
 * Usage:
 *   fastify.get('/protected', { preHandler: [requireAuth] }, handler)
 *
 * Architecture references:
 *   NFR-S3 — JWT-based authentication
 *   AR20   — X-Request-ID correlation on every response
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthError } from '@neip/shared';
import type { AccessTokenPayload } from '../lib/tokens.js';

/**
 * Fastify preHandler that validates the Bearer JWT access token.
 *
 * On success, `request.user` is populated with the decoded AccessTokenPayload.
 * On failure, throws AuthError which the error-handler converts to a 401
 * Problem Details response.
 */
export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify<AccessTokenPayload>();
  } catch (err) {
    // Map @fastify/jwt errors to our AuthError hierarchy so the global
    // error handler renders them as RFC 7807 Problem Details with status 401.
    const message =
      err instanceof Error
        ? err.message
        : 'Authentication is required to access this resource.';

    throw new AuthError({ detail: message, cause: err });
  }

  // Reject refresh tokens used on protected resource endpoints.
  const { user } = request;
  if ((user as { type?: string }).type !== 'access') {
    throw new AuthError({ detail: 'Access token required.' });
  }
}
