/**
 * Worker entry point — nEIP background job processor.
 *
 * Boot sequence:
 *   1. Validate environment (DATABASE_URL, etc.) via @neip/shared env
 *   2. Start the health-check HTTP server
 *   3. Start pg-boss and register all job handlers
 *   4. Attach SIGTERM / SIGINT handlers for graceful shutdown
 *
 * Graceful shutdown sequence (NFR-R7):
 *   1. Stop accepting new HTTP health requests
 *   2. Call boss.stop({ graceful: true }) — waits for in-flight jobs
 *   3. Exit with code 0
 */

import { env } from '@neip/shared';
import { startWorker, stopWorker } from './worker.js';
import { startHealthServer, stopHealthServer } from './health.js';
import { log } from './logger.js';

// ---------------------------------------------------------------------------
// Main boot function
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log.info({
    msg: 'worker: booting',
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
  });

  // 1. Start health server first so the container is probe-able during boot
  const healthPort = process.env['WORKER_HEALTH_PORT'] !== undefined
    ? parseInt(process.env['WORKER_HEALTH_PORT'], 10)
    : 5401;

  const healthServer = startHealthServer(healthPort);

  // 2. Start pg-boss and register handlers
  const boss = await startWorker(env.DATABASE_URL);

  log.info({ msg: 'worker: ready — processing jobs' });

  // 3. Graceful shutdown handler
  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      log.warn({ msg: 'worker: shutdown already in progress — ignoring signal', signal });
      return;
    }
    shuttingDown = true;

    log.info({ msg: 'worker: received signal, shutting down gracefully', signal });

    try {
      // Stop health server (stops accepting new probes)
      await stopHealthServer(healthServer);
      log.info({ msg: 'worker: health server closed' });

      // Drain in-flight jobs and stop pg-boss
      await stopWorker(boss);
      log.info({ msg: 'worker: shutdown complete' });

      process.exit(0);
    } catch (err) {
      log.error({
        msg: 'worker: error during shutdown',
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Catch unhandled promise rejections so they are logged before crashing
  process.on('unhandledRejection', (reason) => {
    log.error({
      msg: 'worker: unhandled promise rejection',
      error: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    // Do not exit — pg-boss supervision continues
  });

  process.on('uncaughtException', (err) => {
    log.error({
      msg: 'worker: uncaught exception — forcing shutdown',
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  process.stderr.write(
    JSON.stringify({ level: 'error', msg: 'worker: fatal startup error', error: message, stack }) +
      '\n',
  );
  process.exit(1);
});
