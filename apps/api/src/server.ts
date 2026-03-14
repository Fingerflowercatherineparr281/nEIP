/**
 * server.ts — Fastify bootstrap.
 *
 * Responsible for:
 *   - Reading validated environment configuration via @neip/shared env
 *   - Calling createApp() to build the fully configured Fastify instance
 *   - Starting the HTTP listener on the configured port
 *   - Handling graceful shutdown on SIGTERM / SIGINT
 *
 * This module is NOT the entry point — index.ts imports it and triggers
 * start() which keeps side-effects out of the module scope, aiding testability.
 */

import { env } from '@neip/shared';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app.js';

// ---------------------------------------------------------------------------
// Module-level logger (plain Pino, created before Fastify instance exists)
// ---------------------------------------------------------------------------

import pino from 'pino';

const bootstrapLogger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname', colorize: true },
        },
      }
    : {}),
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

let appInstance: FastifyInstance | null = null;

/**
 * Build the Fastify app and start listening on the configured port.
 *
 * @returns The running FastifyInstance (useful in tests to call `.close()`).
 */
export async function start(): Promise<FastifyInstance> {
  const app = await createApp({
    corsOrigins:
      env.NODE_ENV === 'production'
        ? (process.env['CORS_ORIGINS']?.split(',').map((o) => o.trim()) ?? [])
        : '*',
    jwtSecret: env.JWT_SECRET,
    databaseUrl: env.DATABASE_URL,
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
  });

  appInstance = app;

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    bootstrapLogger.info(
      { port: env.PORT, nodeEnv: env.NODE_ENV },
      'nEIP API server listening',
    );
  } catch (err) {
    bootstrapLogger.error({ err }, 'Failed to start server');
    process.exit(1);
  }

  return app;
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  bootstrapLogger.info({ signal }, 'Shutdown signal received — closing server');

  if (appInstance) {
    try {
      await appInstance.close();
      bootstrapLogger.info('Server closed cleanly');
    } catch (err) {
      bootstrapLogger.error({ err }, 'Error during server shutdown');
      process.exit(1);
    }
  }

  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
