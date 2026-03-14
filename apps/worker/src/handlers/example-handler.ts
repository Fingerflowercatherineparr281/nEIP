/**
 * Example job handler — demonstrates the canonical handler pattern.
 *
 * Every real handler in nEIP follows this exact shape:
 *   1. Accept a strongly-typed JobHandlerInput<N>
 *   2. Log job start with structured metadata
 *   3. Execute business logic
 *   4. Log completion (or re-throw on unrecoverable failure)
 *
 * pg-boss will call boss.work() which invokes this function once per job.
 * Throwing causes the job to be retried (up to maxRetries configured in
 * worker.ts).  Returning void (resolved) marks the job as completed.
 */

import type { JobHandlerInput } from '../types/jobs.js';
import { JOB_NAMES } from '../types/jobs.js';
import { log } from '../logger.js';

export async function handleExamplePing(
  job: JobHandlerInput<typeof JOB_NAMES.EXAMPLE_PING>,
): Promise<void> {
  log.info({
    msg: 'example.ping: processing',
    jobId: job.id,
    jobName: job.name,
    tenantId: job.data.tenantId,
    correlationId: job.data.correlationId,
    retryCount: job.retryCount,
  });

  // --- Business logic placeholder ---
  const { message } = job.data;
  log.info({
    msg: 'example.ping: echoing message',
    jobId: job.id,
    tenantId: job.data.tenantId,
    message,
  });

  // Simulate async work without blocking the event loop
  await Promise.resolve();

  log.info({
    msg: 'example.ping: completed',
    jobId: job.id,
    tenantId: job.data.tenantId,
  });
}
