import { z } from 'zod';

/**
 * FilterSchema — generic key/value filter structure.
 *
 * Supports simple equality filters as well as common comparison operators.
 * Domain schemas can extend or combine this with field-specific refinements.
 */

/** Primitive filter value */
const FilterValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type FilterValue = z.infer<typeof FilterValueSchema>;

/** A single filter condition with optional operator */
export const FilterConditionSchema = z.object({
  /** The field name to filter on (camelCase API naming) */
  field: z.string().min(1),
  /** Comparison operator — defaults to equality */
  op: z
    .enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'like', 'in'])
    .default('eq'),
  /** The value to compare against */
  value: z.union([FilterValueSchema, z.array(FilterValueSchema)]),
});

export type FilterCondition = z.infer<typeof FilterConditionSchema>;

/**
 * FilterSchema — an array of filter conditions combined with AND logic.
 * Pass an empty array to retrieve all records without filtering.
 */
export const FilterSchema = z.object({
  filters: z.array(FilterConditionSchema).default([]),
});

export type Filter = z.infer<typeof FilterSchema>;

/** Combined query schema: pagination + sort + filter */
export const QuerySchema = FilterSchema;
export type Query = z.infer<typeof QuerySchema>;
