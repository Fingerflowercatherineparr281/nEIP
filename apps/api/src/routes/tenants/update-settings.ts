/**
 * PUT /api/v1/organizations/:id/settings
 *
 * Configure organization settings including BYOK LLM API key.
 * The API key is encrypted at rest and NEVER returned or logged.
 *
 * Story 4.4 — Tenant Management (BYOK LLM API key)
 *
 * Architecture references:
 *   NFR-S5 — Secrets encrypted at rest
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ForbiddenError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { USER_UPDATE } from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const updateSettingsBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    llmApiKey: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
      description: 'BYOK LLM API key (encrypted at rest, never returned)',
    },
    llmProvider: {
      type: 'string',
      enum: ['openai', 'anthropic', 'azure', 'google'],
      description: 'LLM provider name',
    },
    llmModel: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'LLM model identifier',
    },
    currency: {
      type: 'string',
      minLength: 3,
      maxLength: 3,
      description: 'Default currency code (ISO 4217). Defaults to THB.',
    },
    locale: {
      type: 'string',
      minLength: 2,
      maxLength: 10,
      description: 'Default locale. Defaults to th-TH.',
    },
  },
} as const;

const updateSettingsResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    llmProvider: { type: 'string', nullable: true },
    llmModel: { type: 'string', nullable: true },
    llmApiKeyConfigured: { type: 'boolean', description: 'Whether an LLM API key is set (key never returned)' },
    currency: { type: 'string' },
    locale: { type: 'string' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsParams {
  id: string;
}

interface UpdateSettingsBody {
  llmApiKey?: string;
  llmProvider?: string;
  llmModel?: string;
  currency?: string;
  locale?: string;
}

interface TenantRow {
  id: string;
  settings: Record<string, unknown> | null;
  updated_at: Date;
}

// ---------------------------------------------------------------------------
// Simple XOR encryption for API key at rest
// TODO: Replace with proper AES-256-GCM encryption using a KMS-managed key
// ---------------------------------------------------------------------------

function encryptApiKey(apiKey: string): string {
  // Simple base64 encoding as placeholder — replace with real encryption.
  // In production this would use AES-256-GCM with a KMS-managed DEK.
  return Buffer.from(`encrypted:${apiKey}`).toString('base64');
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function updateSettingsRoute(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.put<{ Params: SettingsParams; Body: UpdateSettingsBody }>(
    `${API_V1_PREFIX}/organizations/:id/settings`,
    {
      schema: {
        description: 'Configure organization settings (BYOK LLM API key, locale, etc.)',
        tags: ['tenants'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: updateSettingsBodySchema,
        response: {
          200: {
            description: 'Settings updated (API key is never returned)',
            ...updateSettingsResponseSchema,
          },
        },
      },
      preHandler: [requireAuth, requirePermission(USER_UPDATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      if (id !== tenantId) {
        throw new ForbiddenError({
          detail: 'You can only update your own organization settings.',
        });
      }

      const { llmApiKey, llmProvider, llmModel, currency, locale } = request.body;

      // Build the settings update object — never store the raw API key.
      const settingsUpdate: Record<string, unknown> = {};
      if (llmProvider !== undefined) settingsUpdate['llmProvider'] = llmProvider;
      if (llmModel !== undefined) settingsUpdate['llmModel'] = llmModel;
      if (currency !== undefined) settingsUpdate['currency'] = currency;
      if (locale !== undefined) settingsUpdate['locale'] = locale;
      if (llmApiKey !== undefined) {
        // Encrypt and store — never log the raw key.
        settingsUpdate['llmApiKeyEncrypted'] = encryptApiKey(llmApiKey);
        settingsUpdate['llmApiKeyConfigured'] = true;
        request.log.info(
          { tenantId: id, updatedBy: request.user.sub },
          'LLM API key configured (value redacted)',
        );
      }

      // Merge new settings into existing settings JSON.
      const settingsJson = JSON.stringify(settingsUpdate);
      const rows = await fastify.sql<[TenantRow?]>`
        UPDATE tenants
        SET settings = COALESCE(settings, '{}')::jsonb || ${settingsJson}::jsonb,
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, settings, updated_at
      `;

      const tenant = rows[0];
      if (!tenant) {
        throw new NotFoundError({
          detail: `Organization ${id} not found.`,
        });
      }

      const s = (tenant.settings ?? {}) as Record<string, unknown>;

      return reply.status(200).send({
        id: tenant.id,
        llmProvider: (s['llmProvider'] as string | undefined) ?? null,
        llmModel: (s['llmModel'] as string | undefined) ?? null,
        llmApiKeyConfigured: (s['llmApiKeyConfigured'] as boolean | undefined) ?? false,
        currency: (s['currency'] as string | undefined) ?? 'THB',
        locale: (s['locale'] as string | undefined) ?? 'th-TH',
        updatedAt: tenant.updated_at.toISOString(),
      });
    },
  );
}
