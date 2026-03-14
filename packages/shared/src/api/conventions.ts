/**
 * API path conventions and versioning constants for nEIP.
 *
 * Architecture references:
 *   NFR-I1 — URL-based API versioning (/api/v1/)
 *   AR38   — camelCase JSON fields for all request/response bodies
 */

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

/** Current API version string (used in URL paths and Accept headers). */
export const API_VERSION = 'v1' as const;

/** Base path prefix shared by all versioned API routes. */
export const API_BASE_PATH = '/api' as const;

/** Full versioned API prefix: `/api/v1` */
export const API_V1_PREFIX = `${API_BASE_PATH}/${API_VERSION}` as const;

// ---------------------------------------------------------------------------
// Path pattern builders
// ---------------------------------------------------------------------------

/**
 * Build a versioned resource collection path.
 *
 * @example
 * apiPath('proposals')  // => '/api/v1/proposals'
 */
export function apiPath(resource: string): string {
  return `${API_V1_PREFIX}/${resource}`;
}

/**
 * Build a versioned resource-instance path with an `:id` segment.
 *
 * @example
 * apiItemPath('proposals')  // => '/api/v1/proposals/:id'
 */
export function apiItemPath(resource: string): string {
  return `${API_V1_PREFIX}/${resource}/:id`;
}

/**
 * Build a versioned nested sub-resource path.
 *
 * @example
 * apiNestedPath('proposals', 'comments')  // => '/api/v1/proposals/:id/comments'
 */
export function apiNestedPath(parent: string, child: string): string {
  return `${API_V1_PREFIX}/${parent}/:id/${child}`;
}

// ---------------------------------------------------------------------------
// Canonical resource path segments
// ---------------------------------------------------------------------------

/**
 * Well-known API resource path segments.
 * Adding a new resource here keeps route definitions consistent.
 */
export const API_RESOURCES = {
  proposals: 'proposals',
  votes: 'votes',
  comments: 'comments',
  users: 'users',
  health: 'health',
} as const;

export type ApiResource = keyof typeof API_RESOURCES;

// ---------------------------------------------------------------------------
// Content-type conventions
// ---------------------------------------------------------------------------

/** Media type for all JSON request/response bodies. */
export const CONTENT_TYPE_JSON = 'application/json' as const;

/**
 * Media type for RFC 7807 Problem Details error responses.
 * Servers SHOULD use this for 4xx/5xx error bodies.
 */
export const CONTENT_TYPE_PROBLEM_JSON = 'application/problem+json' as const;

// ---------------------------------------------------------------------------
// Authentication scheme
// ---------------------------------------------------------------------------

/**
 * Bearer token authentication scheme as documented in the OpenAPI securitySchemes.
 *
 * Usage in Authorization header:
 *   `Authorization: Bearer <jwt>`
 */
export const AUTH_SCHEME = 'Bearer' as const;

/** OpenAPI security scheme name referenced in route-level `security` blocks. */
export const AUTH_SECURITY_SCHEME_NAME = 'bearerAuth' as const;

// ---------------------------------------------------------------------------
// Naming convention note (documentation-only)
// ---------------------------------------------------------------------------

/**
 * All JSON request and response fields MUST use camelCase.
 * Database columns use snake_case internally but are mapped before serialisation.
 * Architecture reference: AR38, AR39.
 *
 * This constant serves as an in-code documentation anchor — it is not used at
 * runtime but makes the convention discoverable via IDE navigation.
 */
export const NAMING_CONVENTION = 'camelCase' as const;
