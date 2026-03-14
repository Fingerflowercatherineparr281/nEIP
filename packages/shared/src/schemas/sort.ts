import { z } from 'zod';

/**
 * SortSchema — common sort field + direction query parameters.
 */
export const SortDirectionSchema = z.enum(['asc', 'desc']).default('asc');

export type SortDirection = z.infer<typeof SortDirectionSchema>;

/**
 * Build a typed SortSchema for a specific set of sortable fields.
 *
 * @example
 *   const InvoiceSortSchema = makeSortSchema(['createdAt', 'amount', 'status']);
 */
export function makeSortSchema<T extends string>(
  allowedFields: readonly [T, ...T[]],
) {
  return z.object({
    sortBy: z.enum(allowedFields).optional(),
    sortDir: SortDirectionSchema.optional(),
  });
}

/** Generic SortSchema that accepts any non-empty string as sortBy */
export const SortSchema = z.object({
  sortBy: z.string().min(1).optional(),
  sortDir: SortDirectionSchema.optional(),
});

export type Sort = z.infer<typeof SortSchema>;
