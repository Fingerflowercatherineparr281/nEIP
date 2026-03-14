/**
 * Notification job handler — processes async notification delivery.
 *
 * Fetches user preferences and notification details from the database,
 * renders the template, delivers via the specified channel (email/LINE),
 * and updates the notification_log with the delivery result.
 *
 * Story 14.1 — Notification System
 */

import type { JobHandlerInput } from '../types/jobs.js';
import { JOB_NAMES } from '../types/jobs.js';
import { log } from '../logger.js';
import { NotificationService } from '@neip/core';
import type { SmtpConfig } from '@neip/core';

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface UserRow {
  email: string;
  name: string;
}

interface PreferencesRow {
  email_enabled: boolean;
  line_enabled: boolean;
  line_notify_token: string | null;
  event_hitl_created: boolean;
  event_approval_result: boolean;
  event_system_alert: boolean;
}

// ---------------------------------------------------------------------------
// SMTP config from env
// ---------------------------------------------------------------------------

function getSmtpConfig(): SmtpConfig | undefined {
  const host = process.env['SMTP_HOST'];
  const port = process.env['SMTP_PORT'];
  const user = process.env['SMTP_USER'];
  const pass = process.env['SMTP_PASS'];
  const from = process.env['SMTP_FROM'] ?? 'noreply@neip.app';

  if (!host || !port || !user || !pass) {
    return undefined;
  }

  return {
    host,
    port: parseInt(port, 10),
    secure: port === '465',
    user,
    pass,
    from,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleNotificationSend(
  job: JobHandlerInput<typeof JOB_NAMES.NOTIFICATION_SEND>,
): Promise<void> {
  log.info({
    msg: 'notification.send: processing',
    jobId: job.id,
    jobName: job.name,
    tenantId: job.data.tenantId,
    channel: job.data.channel,
    templateId: job.data.templateId,
    recipientUserId: job.data.recipientUserId,
    retryCount: job.retryCount,
  });

  // We need a raw postgres client. The worker doesn't have fastify's sql
  // decorator, so we create a minimal client from DATABASE_URL.
  const { createClient } = await import('@neip/db');
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }

  const { sql } = createClient(databaseUrl);

  try {
    // Look up recipient user
    const userRows = await sql<UserRow[]>`
      SELECT email, name FROM users WHERE id = ${job.data.recipientUserId}
    `;
    const user = userRows[0];
    if (!user) {
      log.warn({
        msg: 'notification.send: recipient user not found',
        jobId: job.id,
        recipientUserId: job.data.recipientUserId,
      });
      return;
    }

    // Look up preferences
    const prefRows = await sql<PreferencesRow[]>`
      SELECT email_enabled, line_enabled, line_notify_token,
             event_hitl_created, event_approval_result, event_system_alert
      FROM notification_preferences
      WHERE user_id = ${job.data.recipientUserId}
        AND tenant_id = ${job.data.tenantId}
      LIMIT 1
    `;

    // Default preferences if none exist
    const prefs: PreferencesRow = prefRows[0] ?? {
      email_enabled: true,
      line_enabled: false,
      line_notify_token: null,
      event_hitl_created: true,
      event_approval_result: true,
      event_system_alert: true,
    };

    // Check if this channel/event is enabled
    const channel = job.data.channel;
    if (channel === 'email' && !prefs.email_enabled) {
      log.info({
        msg: 'notification.send: email channel disabled by user preferences',
        jobId: job.id,
      });
      return;
    }
    if (channel === 'line' && (!prefs.line_enabled || !prefs.line_notify_token)) {
      log.info({
        msg: 'notification.send: LINE channel disabled or no token',
        jobId: job.id,
      });
      return;
    }

    // Create notification log entry
    const logId = crypto.randomUUID();
    await sql`
      INSERT INTO notification_log (
        id, tenant_id, user_id, channel, event_type, template_id,
        template_data, status, recipient_address, created_at
      )
      VALUES (
        ${logId}, ${job.data.tenantId}, ${job.data.recipientUserId},
        ${channel}, ${job.data.templateId}, ${job.data.templateId},
        ${JSON.stringify(job.data.templateData)}::jsonb,
        'pending',
        ${channel === 'email' ? user.email : 'LINE'},
        NOW()
      )
    `;

    // Send notification
    const smtpConfig = getSmtpConfig();
    const service = new NotificationService(smtpConfig);

    const result = await service.send({
      channel,
      recipientEmail: user.email,
      recipientName: user.name,
      templateId: job.data.templateId,
      templateData: job.data.templateData,
      lineNotifyToken: prefs.line_notify_token ?? undefined,
      language: 'th',
    });

    // Update notification log
    if (result.success) {
      await sql`
        UPDATE notification_log
        SET status = 'sent', delivered_at = NOW()
        WHERE id = ${logId}
      `;
      log.info({
        msg: 'notification.send: delivered',
        jobId: job.id,
        channel,
        recipientUserId: job.data.recipientUserId,
      });
    } else {
      await sql`
        UPDATE notification_log
        SET status = 'failed', error_message = ${result.error ?? 'Unknown error'}
        WHERE id = ${logId}
      `;
      log.error({
        msg: 'notification.send: delivery failed',
        jobId: job.id,
        channel,
        error: result.error,
      });
      // Throw to trigger pg-boss retry
      throw new Error(`Notification delivery failed: ${result.error ?? 'Unknown'}`);
    }
  } finally {
    // Clean up the sql connection
    await sql.end();
  }
}
