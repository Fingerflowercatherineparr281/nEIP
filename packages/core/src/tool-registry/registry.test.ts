/**
 * Tests for ToolRegistry — Story 2.2.
 * Architecture reference: AR15 (Tool Registry pattern)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { AppError, ValidationError, ok, err } from '@neip/shared';
import { ToolRegistry } from './registry.js';
import type { ExecutionContext, ToolDefinition } from './types.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const CTX: ExecutionContext = {
  tenantId: 'tenant-001',
  userId: 'user-42',
  requestId: 'req-abc123',
};

const CreateEntrySchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
});
type CreateEntryInput = z.infer<typeof CreateEntrySchema>;

interface EntryResult {
  id: string;
  description: string;
  amount: number;
}

const glCreateJournalEntry: ToolDefinition<CreateEntryInput, EntryResult> = {
  name: 'gl.createJournalEntry',
  description: 'Create a general-ledger journal entry.',
  inputSchema: CreateEntrySchema,
  handler: async (params, _ctx) => {
    return ok({
      id: 'je-001',
      description: params.description,
      amount: params.amount,
    });
  },
};

// ---------------------------------------------------------------------------
// Helper: build a fresh registry with glCreateJournalEntry pre-registered
// ---------------------------------------------------------------------------

function registryWithEntry(): ToolRegistry {
  const reg = new ToolRegistry();
  reg.register(glCreateJournalEntry);
  return reg;
}

// ---------------------------------------------------------------------------
// register()
// ---------------------------------------------------------------------------

describe('ToolRegistry.register', () => {
  it('registers a tool without throwing', () => {
    const reg = new ToolRegistry();
    expect(() => reg.register(glCreateJournalEntry)).not.toThrow();
  });

  it('throws when registering the same tool name twice', () => {
    const reg = new ToolRegistry();
    reg.register(glCreateJournalEntry);
    expect(() => reg.register(glCreateJournalEntry)).toThrow(
      'ToolRegistry: tool "gl.createJournalEntry" is already registered.',
    );
  });

  it('allows registering multiple tools with different names', () => {
    const reg = new ToolRegistry();
    const tool2: ToolDefinition<{ x: number }, { y: number }> = {
      name: 'ar.createInvoice',
      description: 'Create an AR invoice.',
      inputSchema: z.object({ x: z.number() }),
      handler: async (p) => ok({ y: p.x }),
    };
    expect(() => {
      reg.register(glCreateJournalEntry);
      reg.register(tool2);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// execute() — success path
// ---------------------------------------------------------------------------

describe('ToolRegistry.execute — success', () => {
  it('returns a successful ToolResult with the handler data', async () => {
    const reg = registryWithEntry();
    const result = await reg.execute<EntryResult>(
      'gl.createJournalEntry',
      { description: 'Opening balance', amount: 1000 },
      CTX,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('je-001');
      expect(result.data.description).toBe('Opening balance');
      expect(result.data.amount).toBe(1000);
    }
  });

  it('passes the execution context to the handler', async () => {
    const capturedCtx: ExecutionContext[] = [];
    const reg = new ToolRegistry();
    reg.register({
      name: 'test.echoCtx',
      description: 'Echo context.',
      inputSchema: z.object({}),
      handler: async (_p, ctx) => {
        capturedCtx.push(ctx);
        return ok({ done: true });
      },
    });

    await reg.execute('test.echoCtx', {}, CTX);

    expect(capturedCtx).toHaveLength(1);
    expect(capturedCtx[0]).toEqual(CTX);
  });
});

// ---------------------------------------------------------------------------
// execute() — validation failure
// ---------------------------------------------------------------------------

describe('ToolRegistry.execute — validation failure', () => {
  it('returns failure with ValidationError when params fail schema', async () => {
    const reg = registryWithEntry();
    const result = await reg.execute<EntryResult>(
      'gl.createJournalEntry',
      { description: '', amount: -50 }, // empty description, negative amount
      CTX,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.status).toBe(400);
    }
  });

  it('includes structured field errors from Zod issues', async () => {
    const reg = registryWithEntry();
    const result = await reg.execute<EntryResult>(
      'gl.createJournalEntry',
      { description: 42, amount: 'not-a-number' }, // wrong types
      CTX,
    );

    expect(result.success).toBe(false);
    if (!result.success && result.error instanceof ValidationError) {
      expect(result.error.errors).toBeDefined();
      const fields = (result.error.errors ?? []).map((e) => e.field);
      expect(fields).toContain('description');
      expect(fields).toContain('amount');
    }
  });

  it('does NOT call the handler when validation fails', async () => {
    const handlerCalls: number[] = [];
    const reg = new ToolRegistry();
    reg.register({
      name: 'test.counted',
      description: 'Count calls.',
      inputSchema: z.object({ value: z.number() }),
      handler: async (_p) => {
        handlerCalls.push(1);
        return ok({ done: true });
      },
    });

    await reg.execute('test.counted', { value: 'wrong' }, CTX);
    expect(handlerCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// execute() — unknown tool
// ---------------------------------------------------------------------------

describe('ToolRegistry.execute — unknown tool', () => {
  it('returns failure with AppError status 404 for an unregistered tool name', async () => {
    const reg = new ToolRegistry();
    const result = await reg.execute<never>('unknown.tool', {}, CTX);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.status).toBe(404);
      expect(result.error.detail).toContain('"unknown.tool"');
    }
  });
});

// ---------------------------------------------------------------------------
// execute() — handler error wrapping
// ---------------------------------------------------------------------------

describe('ToolRegistry.execute — handler error wrapping', () => {
  it('wraps an unknown Error thrown by the handler in AppError status 500', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'test.throws',
      description: 'Always throws.',
      inputSchema: z.object({}),
      handler: async () => {
        throw new Error('database connection lost');
      },
    });

    const result = await reg.execute<never>('test.throws', {}, CTX);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.status).toBe(500);
      expect(result.error.detail).toContain('database connection lost');
    }
  });

  it('passes through an AppError thrown by the handler unchanged', async () => {
    const domainError = new AppError({
      type: 'https://problems.neip.app/conflict',
      title: 'Conflict',
      status: 409,
      detail: 'Duplicate journal entry.',
    });
    const reg = new ToolRegistry();
    reg.register({
      name: 'test.appErrorThrows',
      description: 'Throws an AppError.',
      inputSchema: z.object({}),
      handler: async () => {
        throw domainError;
      },
    });

    const result = await reg.execute<never>('test.appErrorThrows', {}, CTX);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(domainError);
      expect(result.error.status).toBe(409);
    }
  });

  it('returns handler err() result unchanged', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'test.returnsErr',
      description: 'Returns err().',
      inputSchema: z.object({}),
      handler: async () =>
        err(
          new AppError({
            type: 'https://problems.neip.app/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'Tenant is inactive.',
          }),
        ),
    });

    const result = await reg.execute<never>('test.returnsErr', {}, CTX);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.status).toBe(403);
    }
  });

  it('wraps a non-Error thrown value in AppError status 500', async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'test.throwsString',
      description: 'Throws a string.',
      inputSchema: z.object({}),
      handler: async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'plain string error';
      },
    });

    const result = await reg.execute<never>('test.throwsString', {}, CTX);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.status).toBe(500);
      expect(result.error.detail).toContain('plain string error');
    }
  });
});

// ---------------------------------------------------------------------------
// list()
// ---------------------------------------------------------------------------

describe('ToolRegistry.list', () => {
  it('returns an empty array when no tools are registered', () => {
    const reg = new ToolRegistry();
    expect(reg.list()).toEqual([]);
  });

  it('returns all registered tool definitions', () => {
    const reg = new ToolRegistry();
    const tool2: ToolDefinition<{ x: number }, { y: number }> = {
      name: 'ar.createInvoice',
      description: 'Create an AR invoice.',
      inputSchema: z.object({ x: z.number() }),
      handler: async (p) => ok({ y: p.x }),
    };
    reg.register(glCreateJournalEntry);
    reg.register(tool2);

    const listed = reg.list();
    expect(listed).toHaveLength(2);
    const names = listed.map((t) => t.name);
    expect(names).toContain('gl.createJournalEntry');
    expect(names).toContain('ar.createInvoice');
  });

  it('includes name and description in listed definitions', () => {
    const reg = registryWithEntry();
    const [entry] = reg.list();
    expect(entry?.name).toBe('gl.createJournalEntry');
    expect(entry?.description).toBe('Create a general-ledger journal entry.');
  });

  it('reflects newly registered tools after initial listing', () => {
    const reg = new ToolRegistry();
    expect(reg.list()).toHaveLength(0);

    reg.register(glCreateJournalEntry);
    expect(reg.list()).toHaveLength(1);

    reg.register({
      name: 'ap.createBill',
      description: 'Create an AP bill.',
      inputSchema: z.object({ vendor: z.string() }),
      handler: async (p) => ok({ vendor: p.vendor }),
    });
    expect(reg.list()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Domain namespace convention
// ---------------------------------------------------------------------------

describe('Domain namespace convention', () => {
  it('allows registering tools from multiple domains', () => {
    const reg = new ToolRegistry();
    const tools = [
      { name: 'gl.createJournalEntry', domain: 'gl' },
      { name: 'ar.createInvoice', domain: 'ar' },
      { name: 'ap.createBill', domain: 'ap' },
    ] as const;

    tools.forEach(({ name }) => {
      reg.register({
        name,
        description: `Tool ${name}`,
        inputSchema: z.object({}),
        handler: async () => ok({ done: true }),
      });
    });

    const names = reg.list().map((t) => t.name);
    expect(names).toContain('gl.createJournalEntry');
    expect(names).toContain('ar.createInvoice');
    expect(names).toContain('ap.createBill');
  });
});

// ---------------------------------------------------------------------------
// beforeEach guard — each test starts with a fresh registry
// ---------------------------------------------------------------------------
describe('Registry isolation', () => {
  let reg: ToolRegistry;

  beforeEach(() => {
    reg = new ToolRegistry();
  });

  it('starts empty', () => {
    expect(reg.list()).toHaveLength(0);
  });

  it('is independent from other test suites', async () => {
    reg.register(glCreateJournalEntry);
    const result = await reg.execute<EntryResult>(
      'gl.createJournalEntry',
      { description: 'Test entry', amount: 500 },
      CTX,
    );
    expect(result.success).toBe(true);
  });
});
