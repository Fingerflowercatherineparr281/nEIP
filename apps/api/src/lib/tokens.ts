/**
 * tokens.ts — JWT sign/verify helpers and refresh token storage.
 *
 * Architecture references:
 *   NFR-S3 — JWT + refresh tokens
 *   NFR-S7 — JWT 1hr, refresh 30 days, revokable
 *
 * Refresh token storage is backed by an in-memory Map for now.
 * A DB-backed implementation replaces this in a later story.
 */

import type { FastifyInstance } from 'fastify';
import { AuthError } from '@neip/shared';

// ---------------------------------------------------------------------------
// JWT payload shape
// ---------------------------------------------------------------------------

export interface AccessTokenPayload {
  /** User's database ID */
  sub: string;
  /** User's email */
  email: string;
  /** Tenant the user belongs to */
  tenantId: string;
  /** Discriminator so we can reject refresh tokens used as access tokens */
  type: 'access';
}

export interface RefreshTokenPayload {
  /** User's database ID */
  sub: string;
  /** Unique token ID — used for lookup and revocation */
  jti: string;
  /** Discriminator */
  type: 'refresh';
}

// ---------------------------------------------------------------------------
// Augment @fastify/jwt so request.user is typed correctly
// ---------------------------------------------------------------------------

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload | RefreshTokenPayload;
    user: AccessTokenPayload;
  }
}

// ---------------------------------------------------------------------------
// Token lifetimes
// ---------------------------------------------------------------------------

export const ACCESS_TOKEN_TTL = '1h' as const;
export const REFRESH_TOKEN_TTL = '30d' as const;

/** 30 days in seconds — used for Map-based expiry pruning */
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// In-memory refresh token store
//
// Map<jti, { userId, expiresAt }>
// Single-process only — replace with Redis / DB in a later story.
// ---------------------------------------------------------------------------

interface RefreshTokenEntry {
  userId: string;
  expiresAt: number; // epoch ms
}

const refreshTokenStore = new Map<string, RefreshTokenEntry>();

/**
 * Persist a refresh token jti so it can be validated and rotated later.
 */
export function storeRefreshToken(jti: string, userId: string): void {
  refreshTokenStore.set(jti, {
    userId,
    expiresAt: Date.now() + REFRESH_TTL_MS,
  });
}

/**
 * Validate a refresh token jti.
 * Returns the userId if valid, throws AuthError otherwise.
 */
export function validateRefreshToken(jti: string, userId: string): void {
  const entry = refreshTokenStore.get(jti);

  if (!entry) {
    throw new AuthError({ detail: 'Refresh token not found or already revoked.' });
  }
  if (entry.userId !== userId) {
    throw new AuthError({ detail: 'Refresh token subject mismatch.' });
  }
  if (Date.now() > entry.expiresAt) {
    refreshTokenStore.delete(jti);
    throw new AuthError({ detail: 'Refresh token has expired.' });
  }
}

/**
 * Revoke a refresh token immediately (used on logout and on rotation).
 */
export function revokeRefreshToken(jti: string): void {
  refreshTokenStore.delete(jti);
}

// ---------------------------------------------------------------------------
// JWT sign helpers
// ---------------------------------------------------------------------------

/**
 * Sign a short-lived access token (1 hour).
 */
export function signAccessToken(
  app: FastifyInstance,
  payload: Omit<AccessTokenPayload, 'type'>,
): string {
  return app.jwt.sign(
    { ...payload, type: 'access' } satisfies AccessTokenPayload,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

/**
 * Sign a long-lived refresh token (30 days) and persist its jti.
 */
export function signRefreshToken(
  app: FastifyInstance,
  userId: string,
): string {
  const jti = crypto.randomUUID();
  const token = app.jwt.sign(
    { sub: userId, jti, type: 'refresh' } satisfies RefreshTokenPayload,
    { expiresIn: REFRESH_TOKEN_TTL },
  );
  storeRefreshToken(jti, userId);
  return token;
}

/**
 * Verify and decode a refresh token.
 * Validates signature, expiry, token type, and store presence.
 */
export function verifyRefreshToken(
  app: FastifyInstance,
  token: string,
): RefreshTokenPayload {
  let payload: RefreshTokenPayload;

  try {
    payload = app.jwt.verify<RefreshTokenPayload>(token);
  } catch (err) {
    throw new AuthError({ detail: 'Invalid or expired refresh token.', cause: err });
  }

  if (payload.type !== 'refresh') {
    throw new AuthError({ detail: 'Token type must be refresh.' });
  }

  validateRefreshToken(payload.jti, payload.sub);
  return payload;
}
