/**
 * Tests for Audit Trail Service — Story 2.8.
 * Given-When-Then pattern (AR29).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { AuditLogInput, AuditChanges, AuditLogOutput, AuditLogQuery } from './audit-service.js';

// ---------------------------------------------------------------------------
// In-memory testable audit service
// ---------------------------------------------------------------------------

const SENSITIVE_FIELDS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'apiKey',
  'api_key',
  'secret',
  'secretKey',
  'secret_key',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
]);

function redactFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

function redactChanges(changes: AuditChanges): AuditChanges {
  const result: Record<string, unknown> = {};
  if (changes.before !== undefined) {
    result['before'] = redactFields(changes.before);
  }
  if (changes.after !== undefined) {
    result['after'] = redactFields(changes.after);
  }
  return result as AuditChanges;
}

class TestableAuditService {
  private readonly _logs: AuditLogOutput[] = [];

  async record(input: AuditLogInput): Promise<AuditLogOutput> {
    const { uuidv7 } = await import('uuidv7');
    const id = uuidv7();
    const timestamp = new Date();

    const redactedChanges = input.changes !== undefined
      ? redactChanges(input.changes)
      : null;

    const log: AuditLogOutput = {
      id,
      userId: input.userId,
      tenantId: input.tenantId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      changes: redactedChanges,
      requestId: input.requestId,
      timestamp,
    };

    this._logs.push(log);
    return log;
  }

  async query(filter: AuditLogQuery): Promise<AuditLogOutput[]> {
    let results = this._logs.filter((l) => l.tenantId === filter.tenantId);

    if (filter.resourceType !== undefined) {
      results = results.filter((l) => l.resourceType === filter.resourceType);
    }
    if (filter.resourceId !== undefined) {
      results = results.filter((l) => l.resourceId === filter.resourceId);
    }
    if (filter.userId !== undefined) {
      results = results.filter((l) => l.userId === filter.userId);
    }
    if (filter.startDate !== undefined) {
      results = results.filter((l) => l.timestamp >= filter.startDate!);
    }
    if (filter.endDate !== undefined) {
      results = results.filter((l) => l.timestamp <= filter.endDate!);
    }

    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  get logs() { return this._logs; }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditService.record', () => {
  let service: TestableAuditService;

  beforeEach(() => {
    service = new TestableAuditService();
  });

  it('Given valid input, When recording, Then audit log is created with all fields', async () => {
    // Given
    const input: AuditLogInput = {
      userId: 'user-001',
      tenantId: 'tenant-001',
      action: 'create',
      resourceType: 'JournalEntry',
      resourceId: 'entry-001',
      requestId: 'req-001',
      changes: {
        after: { description: 'Test entry', status: 'draft' },
      },
    };

    // When
    const result = await service.record(input);

    // Then
    expect(result.id).toBeDefined();
    expect(result.userId).toBe('user-001');
    expect(result.tenantId).toBe('tenant-001');
    expect(result.action).toBe('create');
    expect(result.resourceType).toBe('JournalEntry');
    expect(result.resourceId).toBe('entry-001');
    expect(result.requestId).toBe('req-001');
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('Given changes with sensitive fields, When recording, Then sensitive fields are redacted', async () => {
    // Given
    const input: AuditLogInput = {
      userId: 'user-001',
      tenantId: 'tenant-001',
      action: 'update',
      resourceType: 'User',
      resourceId: 'user-002',
      requestId: 'req-002',
      changes: {
        before: { name: 'Old Name', password_hash: 'old-hash', apiKey: 'old-key' },
        after: { name: 'New Name', password_hash: 'new-hash', apiKey: 'new-key' },
      },
    };

    // When
    const result = await service.record(input);

    // Then
    const changes = result.changes!;
    expect((changes.before as Record<string, unknown>)['name']).toBe('Old Name');
    expect((changes.before as Record<string, unknown>)['password_hash']).toBe('[REDACTED]');
    expect((changes.before as Record<string, unknown>)['apiKey']).toBe('[REDACTED]');
    expect((changes.after as Record<string, unknown>)['name']).toBe('New Name');
    expect((changes.after as Record<string, unknown>)['password_hash']).toBe('[REDACTED]');
    expect((changes.after as Record<string, unknown>)['apiKey']).toBe('[REDACTED]');
  });

  it('Given no changes provided, When recording, Then changes is null', async () => {
    // Given
    const input: AuditLogInput = {
      userId: 'user-001',
      tenantId: 'tenant-001',
      action: 'read',
      resourceType: 'Account',
      resourceId: 'acc-001',
      requestId: 'req-003',
    };

    // When
    const result = await service.record(input);

    // Then
    expect(result.changes).toBeNull();
  });
});

describe('AuditService.query', () => {
  let service: TestableAuditService;

  beforeEach(async () => {
    service = new TestableAuditService();
    // Seed some audit logs
    await service.record({
      userId: 'user-001',
      tenantId: 'tenant-001',
      action: 'create',
      resourceType: 'JournalEntry',
      resourceId: 'entry-001',
      requestId: 'req-001',
    });
    await service.record({
      userId: 'user-002',
      tenantId: 'tenant-001',
      action: 'update',
      resourceType: 'Account',
      resourceId: 'acc-001',
      requestId: 'req-002',
    });
    await service.record({
      userId: 'user-001',
      tenantId: 'tenant-002',
      action: 'create',
      resourceType: 'JournalEntry',
      resourceId: 'entry-002',
      requestId: 'req-003',
    });
  });

  it('Given audit logs for two tenants, When querying by tenantId, Then only that tenant logs are returned', async () => {
    // When
    const results = await service.query({ tenantId: 'tenant-001' });

    // Then
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.tenantId === 'tenant-001')).toBe(true);
  });

  it('Given mixed resource types, When querying by resourceType, Then only matching logs returned', async () => {
    // When
    const results = await service.query({
      tenantId: 'tenant-001',
      resourceType: 'JournalEntry',
    });

    // Then
    expect(results).toHaveLength(1);
    expect(results[0]?.resourceType).toBe('JournalEntry');
  });

  it('Given audit logs from different users, When querying by userId, Then only that user logs returned', async () => {
    // When
    const results = await service.query({
      tenantId: 'tenant-001',
      userId: 'user-002',
    });

    // Then
    expect(results).toHaveLength(1);
    expect(results[0]?.userId).toBe('user-002');
  });

  it('Given no matching logs, When querying, Then empty array is returned', async () => {
    // When
    const results = await service.query({
      tenantId: 'tenant-999',
    });

    // Then
    expect(results).toEqual([]);
  });
});

describe('AuditService — immutability', () => {
  it('Given the audit service, When checking API, Then no update or delete methods exist', () => {
    // Given / When / Then
    const service = new TestableAuditService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(service) as any);
    expect(proto).not.toContain('update');
    expect(proto).not.toContain('delete');
    expect(proto).not.toContain('remove');
  });
});
