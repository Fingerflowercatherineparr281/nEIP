/**
 * Health check route — GET /api/health
 *
 * Returns the liveness/readiness status of the application, database connection,
 * and (optionally) queue connectivity. Designed for load-balancer and k8s probes.
 *
 * Response shape:
 *   { status: 'ok' | 'degraded' | 'down', checks: { app, db, queue }, uptime, timestamp }
 *
 * HTTP status codes:
 *   200 — all checks healthy or degraded (non-critical services unhealthy)
 *   503 — critical path failure (app or database check fails)
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { Sql } from 'postgres';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckStatus = 'ok' | 'degraded' | 'error';

interface ServiceCheck {
  status: CheckStatus;
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  checks: {
    app: ServiceCheck;
    db: ServiceCheck;
    queue: ServiceCheck;
  };
  uptime: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// DB probe — uses the raw postgres.js client to avoid a drizzle-orm import
// ---------------------------------------------------------------------------

async function checkDatabase(sql: Sql): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    await sql`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown database error',
    };
  }
}

// ---------------------------------------------------------------------------
// Queue probe (stub — queue provisioned in a later epic)
// ---------------------------------------------------------------------------

async function checkQueue(): Promise<ServiceCheck> {
  // Queue infrastructure is added in Epic 5+.
  // Return 'degraded' (non-critical) so health does not block early deploys.
  return { status: 'degraded', error: 'queue not yet configured' };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function healthRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const { sql } = fastify;

  fastify.get(
    '/api/health',
    {
      schema: {
        description: 'Application health check — liveness and readiness probe',
        tags: ['system'],
        response: {
          200: {
            description: 'Service is healthy or degraded',
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
              checks: {
                type: 'object',
                properties: {
                  app: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      latencyMs: { type: 'number' },
                      error: { type: 'string' },
                    },
                  },
                  db: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      latencyMs: { type: 'number' },
                      error: { type: 'string' },
                    },
                  },
                  queue: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      latencyMs: { type: 'number' },
                      error: { type: 'string' },
                    },
                  },
                },
              },
              uptime: { type: 'number' },
              timestamp: { type: 'string' },
            },
          },
          503: {
            description: 'Service is down — critical dependency unavailable',
            type: 'object',
            properties: {
              status: { type: 'string' },
              checks: { type: 'object' },
              uptime: { type: 'number' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const [dbCheck, queueCheck] = await Promise.all([
        checkDatabase(sql),
        checkQueue(),
      ]);

      const appCheck: ServiceCheck = { status: 'ok' };

      const criticalFailed = dbCheck.status === 'error' || appCheck.status === 'error';
      const anyDegraded =
        dbCheck.status === 'degraded' || queueCheck.status === 'degraded';

      const overallStatus: 'ok' | 'degraded' | 'down' = criticalFailed
        ? 'down'
        : anyDegraded
          ? 'degraded'
          : 'ok';

      const body: HealthResponse = {
        status: overallStatus,
        checks: { app: appCheck, db: dbCheck, queue: queueCheck },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };

      const httpStatus = overallStatus === 'down' ? 503 : 200;
      return reply.status(httpStatus).send(body);
    },
  );
}
