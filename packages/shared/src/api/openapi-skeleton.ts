/**
 * OpenAPI skeleton — shared type contracts and Zod schemas for API responses.
 *
 * Architecture references:
 *   AR14  — RFC 7807 Problem Details error format
 *   AR20  — X-Request-ID correlation header
 *   AR38  — camelCase JSON fields
 *   AR39  — camelCase JSON fields (duplicate reference in spec)
 *   NFR-I1 — URL-based API versioning /api/v1/
 *   NFR-I4 — Idempotency key header for POST/PUT
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// ErrorResponse — RFC 7807 Problem Details
// Aligned with AppError.toJSON() shape from errors/app-error.ts
// ---------------------------------------------------------------------------

/**
 * Zod schema for RFC 7807 Problem Details error response.
 *
 * Maps directly to AppError.toJSON() so serialisation is always consistent.
 */
export const ErrorResponseSchema = z.object({
  /** A URI reference identifying the problem type. */
  type: z.string().url(),
  /** Short, human-readable summary of the problem type. */
  title: z.string().min(1),
  /** HTTP status code mirroring the response status. */
  status: z.number().int().min(100).max(599),
  /** Human-readable explanation specific to this occurrence. */
  detail: z.string().min(1),
  /** URI reference identifying the specific occurrence of the problem. */
  instance: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Construct an ErrorResponse plain object from an AppError-shaped value.
 * This keeps ErrorResponse as a pure data type — no class dependency.
 */
export function toErrorResponse(error: {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string | undefined;
}): ErrorResponse {
  const response: ErrorResponse = {
    type: error.type,
    title: error.title,
    status: error.status,
    detail: error.detail,
  };
  if (error.instance !== undefined) {
    response.instance = error.instance;
  }
  return response;
}

// ---------------------------------------------------------------------------
// SuccessResponse<T> — envelope for single-resource responses
// ---------------------------------------------------------------------------

/**
 * Zod schema factory for SuccessResponse<T>.
 *
 * @param dataSchema - Zod schema for the wrapped data payload.
 */
export function successResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    /** The response payload. */
    data: dataSchema,
    /** Optional opaque metadata (e.g. request ID, processing time). */
    meta: z.record(z.string(), z.unknown()).optional(),
  });
}

/** TypeScript type for SuccessResponse<T>. */
export interface SuccessResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Construct a SuccessResponse envelope.
 *
 * @param data - The response payload.
 * @param meta - Optional metadata to attach.
 */
export function toSuccessResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
): SuccessResponse<T> {
  const response: SuccessResponse<T> = { data };
  if (meta !== undefined) {
    response.meta = meta;
  }
  return response;
}

// ---------------------------------------------------------------------------
// PaginatedResponse<T> — envelope for list/collection responses
// ---------------------------------------------------------------------------

/**
 * Zod schema factory for PaginatedResponse<T>.
 *
 * @param itemSchema - Zod schema for each item in the collection.
 */
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    /** Array of items for the current page. */
    items: z.array(itemSchema),
    /** Total number of items across all pages. */
    total: z.number().int().nonnegative(),
    /** Current 1-based page number. */
    page: z.number().int().positive(),
    /** Maximum number of items per page. */
    limit: z.number().int().positive(),
    /** Whether a subsequent page exists. */
    hasMore: z.boolean(),
  });
}

/** TypeScript type for PaginatedResponse<T>. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Construct a PaginatedResponse envelope from raw list data.
 *
 * @param items  - Items for the current page.
 * @param total  - Total item count across all pages.
 * @param page   - Current 1-based page number.
 * @param limit  - Page size limit.
 */
export function toPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}
