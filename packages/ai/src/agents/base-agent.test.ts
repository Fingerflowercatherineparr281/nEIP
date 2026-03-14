/**
 * Unit tests for BaseAgent and AgentTrace.
 *
 * Covers:
 *   - AgentTrace step accumulation and string rendering
 *   - BaseAgent successful execution with confidence scoring
 *   - BaseAgent failure propagation
 *   - Tool registry call-through (happy path + missing tool)
 *   - Timeout enforcement
 *   - UnconfiguredLlmClient behaviour
 *
 * Story: 5.2
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function setTimeout(callback: (...args: any[]) => void, ms?: number): any;

import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@neip/shared';

import { ConfidenceZone, toConfidenceScore } from '../types/agent-types.js';
import type {
  AgentContext,
  AgentResult,
  ToolDescriptor,
  ToolRegistry,
} from '../types/agent-types.js';
import { AgentTrace, BaseAgent, UnconfiguredLlmClient } from './base-agent.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeContext = (overrides?: Partial<AgentContext>): AgentContext => ({
  tenantId: 'tenant-abc',
  userId: 'user-1',
  correlationId: 'corr-001',
  metadata: {},
  ...overrides,
});

// ---------------------------------------------------------------------------
// Concrete agent for testing
// ---------------------------------------------------------------------------

interface EchoInput {
  message: string;
  confidence: number;
}

interface EchoOutput {
  echo: string;
}

class EchoAgent extends BaseAgent<EchoInput, EchoOutput> {
  protected async executeCore(
    input: EchoInput,
    _context: AgentContext,
    trace: AgentTrace,
  ): Promise<AgentResult<EchoOutput>> {
    trace.addStep('reasoning', `Echoing: "${input.message}"`);
    const startMs = Date.now();
    return this.buildSuccess(
      { echo: input.message },
      input.confidence,
      trace,
      startMs,
    );
  }
}

class FailingAgent extends BaseAgent<unknown, never> {
  protected async executeCore(
    _input: unknown,
    _context: AgentContext,
    _trace: AgentTrace,
  ): Promise<AgentResult<never>> {
    throw new ValidationError({ detail: 'deliberate failure' });
  }
}

class SlowAgent extends BaseAgent<unknown, string> {
  protected async executeCore(
    _input: unknown,
    _context: AgentContext,
    trace: AgentTrace,
  ): Promise<AgentResult<string>> {
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    return this.buildSuccess('done', 0.95, trace, Date.now());
  }
}

class ToolCallingAgent extends BaseAgent<{ toolName: string }, unknown> {
  protected async executeCore(
    input: { toolName: string },
    _context: AgentContext,
    trace: AgentTrace,
  ): Promise<AgentResult<unknown>> {
    const result = await this.callTool<{ x: number }, { y: number }>(
      input.toolName,
      { x: 1 },
      trace,
    );
    if (!result.success) {
      return this.buildFailure(result.error, trace, Date.now());
    }
    return this.buildSuccess(result.data, 0.92, trace, Date.now());
  }
}

// ---------------------------------------------------------------------------
// AgentTrace
// ---------------------------------------------------------------------------

describe('AgentTrace', () => {
  it('accumulates steps and returns them as readonly', () => {
    const trace = new AgentTrace();
    trace.addStep('reasoning', 'first step');
    trace.addStep('llm-call', 'calling LLM', { model: 'claude' });

    expect(trace.steps).toHaveLength(2);
    expect(trace.steps[0]?.kind).toBe('reasoning');
    expect(trace.steps[1]?.kind).toBe('llm-call');
  });

  it('starts at iteration 0 and increments correctly', () => {
    const trace = new AgentTrace();
    expect(trace.iteration).toBe(0);
    trace.incrementIteration();
    expect(trace.iteration).toBe(1);
    trace.incrementIteration();
    expect(trace.iteration).toBe(2);
  });

  it('renders reasoning strings with kind and iteration prefix', () => {
    const trace = new AgentTrace();
    trace.addStep('tool-call', 'invoking lookup');
    const strings = trace.toReasoningStrings();

    expect(strings).toHaveLength(1);
    expect(strings[0]).toMatch(/\[tool-call@iter0\]/);
    expect(strings[0]).toContain('invoking lookup');
  });
});

// ---------------------------------------------------------------------------
// BaseAgent — happy path
// ---------------------------------------------------------------------------

describe('BaseAgent.execute', () => {
  it('returns AgentSuccess with correct zone for high confidence', async () => {
    const agent = new EchoAgent({ agentId: 'echo' });
    const result = await agent.execute(
      { message: 'hello', confidence: 0.95 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.echo).toBe('hello');
    expect(result.zone).toBe(ConfidenceZone.AUTO);
    expect(result.confidence).toBe(0.95);
    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns SUGGEST zone for 0.80 confidence', async () => {
    const agent = new EchoAgent({ agentId: 'echo' });
    const result = await agent.execute(
      { message: 'test', confidence: 0.8 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.zone).toBe(ConfidenceZone.SUGGEST);
  });

  it('returns REVIEW zone for 0.60 confidence', async () => {
    const agent = new EchoAgent({ agentId: 'echo' });
    const result = await agent.execute(
      { message: 'test', confidence: 0.6 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.zone).toBe(ConfidenceZone.REVIEW);
  });
});

// ---------------------------------------------------------------------------
// BaseAgent — failure path
// ---------------------------------------------------------------------------

describe('BaseAgent failure', () => {
  it('catches thrown errors and returns AgentFailure', async () => {
    const agent = new FailingAgent({ agentId: 'failing' });
    const result = await agent.execute(null, makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error.detail).toContain('deliberate failure');
    expect(result.zone).toBe(ConfidenceZone.BLOCKED);
    expect(result.confidence).toBe(toConfidenceScore(0));
  });
});

// ---------------------------------------------------------------------------
// BaseAgent — timeout
// ---------------------------------------------------------------------------

describe('BaseAgent timeout', () => {
  it('times out and returns AgentFailure', async () => {
    vi.useFakeTimers();

    const agent = new SlowAgent({ agentId: 'slow', timeoutMs: 100 });
    const ctx = makeContext();

    const promise = agent.execute(null, ctx);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.detail).toContain('exceeded timeout');
    expect(result.zone).toBe(ConfidenceZone.BLOCKED);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// BaseAgent — tool registry
// ---------------------------------------------------------------------------

describe('BaseAgent tool registry', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildRegistry = (tools: Record<string, ToolDescriptor<any, any>>): ToolRegistry => ({
    getTool: (name) => tools[name],
    listTools: () => Object.keys(tools),
  });

  it('calls a tool and returns its output on success', async () => {
    const doublerTool: ToolDescriptor<{ x: number }, { y: number }> = {
      name: 'doubler',
      description: 'doubles x',
      inputSchema: {},
      execute: async ({ x }) => ({ y: x * 2 }),
    };
    const registry = buildRegistry({ doubler: doublerTool });
    const agent = new ToolCallingAgent({ agentId: 'tool-caller', toolRegistry: registry });

    const result = await agent.execute({ toolName: 'doubler' }, makeContext());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as { y: number }).y).toBe(2);
    expect(result.zone).toBe(ConfidenceZone.AUTO);
  });

  it('returns failure when the tool is not in the registry', async () => {
    const registry = buildRegistry({});
    const agent = new ToolCallingAgent({ agentId: 'tool-caller', toolRegistry: registry });

    const result = await agent.execute({ toolName: 'missing-tool' }, makeContext());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.detail).toContain('not found');
  });

  it('returns failure when no registry is configured', async () => {
    const agent = new ToolCallingAgent({ agentId: 'no-registry' });
    const result = await agent.execute({ toolName: 'anything' }, makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.detail).toContain('no ToolRegistry');
  });

  it('lists available tools from registry', async () => {
    const registry = buildRegistry({
      toolA: { name: 'toolA', description: '', inputSchema: {}, execute: async () => ({}) },
      toolB: { name: 'toolB', description: '', inputSchema: {}, execute: async () => ({}) },
    });
    // Access via a subclass that exposes the protected method for testing
    class InspectAgent extends BaseAgent<void, string[]> {
      listTools(): ReadonlyArray<string> {
        return this.listAvailableTools();
      }
      protected async executeCore(
        _: void,
        __: AgentContext,
        trace: AgentTrace,
      ): Promise<AgentResult<string[]>> {
        return this.buildSuccess(
          [...this.listAvailableTools()],
          0.99,
          trace,
          Date.now(),
        );
      }
    }
    const agent = new InspectAgent({ agentId: 'inspect', toolRegistry: registry });
    expect(agent.listTools()).toEqual(expect.arrayContaining(['toolA', 'toolB']));
  });
});

// ---------------------------------------------------------------------------
// UnconfiguredLlmClient
// ---------------------------------------------------------------------------

describe('UnconfiguredLlmClient', () => {
  it('reports isConfigured as false', () => {
    const client = new UnconfiguredLlmClient();
    expect(client.isConfigured).toBe(false);
  });

  it('throws ValidationError when complete is called', async () => {
    const client = new UnconfiguredLlmClient();
    await expect(client.complete()).rejects.toBeInstanceOf(ValidationError);
  });

  it('has provider "none" and model "none"', () => {
    const client = new UnconfiguredLlmClient();
    expect(client.provider).toBe('none');
    expect(client.model).toBe('none');
  });
});
