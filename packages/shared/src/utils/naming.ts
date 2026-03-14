/**
 * Naming convention utility types for snake_case (DB) ↔ camelCase (API).
 * Architecture reference: AR39
 *
 * These are compile-time helpers; no runtime conversion is included here.
 * Use a library such as `camelcase-keys` or `snakecase-keys` for runtime
 * transformation in the adapter/infrastructure layer.
 */

// ---------------------------------------------------------------------------
// String manipulation helpers
// ---------------------------------------------------------------------------

/** Convert a single snake_case word segment to a capitalised form */
type Capitalise<S extends string> = S extends `${infer F}${infer R}`
  ? `${Uppercase<F>}${R}`
  : S;

/** Convert snake_case string literal to camelCase */
export type SnakeToCamel<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalise<SnakeToCamel<Tail>>}`
    : S;

/** Convert camelCase string literal to snake_case */
export type CamelToSnake<S extends string> =
  S extends `${infer Head}${infer Tail}`
    ? Head extends Uppercase<Head>
      ? Head extends Lowercase<Head>
        ? `${Head}${CamelToSnake<Tail>}`
        : `_${Lowercase<Head>}${CamelToSnake<Tail>}`
      : `${Head}${CamelToSnake<Tail>}`
    : S;

// ---------------------------------------------------------------------------
// Object key transformations
// ---------------------------------------------------------------------------

/**
 * Transform all keys of an object type from snake_case to camelCase.
 *
 * @example
 *   type DbRow = { created_at: Date; tenant_id: string };
 *   type ApiShape = SnakeKeysToCamel<DbRow>;
 *   // => { createdAt: Date; tenantId: string }
 */
export type SnakeKeysToCamel<T> = {
  [K in keyof T as SnakeToCamel<K & string>]: T[K] extends object
    ? T[K] extends Date | bigint | Array<unknown>
      ? T[K]
      : SnakeKeysToCamel<T[K]>
    : T[K];
};

/**
 * Transform all keys of an object type from camelCase to snake_case.
 *
 * @example
 *   type ApiDto = { createdAt: Date; tenantId: string };
 *   type DbShape = CamelKeysToSnake<ApiDto>;
 *   // => { created_at: Date; tenant_id: string }
 */
export type CamelKeysToSnake<T> = {
  [K in keyof T as CamelToSnake<K & string>]: T[K] extends object
    ? T[K] extends Date | bigint | Array<unknown>
      ? T[K]
      : CamelKeysToSnake<T[K]>
    : T[K];
};

// ---------------------------------------------------------------------------
// Branded string types for explicit naming conventions
// ---------------------------------------------------------------------------

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

/** A string that has been verified/typed as camelCase */
export type CamelCaseString = Brand<string, 'CamelCase'>;

/** A string that has been verified/typed as snake_case */
export type SnakeCaseString = Brand<string, 'SnakeCase'>;

/** A string that has been verified/typed as PascalCase */
export type PascalCaseString = Brand<string, 'PascalCase'>;

/** A string that has been verified/typed as kebab-case */
export type KebabCaseString = Brand<string, 'KebabCase'>;
