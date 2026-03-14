/**
 * HTTP header name constants used across the nEIP API.
 *
 * Architecture references:
 *   AR20  — X-Request-ID as a required correlation header on every request/response
 *   NFR-I4 — X-Idempotency-Key for POST/PUT endpoints
 */

// ---------------------------------------------------------------------------
// Correlation
// ---------------------------------------------------------------------------

/**
 * Correlation / trace header.
 * - Server echoes this value on every response.
 * - Clients SHOULD generate a UUID v4 per request.
 * - Required header documented in OpenAPI spec.
 */
export const HEADER_REQUEST_ID = 'X-Request-ID' as const;

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * Idempotency key header.
 * - Applies to POST and PUT endpoints that create or replace resources.
 * - Clients supply a unique key (UUID v4) per logical operation.
 * - Servers cache the response for the lifetime of the key and replay it on
 *   duplicate requests with the same key.
 */
export const HEADER_IDEMPOTENCY_KEY = 'X-Idempotency-Key' as const;

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/**
 * Rate limit ceiling — total requests allowed in the current window.
 * Mirrors the standard `RateLimit-Limit` semantics (see IETF draft-ietf-httpapi-ratelimit-headers).
 */
export const HEADER_RATELIMIT_LIMIT = 'X-RateLimit-Limit' as const;

/**
 * Remaining requests in the current rate-limit window.
 */
export const HEADER_RATELIMIT_REMAINING = 'X-RateLimit-Remaining' as const;

/**
 * Unix timestamp (seconds) at which the current rate-limit window resets.
 * Optional — servers MAY include this to help clients back off gracefully.
 */
export const HEADER_RATELIMIT_RESET = 'X-RateLimit-Reset' as const;

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Standard HTTP Authorization header carrying a Bearer JWT.
 * Format: `Authorization: Bearer <token>`
 */
export const HEADER_AUTHORIZATION = 'Authorization' as const;

// ---------------------------------------------------------------------------
// Grouped constant for iteration / documentation generation
// ---------------------------------------------------------------------------

/** All custom nEIP header names in a single record for easy iteration. */
export const API_HEADERS = {
  requestId: HEADER_REQUEST_ID,
  idempotencyKey: HEADER_IDEMPOTENCY_KEY,
  rateLimitLimit: HEADER_RATELIMIT_LIMIT,
  rateLimitRemaining: HEADER_RATELIMIT_REMAINING,
  rateLimitReset: HEADER_RATELIMIT_RESET,
  authorization: HEADER_AUTHORIZATION,
} as const;

export type ApiHeaderName = (typeof API_HEADERS)[keyof typeof API_HEADERS];
