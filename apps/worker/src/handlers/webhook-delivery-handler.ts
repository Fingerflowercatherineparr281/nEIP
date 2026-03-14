/**
 * Webhook delivery job handler — Story 13.1.
 *
 * Processes webhook.deliver jobs queued by the Event Store when new
 * domain events are appended. Delivers the event payload to the
 * registered webhook URL with HMAC-SHA256 signature.
 *
 * The WebhookService handles retry logic with exponential backoff
 * (max 5 attempts) and marks webhooks as 'failing' after exhaustion.
 */

import { createClient } from '@neip/db';
import { WebhookService } from '@neip/core';
import type { JobHandlerInput } from '../types/jobs.js';
import { JOB_NAMES } from '../types/jobs.js';
import { log } from '../logger.js';

export async function handleWebhookDelivery(
  job: JobHandlerInput<typeof JOB_NAMES.WEBHOOK_DELIVER>,
): Promise<void> {
  log.info({
    msg: 'webhook.deliver: processing',
    jobId: job.id,
    jobName: job.name,
    tenantId: job.data.tenantId,
    webhookId: job.data.webhookId,
    eventType: job.data.event.type,
    retryCount: job.retryCount,
  });

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for webhook delivery');
  }

  const { db } = createClient(databaseUrl);
  const webhookService = new WebhookService(db);

  const result = await webhookService.deliver(
    {
      id: job.data.webhookId,
      tenantId: job.data.tenantId,
      url: job.data.webhookUrl,
      events: [],
      status: 'active',
      lastDeliveryAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    job.data.event,
  );

  if (result.success) {
    log.info({
      msg: 'webhook.deliver: completed successfully',
      jobId: job.id,
      webhookId: job.data.webhookId,
      statusCode: result.statusCode,
      attempt: result.attempt,
    });
  } else {
    log.error({
      msg: 'webhook.deliver: delivery failed',
      jobId: job.id,
      webhookId: job.data.webhookId,
      error: result.error,
      statusCode: result.statusCode,
      attempt: result.attempt,
    });
    // Don't re-throw — the WebhookService already handled retries internally
    // and marked the webhook as 'failing' if all attempts exhausted.
  }
}
