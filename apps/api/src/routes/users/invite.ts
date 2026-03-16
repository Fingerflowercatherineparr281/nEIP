/**
 * POST /api/v1/users/invite
 *
 * Allows an Owner to invite a new user to their tenant and assign a role.
 * The invited user is created immediately with a placeholder password hash;
 * a real invitation email flow (with one-time tokens) is deferred to a later
 * story. For MVP-α the endpoint returns the new user's profile.
 *
 * Acceptance criteria (Story 4.3, AC#1):
 *   Owner invites user via POST /api/v1/users/invite with role assignment
 *   (Owner / Accountant / Approver).
 *
 * Authorization:
 *   Requires `user:invite` permission (Owner role by default).
 *
 * Architecture references:
 *   AR22  — Custom table-based RBAC
 *   FR36  — Role-based access control
 *   FR37  — Enforcement on all API routes
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  API_V1_PREFIX,
} from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { toISO } from '../../lib/to-iso.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { USER_INVITE } from '../../lib/permissions.js';
import type { DefaultRoleName } from '../../lib/permissions.js';
import { ROLE_OWNER, ROLE_ACCOUNTANT, ROLE_APPROVER } from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// Valid role names accepted by this endpoint
// ---------------------------------------------------------------------------

const VALID_ROLE_NAMES: readonly DefaultRoleName[] = [
  ROLE_OWNER,
  ROLE_ACCOUNTANT,
  ROLE_APPROVER,
] as const;

function isValidRoleName(value: string): value is DefaultRoleName {
  return (VALID_ROLE_NAMES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const inviteBodySchema = {
  type: 'object',
  required: ['email', 'name', 'role'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'Email address of the user to invite',
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Display name of the invited user',
    },
    role: {
      type: 'string',
      enum: [ROLE_OWNER, ROLE_ACCOUNTANT, ROLE_APPROVER],
      description: 'Role to assign to the invited user',
    },
  },
} as const;

const inviteResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'User UUID' },
    email: { type: 'string', description: 'User email address' },
    name: { type: 'string', description: 'Display name' },
    tenantId: { type: 'string', description: 'Tenant this user belongs to' },
    role: { type: 'string', description: 'Assigned role name' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  email: string;
  name: string;
  tenant_id: string;
  created_at: Date | string;
}

interface RoleRow {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

interface InviteBody {
  email: string;
  name: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function inviteRoute(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.post<{ Body: InviteBody }>(
    `${API_V1_PREFIX}/users/invite`,
    {
      schema: {
        description:
          'Invite a new user to the current tenant and assign a role (Owner only)',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        body: inviteBodySchema,
        response: {
          201: {
            description: 'User invited and created successfully',
            ...inviteResponseSchema,
          },
        },
      },
      preHandler: [requireAuth, requirePermission(USER_INVITE)],
    },
    async (request, reply) => {
      const { email, name, role } = request.body;
      const { tenantId } = request.user;

      // Belt-and-suspenders role name validation in addition to AJV enum check.
      if (!isValidRoleName(role)) {
        throw new ValidationError({
          detail: `Invalid role "${role}". Must be one of: ${VALID_ROLE_NAMES.join(', ')}.`,
          errors: [{ field: 'role', message: 'Must be Owner, Accountant, or Approver.' }],
        });
      }

      const normalizedEmail = email.toLowerCase();

      // Check for an existing user with this email (global uniqueness per schema).
      const existing = await fastify.sql<[{ id: string }?]>`
        SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1
      `;

      if (existing.length > 0) {
        request.log.warn(
          { email: normalizedEmail, invitedBy: request.user.sub },
          'Invite attempted for existing email',
        );
        throw new ConflictError({
          detail: `A user with email ${email} already exists.`,
        });
      }

      // Resolve the target role within this tenant.
      const roleRows = await fastify.sql<[RoleRow?]>`
        SELECT id, name FROM roles
        WHERE name = ${role} AND tenant_id = ${tenantId}
        LIMIT 1
      `;

      const targetRole = roleRows[0];
      if (!targetRole) {
        throw new NotFoundError({
          detail: `Role "${role}" has not been seeded for this tenant. Run seedRoles first.`,
        });
      }

      // Create the invited user.
      // Password hash is set to a sentinel value — the user must set a real
      // password via a password-reset flow (implemented in a later story).
      // The sentinel is NOT a valid argon2 hash, so login will always fail
      // until the user claims their account.
      const userId = crypto.randomUUID();
      const PLACEHOLDER_HASH = 'INVITE_PENDING';

      const userRows = await fastify.sql<[UserRow?]>`
        INSERT INTO users (id, email, password_hash, name, tenant_id)
        VALUES (${userId}, ${normalizedEmail}, ${PLACEHOLDER_HASH}, ${name}, ${tenantId})
        RETURNING id, email, name, tenant_id, created_at
      `;

      const createdUser = userRows[0];
      if (!createdUser) {
        throw new Error('Failed to create invited user — no row returned from insert.');
      }

      // Assign the role to the new user within the tenant.
      await fastify.sql`
        INSERT INTO user_roles (user_id, role_id, tenant_id)
        VALUES (${createdUser.id}, ${targetRole.id}, ${tenantId})
        ON CONFLICT DO NOTHING
      `;

      request.log.info(
        {
          invitedUserId: createdUser.id,
          invitedEmail: createdUser.email,
          role,
          tenantId,
          invitedBy: request.user.sub,
        },
        'User invited successfully',
      );

      return reply.status(201).send({
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        tenantId: createdUser.tenant_id,
        role: targetRole.name,
        createdAt: toISO(createdUser.created_at),
      });
    },
  );
}
