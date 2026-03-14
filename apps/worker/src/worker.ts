/**
 * pg-boss bootstrap module.
 *
 * Responsibilities:
 *   - Create and start a PgBoss instance using DATABASE_URL
 *   - Register all job handlers (one boss.work() call per job name)
 *   - Expose a health probe (getQueueStatus) for the /health endpoint
 *   - Graceful shutdown: drain in-flight jobs, then stop pg-boss
 *
 * Architecture references: AR10, NFR-R7, NFR-O2, NFR-O3
 */

import { PgBoss } from 'pg-boss';
import type { JobWithMetadata } from 'pg-boss';
import type { JobName, JobPayloadMap, JobHandlerInput } from './types/jobs.js';
import { JOB_NAMES } from './types/jobs.js';
import { handleExamplePing } from './handlers/example-handler.js';
import { handleInvoiceMatch } from './handlers/invoice-matching-handler.js';
import { handleImport } from './handlers/import-handler.js';
import { handleMonthEndClose } from './handlers/month-end-close-handler.js';
import { handleNotificationSend } from './handlers/notification-handler.js';
import { handleWebhookDelivery } from './handlers/webhook-delivery-handler.js';
import { log } from './logger.js';

// ---------------------------------------------------------------------------
// pg-boss retry / DLQ policy constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of delivery attempts before a job is moved to the
 * dead-letter archive.  Backoff is exponential by default in pg-boss.
 */
const MAX_RETRIES = 3;

/**
 * pg-boss archive retention in days — failed jobs kept for post-mortem.
 */
const ARCHIVE_DAYS = 14;

// ---------------------------------------------------------------------------
// Queue status (for health check endpoint)
// ---------------------------------------------------------------------------

export interface QueueStatus {
  readonly healthy: boolean;
  readonly started: boolean;
  readonly error: string | null;
}

let _bossStarted = false;
let _startError: string | null = null;

export function getQueueStatus(): QueueStatus {
  return {
    healthy: _bossStarted && _startError === null,
    started: _bossStarted,
    error: _startError,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the pg-boss options object from the connection string.
 * DATABASE_URL is validated by @neip/shared env before we reach this point.
 */
function buildBossOptions(connectionString: string): ConstructorParameters<typeof PgBoss>[0] {
  return {
    connectionString,
    // Keep a pg-boss schema separate from the application schema
    schema: 'pgboss',
    // How often pg-boss maintenance (expiry, archival) runs — in seconds
    monitorIntervalSeconds: 30,
    // pg connection pool size kept small — worker is not query-heavy
    max: 5,
  };
}

/**
 * Queue-level default options applied when createQueue is called or when a
 * job is first sent to an unregistered queue name.
 *
 * Retry policy: 3 attempts with exponential back-off starting at 5 s.
 * Retention: jobs retained 14 days after completion for post-mortem analysis.
 */
const DEFAULT_QUEUE_OPTIONS = {
  retryLimit: MAX_RETRIES,
  retryDelay: 5,
  retryBackoff: true,
  deleteAfterSeconds: ARCHIVE_DAYS * 24 * 60 * 60,
} as const;

/**
 * Registers a single job name with pg-boss using strongly-typed data.
 *
 * pg-boss v12 work() callbacks receive Job<T>[] (an array).  We use
 * includeMetadata: true to get retryCount and createdOn on each item.
 *
 * Our JobHandlerInput<N> wraps the metadata into a stable, type-safe
 * interface that is independent of pg-boss internals.
 */
async function registerHandler<N extends JobName>(
  boss: PgBoss,
  name: N,
  handler: (job: JobHandlerInput<N>) => Promise<void>,
): Promise<void> {
  // Upsert the queue with retry / retention defaults so policy is set
  // consistently regardless of whether the queue was previously created.
  await boss.createQueue(name, {
    ...DEFAULT_QUEUE_OPTIONS,
    // Dead-letter queue stores permanently failed jobs for inspection
    deadLetter: `${name}.dlq`,
  });

  await boss.work<JobPayloadMap[N]>(
    name,
    {
      localConcurrency: 2,
      includeMetadata: true,
    },
    async (jobs: JobWithMetadata<JobPayloadMap[N]>[]) => {
      // pg-boss batches jobs; iterate and process each independently
      for (const job of jobs) {
        const input: JobHandlerInput<N> = {
          id: job.id,
          name: name,
          data: job.data,
          createdOn: job.createdOn.toISOString(),
          retryCount: job.retryCount,
        };

        try {
          await handler(input);
        } catch (err) {
          log.error({
            msg: 'job handler threw — pg-boss will retry',
            jobId: job.id,
            jobName: name,
            tenantId: (job.data as { tenantId?: string }).tenantId ?? 'unknown',
            retryCount: job.retryCount,
            maxRetries: MAX_RETRIES,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
          throw err; // re-throw so pg-boss records the failure for this job
        }
      }
    },
  );

  log.info({ msg: 'handler registered', jobName: name });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates, starts, and configures the pg-boss instance.
 *
 * Returns the running PgBoss instance so the caller (index.ts) can hold a
 * reference for graceful shutdown.
 */
export async function startWorker(databaseUrl: string): Promise<PgBoss> {
  log.info({ msg: 'worker: starting pg-boss' });

  const boss = new PgBoss(buildBossOptions(databaseUrl));

  // Surface pg-boss internal errors without crashing the process outright
  boss.on('error', (err: unknown) => {
    log.error({
      msg: 'pg-boss internal error',
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  });

  try {
    await boss.start();
    _bossStarted = true;
    log.info({ msg: 'worker: pg-boss started successfully' });
  } catch (err) {
    _startError = err instanceof Error ? err.message : String(err);
    log.error({
      msg: 'worker: failed to start pg-boss',
      error: _startError,
    });
    throw err;
  }

  // ------------------------------------------------------------------
  // Register all job handlers.
  // Each entry maps a JOB_NAMES constant to its handler function.
  // Add new handlers here as new job types are introduced.
  // ------------------------------------------------------------------

  await registerHandler(boss, JOB_NAMES.EXAMPLE_PING, handleExamplePing);
  await registerHandler(boss, JOB_NAMES.INVOICE_MATCH, handleInvoiceMatch);
  await registerHandler(boss, JOB_NAMES.CSV_IMPORT, handleImport);
  await registerHandler(boss, JOB_NAMES.MONTH_END_CLOSE, handleMonthEndClose);

  await registerHandler(boss, JOB_NAMES.NOTIFICATION_SEND, handleNotificationSend);
  await registerHandler(boss, JOB_NAMES.WEBHOOK_DELIVER, handleWebhookDelivery);

  // Future handlers — uncomment as stories implement them:
  // await registerHandler(boss, JOB_NAMES.PAYMENT_APPLY, handlePaymentApply);

  log.info({ msg: 'worker: all handlers registered', handlerCount: 6 });

  return boss;
}

/**
 * Gracefully stops pg-boss.
 *
 * Called from the SIGTERM / SIGINT handlers in index.ts.
 * boss.stop() waits for in-flight jobs to finish before releasing connections.
 */
export async function stopWorker(boss: PgBoss): Promise<void> {
  log.info({ msg: 'worker: stopping pg-boss (draining in-flight jobs)' });

  try {
    await boss.stop({ graceful: true, timeout: 30_000 });
    _bossStarted = false;
    log.info({ msg: 'worker: pg-boss stopped cleanly' });
  } catch (err) {
    log.error({
      msg: 'worker: error while stopping pg-boss',
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
