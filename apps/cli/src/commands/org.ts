/**
 * neip org — Organisation (tenant) management commands.
 *
 * Commands:
 *   neip org create <name>   — POST /api/v1/organizations — create a new organisation
 *   neip org list            — GET  /api/v1/organizations/:id — show current organisation
 *   neip org switch <id>     — save the active org to local config (no API call)
 *
 * API notes:
 *   - POST /api/v1/organizations requires { name, businessType }
 *   - GET  /api/v1/organizations/:id returns { id, name, slug, settings, createdAt, updatedAt }
 *   - There is no list-all-orgs endpoint; each user can only view their own organisation
 *     which is identified by the `tenantId` claim inside their JWT access token.
 */

import { type Command, createCommand } from 'commander';
import { api } from '../lib/api-client.js';
import { getConfigValue, patchConfig } from '../lib/config-store.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for GET /api/v1/organizations/:id */
interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: {
    businessType?: string;
    fiscalYearStart?: number;
    locale?: string;
    currency?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

/** Response shape for POST /api/v1/organizations */
interface CreatedOrganization {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  fiscalYearId: string;
  createdAt: string;
}

/** JWT payload claims we extract for tenant resolution. */
interface JwtClaims {
  sub: string;
  email: string;
  tenantId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode the payload of a JWT (no signature verification) and return claims.
 * Returns null on any parse error.
 */
function decodeJwtPayload(token: string): JwtClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadB64 = parts[1];
    if (payloadB64 === undefined) return null;
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(decoded) as JwtClaims;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function orgCreate(name: string, businessType: string): Promise<void> {
  if (name.trim() === '') {
    printError('Organisation name is required.');
    process.exit(1);
  }

  const validTypes = ['company', 'sme', 'individual', 'nonprofit', 'government'];
  if (!validTypes.includes(businessType.trim())) {
    printError(`Invalid business type "${businessType}". Must be one of: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  const result = await api.post<CreatedOrganization>('/api/v1/organizations', {
    name: name.trim(),
    businessType: businessType.trim(),
  });

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const org = result.data;
  printSuccess(org, `Organisation "${org.name}" created (id: ${org.id}).`);
}

async function orgList(): Promise<void> {
  // The API only exposes GET /api/v1/organizations/:id for your own org.
  // We resolve the org ID from the tenantId claim in the stored JWT.
  const token = getConfigValue('accessToken');
  if (token === undefined || token === '') {
    printError('Not authenticated. Run `neip auth login` first.');
    process.exit(1);
  }

  const claims = decodeJwtPayload(token);
  const tenantId = claims?.tenantId;

  if (tenantId === undefined || tenantId === '') {
    printError('Unable to determine organisation from stored token. Run `neip auth login` again.');
    process.exit(1);
  }

  const result = await api.get<Organization>(`/api/v1/organizations/${tenantId}`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const org = result.data;
  const activeOrgId = getConfigValue('orgId');

  const display = {
    id: org.id,
    name: org.name,
    slug: org.slug,
    businessType: org.settings.businessType ?? '',
    createdAt: org.createdAt,
    active: org.id === activeOrgId ? '*' : '',
  };

  printSuccess([display], '1 organisation found.');
}

function orgSwitch(id: string): void {
  if (id.trim() === '') {
    printError('Organisation ID is required.');
    process.exit(1);
  }

  patchConfig({ orgId: id.trim() });
  printSuccess({ orgId: id.trim() }, `Active organisation set to "${id.trim()}".`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `org` sub-command group.
 */
export function buildOrgCommand(): Command {
  const org = createCommand('org')
    .description('จัดการองค์กร (tenant) — Organisation management');

  org
    .command('create <name>')
    .description('สร้างองค์กรใหม่ — Create a new organisation')
    .option(
      '--business-type <type>',
      'ประเภทธุรกิจ: company, sme, individual, nonprofit, government',
      'sme',
    )
    .addHelpText('after', `
Examples:
  $ neip org create "ABC Company Ltd" --business-type company
  $ neip org create "ร้านค้า XYZ" --business-type sme
  `)
    .action(async (name: string, options: { businessType: string }) => {
      await orgCreate(name, options.businessType);
    });

  org
    .command('list')
    .description('แสดงองค์กรปัจจุบัน — Show your current organisation')
    .addHelpText('after', `
Examples:
  $ neip org list                    # ดูองค์กรที่ใช้งานอยู่
  `)
    .action(async () => {
      await orgList();
    });

  org
    .command('switch <id>')
    .description('เปลี่ยนองค์กรที่ใช้งานอยู่ — Set the active organisation for all subsequent commands')
    .addHelpText('after', `
Examples:
  $ neip org switch org-uuid-here    # เปลี่ยนไปองค์กรที่ระบุ
  `)
    .action((id: string) => {
      orgSwitch(id);
    });

  return org;
}
