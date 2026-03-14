/**
 * Tenant routes barrel — registers all /api/v1/organizations/* routes.
 *
 * Routes:
 *   POST /api/v1/organizations          — create organization
 *   GET  /api/v1/organizations/:id      — get organization details
 *   PUT  /api/v1/organizations/:id      — update organization
 *   PUT  /api/v1/organizations/:id/settings — configure BYOK LLM API key
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { createOrganizationRoute } from './create-organization.js';
import { getOrganizationRoute } from './get-organization.js';
import { updateOrganizationRoute } from './update-organization.js';
import { updateSettingsRoute } from './update-settings.js';

export async function tenantRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(createOrganizationRoute);
  await fastify.register(getOrganizationRoute);
  await fastify.register(updateOrganizationRoute);
  await fastify.register(updateSettingsRoute);
}
