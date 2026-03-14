import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type DbSchema = typeof schema;

/**
 * Build a Drizzle database instance backed by a postgres.js connection pool.
 *
 * Connection string is resolved from the `DATABASE_URL` environment variable.
 * All pool tunables can be overridden via the optional `options` argument.
 */
export function createClient(
  connectionString?: string,
  options?: {
    max?: number;
    idle_timeout?: number;
    connect_timeout?: number;
  },
) {
  const url = connectionString ?? process.env['DATABASE_URL'];

  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is required to create the database client.',
    );
  }

  const sql = postgres(url, {
    max: options?.max ?? 10,
    idle_timeout: options?.idle_timeout ?? 30,
    connect_timeout: options?.connect_timeout ?? 10,
    prepare: false, // required for compatibility with PgBouncer / RLS session vars
  });

  const db = drizzle(sql, { schema });

  return { db, sql };
}

export type DbClient = ReturnType<typeof createClient>['db'];
