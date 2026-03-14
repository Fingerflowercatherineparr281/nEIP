/**
 * Notification routes:
 *   GET    /api/v1/notifications/settings  — get user notification preferences
 *   PUT    /api/v1/notifications/settings  — update user notification preferences
 *   GET    /api/v1/notifications           — notification history
 *
 * Story 14.1 — Notification System
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationSettingsBody {
  emailEnabled?: boolean;
  lineEnabled?: boolean;
  lineNotifyToken?: string | null;
  eventHitlCreated?: boolean;
  eventApprovalResult?: boolean;
  eventSystemAlert?: boolean;
}

interface NotificationHistoryQuery {
  limit?: number;
  offset?: number;
  status?: string;
}

interface NotificationSettingsRow {
  id: string;
  email_enabled: boolean;
  line_enabled: boolean;
  line_notify_token: string | null;
  event_hitl_created: boolean;
  event_approval_result: boolean;
  event_system_alert: boolean;
}

interface NotificationLogRow {
  id: string;
  channel: string;
  event_type: string;
  template_id: string;
  status: string;
  error_message: string | null;
  recipient_address: string | null;
  created_at: string;
  delivered_at: string | null;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function notificationRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /api/v1/notifications/settings
  // -------------------------------------------------------------------------
  fastify.get(
    `${API_V1_PREFIX}/notifications/settings`,
    {
      schema: {
        description: 'Get user notification preferences',
        tags: ['notifications'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              emailEnabled: { type: 'boolean' },
              lineEnabled: { type: 'boolean' },
              lineNotifyToken: { type: 'string', nullable: true },
              eventHitlCreated: { type: 'boolean' },
              eventApprovalResult: { type: 'boolean' },
              eventSystemAlert: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const userId = request.user.sub;

      const rows = await fastify.sql<NotificationSettingsRow[]>`
        SELECT id, email_enabled, line_enabled, line_notify_token,
               event_hitl_created, event_approval_result, event_system_alert
        FROM notification_preferences
        WHERE user_id = ${userId} AND tenant_id = ${tenantId}
        LIMIT 1
      `;

      const row = rows[0];
      if (!row) {
        // Return defaults if no preferences exist
        return reply.status(200).send({
          emailEnabled: true,
          lineEnabled: false,
          lineNotifyToken: null,
          eventHitlCreated: true,
          eventApprovalResult: true,
          eventSystemAlert: true,
        });
      }

      return reply.status(200).send({
        emailEnabled: row.email_enabled,
        lineEnabled: row.line_enabled,
        lineNotifyToken: row.line_notify_token,
        eventHitlCreated: row.event_hitl_created,
        eventApprovalResult: row.event_approval_result,
        eventSystemAlert: row.event_system_alert,
      });
    },
  );

  // -------------------------------------------------------------------------
  // PUT /api/v1/notifications/settings
  // -------------------------------------------------------------------------
  fastify.put<{ Body: NotificationSettingsBody }>(
    `${API_V1_PREFIX}/notifications/settings`,
    {
      schema: {
        description: 'Update user notification preferences',
        tags: ['notifications'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            emailEnabled: { type: 'boolean' },
            lineEnabled: { type: 'boolean' },
            lineNotifyToken: { type: 'string', nullable: true },
            eventHitlCreated: { type: 'boolean' },
            eventApprovalResult: { type: 'boolean' },
            eventSystemAlert: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              emailEnabled: { type: 'boolean' },
              lineEnabled: { type: 'boolean' },
              lineNotifyToken: { type: 'string', nullable: true },
              eventHitlCreated: { type: 'boolean' },
              eventApprovalResult: { type: 'boolean' },
              eventSystemAlert: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const userId = request.user.sub;
      const body = request.body;

      // Upsert preferences
      const rows = await fastify.sql<NotificationSettingsRow[]>`
        INSERT INTO notification_preferences (
          id, tenant_id, user_id,
          email_enabled, line_enabled, line_notify_token,
          event_hitl_created, event_approval_result, event_system_alert,
          created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), ${tenantId}, ${userId},
          ${body.emailEnabled ?? true}, ${body.lineEnabled ?? false}, ${body.lineNotifyToken ?? null},
          ${body.eventHitlCreated ?? true}, ${body.eventApprovalResult ?? true}, ${body.eventSystemAlert ?? true},
          NOW(), NOW()
        )
        ON CONFLICT (user_id, tenant_id)
        DO UPDATE SET
          email_enabled = COALESCE(${body.emailEnabled ?? null}::boolean, notification_preferences.email_enabled),
          line_enabled = COALESCE(${body.lineEnabled ?? null}::boolean, notification_preferences.line_enabled),
          line_notify_token = CASE
            WHEN ${body.lineNotifyToken !== undefined} THEN ${body.lineNotifyToken ?? null}
            ELSE notification_preferences.line_notify_token
          END,
          event_hitl_created = COALESCE(${body.eventHitlCreated ?? null}::boolean, notification_preferences.event_hitl_created),
          event_approval_result = COALESCE(${body.eventApprovalResult ?? null}::boolean, notification_preferences.event_approval_result),
          event_system_alert = COALESCE(${body.eventSystemAlert ?? null}::boolean, notification_preferences.event_system_alert),
          updated_at = NOW()
        RETURNING id, email_enabled, line_enabled, line_notify_token,
                  event_hitl_created, event_approval_result, event_system_alert
      `;

      const row = rows[0];
      if (!row) {
        return reply.status(500).send({ error: 'Failed to upsert preferences' });
      }

      return reply.status(200).send({
        emailEnabled: row.email_enabled,
        lineEnabled: row.line_enabled,
        lineNotifyToken: row.line_notify_token,
        eventHitlCreated: row.event_hitl_created,
        eventApprovalResult: row.event_approval_result,
        eventSystemAlert: row.event_system_alert,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/notifications
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: NotificationHistoryQuery }>(
    `${API_V1_PREFIX}/notifications`,
    {
      schema: {
        description: 'Get notification history for the current user',
        tags: ['notifications'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            status: { type: 'string', enum: ['pending', 'sent', 'failed'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    channel: { type: 'string' },
                    eventType: { type: 'string' },
                    templateId: { type: 'string' },
                    status: { type: 'string' },
                    errorMessage: { type: 'string', nullable: true },
                    recipientAddress: { type: 'string', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    deliveredAt: { type: 'string', format: 'date-time', nullable: true },
                  },
                },
              },
              total: { type: 'integer' },
            },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const userId = request.user.sub;
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;
      const status = request.query.status;

      let logRows: NotificationLogRow[];
      let countRows: Array<{ count: string }>;

      if (status) {
        logRows = await fastify.sql<NotificationLogRow[]>`
          SELECT id, channel, event_type, template_id, status,
                 error_message, recipient_address,
                 created_at::text, delivered_at::text
          FROM notification_log
          WHERE user_id = ${userId} AND tenant_id = ${tenantId} AND status = ${status}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countRows = await fastify.sql<Array<{ count: string }>>`
          SELECT COUNT(*)::text as count
          FROM notification_log
          WHERE user_id = ${userId} AND tenant_id = ${tenantId} AND status = ${status}
        `;
      } else {
        logRows = await fastify.sql<NotificationLogRow[]>`
          SELECT id, channel, event_type, template_id, status,
                 error_message, recipient_address,
                 created_at::text, delivered_at::text
          FROM notification_log
          WHERE user_id = ${userId} AND tenant_id = ${tenantId}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        countRows = await fastify.sql<Array<{ count: string }>>`
          SELECT COUNT(*)::text as count
          FROM notification_log
          WHERE user_id = ${userId} AND tenant_id = ${tenantId}
        `;
      }

      const total = parseInt(countRows[0]?.count ?? '0', 10);

      return reply.status(200).send({
        items: logRows.map((row) => ({
          id: row.id,
          channel: row.channel,
          eventType: row.event_type,
          templateId: row.template_id,
          status: row.status,
          errorMessage: row.error_message,
          recipientAddress: row.recipient_address,
          createdAt: row.created_at,
          deliveredAt: row.delivered_at,
        })),
        total,
      });
    },
  );
}
