/**
 * @neip/shared — shared types, error classes, Zod schemas, and utilities.
 *
 * All exports are grouped by sub-module for tree-shaking friendliness.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------
export type { Money } from './types/index.js';
export { makeMoney, fromBaht } from './types/index.js';

export type { DomainEvent } from './types/index.js';

export type { ToolResult, ToolSuccess, ToolFailure } from './types/index.js';
export { isToolSuccess, isToolFailure, ok, err } from './types/index.js';

// ---------------------------------------------------------------------------
// Error hierarchy (RFC 7807)
// ---------------------------------------------------------------------------
export {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from './errors/index.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
export { PaginationSchema } from './schemas/index.js';
export type { Pagination } from './schemas/index.js';

export { SortDirectionSchema, SortSchema, makeSortSchema } from './schemas/index.js';
export type { SortDirection, Sort } from './schemas/index.js';

export {
  FilterConditionSchema,
  FilterSchema,
  QuerySchema,
} from './schemas/index.js';
export type { FilterValue, FilterCondition, Filter, Query } from './schemas/index.js';

// ---------------------------------------------------------------------------
// Environment configuration (Zod-validated)
// ---------------------------------------------------------------------------
export { env } from './env.js';
export type { Env } from './env.js';

// ---------------------------------------------------------------------------
// Naming convention utility types
// ---------------------------------------------------------------------------
export type {
  SnakeToCamel,
  CamelToSnake,
  SnakeKeysToCamel,
  CamelKeysToSnake,
  CamelCaseString,
  SnakeCaseString,
  PascalCaseString,
  KebabCaseString,
} from './utils/index.js';

// ---------------------------------------------------------------------------
// API contracts (Story 1.5)
// ---------------------------------------------------------------------------
export {
  // Zod schemas
  ErrorResponseSchema,
  successResponseSchema,
  paginatedResponseSchema,
  // Envelope constructors
  toErrorResponse,
  toSuccessResponse,
  toPaginatedResponse,
  // Header constants
  HEADER_REQUEST_ID,
  HEADER_IDEMPOTENCY_KEY,
  HEADER_RATELIMIT_LIMIT,
  HEADER_RATELIMIT_REMAINING,
  HEADER_RATELIMIT_RESET,
  HEADER_AUTHORIZATION,
  API_HEADERS,
  // Path / versioning constants
  API_VERSION,
  API_BASE_PATH,
  API_V1_PREFIX,
  apiPath,
  apiItemPath,
  apiNestedPath,
  API_RESOURCES,
  // Content-type and auth constants
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_PROBLEM_JSON,
  AUTH_SCHEME,
  AUTH_SECURITY_SCHEME_NAME,
  NAMING_CONVENTION,
} from './api/index.js';

export type {
  ErrorResponse,
  SuccessResponse,
  PaginatedResponse,
  ApiHeaderName,
  ApiResource,
} from './api/index.js';
