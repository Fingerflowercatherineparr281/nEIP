/**
 * @neip/shared — API contracts barrel export.
 *
 * Re-exports all public symbols from the api sub-module:
 *   - openapi-skeleton: response envelope types and Zod schemas
 *   - headers: HTTP header name constants
 *   - conventions: path builders, versioning, content-type constants
 */

// ---------------------------------------------------------------------------
// OpenAPI skeleton — response envelopes and Zod schemas
// ---------------------------------------------------------------------------
export {
  ErrorResponseSchema,
  toErrorResponse,
  successResponseSchema,
  toSuccessResponse,
  paginatedResponseSchema,
  toPaginatedResponse,
} from './openapi-skeleton.js';

export type {
  ErrorResponse,
  SuccessResponse,
  PaginatedResponse,
} from './openapi-skeleton.js';

// ---------------------------------------------------------------------------
// HTTP header constants
// ---------------------------------------------------------------------------
export {
  HEADER_REQUEST_ID,
  HEADER_IDEMPOTENCY_KEY,
  HEADER_RATELIMIT_LIMIT,
  HEADER_RATELIMIT_REMAINING,
  HEADER_RATELIMIT_RESET,
  HEADER_AUTHORIZATION,
  API_HEADERS,
} from './headers.js';

export type { ApiHeaderName } from './headers.js';

// ---------------------------------------------------------------------------
// API path conventions and versioning
// ---------------------------------------------------------------------------
export {
  API_VERSION,
  API_BASE_PATH,
  API_V1_PREFIX,
  apiPath,
  apiItemPath,
  apiNestedPath,
  API_RESOURCES,
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_PROBLEM_JSON,
  AUTH_SCHEME,
  AUTH_SECURITY_SCHEME_NAME,
  NAMING_CONVENTION,
} from './conventions.js';

export type { ApiResource } from './conventions.js';
