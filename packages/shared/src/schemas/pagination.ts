import { z } from 'zod';

/**
 * PaginationSchema — common page/limit query parameters.
 * Defaults: page=1, limit=20. Max limit is 100.
 */
export const PaginationSchema = z.object({
  /** 1-based page number */
  page: z
    .coerce.number()
    .int('page must be an integer')
    .positive('page must be positive')
    .default(1),
  /** Number of items per page (max 100) */
  limit: z
    .coerce.number()
    .int('limit must be an integer')
    .positive('limit must be positive')
    .max(100, 'limit may not exceed 100')
    .default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;
