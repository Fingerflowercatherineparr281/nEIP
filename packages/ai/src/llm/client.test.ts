/**
 * Unit tests for LLM client module.
 *
 * Covers:
 *   - createLlmClient returns UnconfiguredLlmClient when no API key
 *   - createLlmClientSync creates a ClaudeLlmClient with a mock SDK
 *   - ClaudeLlmClient.complete builds correct API params
 *   - ClaudeLlmClient.complete parses text and tool_use response blocks
 *   - ClaudeLlmClient.complete throws ValidationError on API errors
 *
 * Story: 5.2
 */

import { describe, expect, it } from 'vitest';
import { ValidationError } from '@neip/shared';

import {
  ANTHROPIC_PROVIDER,
  ClaudeLlmClient,
  DEFAULT_CLAUDE_MODEL,
  createLlmClient,
  createLlmClientSync,
} from './client.js';
import { UnconfiguredLlmClient } from '../agents/base-agent.js';
import type { LlmMessage } from '../types/agent-types.js';

// ---------------------------------------------------------------------------
// Minimal mock for AnthropicSdk
// ---------------------------------------------------------------------------

type MockSdkCreate = (params: unknown) => Promise<{
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  >;
  usage: { input_tokens: number; output_tokens: number };
}>;

function makeMockSdk(create: MockSdkCreate) {
  return { messages: { create } };
}

// ---------------------------------------------------------------------------
// createLlmClient (async factory)
// ---------------------------------------------------------------------------

describe('createLlmClient', () => {
  it('returns UnconfiguredLlmClient when LLM_API_KEY is absent', async () => {
    const client = await createLlmClient({ apiKey: '' });
    expect(client).toBeInstanceOf(UnconfiguredLlmClient);
    expect(client.isConfigured).toBe(false);
  });

  it('returns UnconfiguredLlmClient when apiKey is whitespace', async () => {
    const client = await createLlmClient({ apiKey: '   ' });
    expect(client).toBeInstanceOf(UnconfiguredLlmClient);
  });
});

// ---------------------------------------------------------------------------
// createLlmClientSync
// ---------------------------------------------------------------------------

describe('createLlmClientSync', () => {
  it('creates a ClaudeLlmClient with the given SDK', () => {
    const sdk = makeMockSdk(async () => ({
      content: [],
      usage: { input_tokens: 0, output_tokens: 0 },
    }));
    const client = createLlmClientSync(sdk as never);

    expect(client).toBeInstanceOf(ClaudeLlmClient);
    expect(client.isConfigured).toBe(true);
    expect(client.provider).toBe(ANTHROPIC_PROVIDER);
    expect(client.model).toBe(DEFAULT_CLAUDE_MODEL);
  });

  it('uses the model override when provided', () => {
    const sdk = makeMockSdk(async () => ({
      content: [],
      usage: { input_tokens: 0, output_tokens: 0 },
    }));
    const client = createLlmClientSync(sdk as never, { model: 'claude-3-opus-20240229' });
    expect(client.model).toBe('claude-3-opus-20240229');
  });
});

// ---------------------------------------------------------------------------
// ClaudeLlmClient.complete
// ---------------------------------------------------------------------------

describe('ClaudeLlmClient.complete', () => {
  const userMessage: LlmMessage = { role: 'user', content: 'Hello' };

  it('parses a text response', async () => {
    const sdk = makeMockSdk(async () => ({
      content: [{ type: 'text' as const, text: 'Hi there!' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    }));
    const client = createLlmClientSync(sdk as never);

    const response = await client.complete([userMessage]);
    expect(response.content).toBe('Hi there!');
    expect(response.toolCalls).toHaveLength(0);
    expect(response.usage.inputTokens).toBe(10);
    expect(response.usage.outputTokens).toBe(5);
  });

  it('parses a tool_use response', async () => {
    const sdk = makeMockSdk(async () => ({
      content: [
        {
          type: 'tool_use' as const,
          id: 'call-1',
          name: 'lookup',
          input: { query: 'test' },
        },
      ],
      usage: { input_tokens: 20, output_tokens: 8 },
    }));
    const client = createLlmClientSync(sdk as never);

    const response = await client.complete([userMessage]);
    expect(response.content).toBeNull();
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls[0]?.id).toBe('call-1');
    expect(response.toolCalls[0]?.name).toBe('lookup');
    expect(response.toolCalls[0]?.arguments).toEqual({ query: 'test' });
  });

  it('concatenates multiple text blocks', async () => {
    const sdk = makeMockSdk(async () => ({
      content: [
        { type: 'text' as const, text: 'Part 1.' },
        { type: 'text' as const, text: 'Part 2.' },
      ],
      usage: { input_tokens: 5, output_tokens: 5 },
    }));
    const client = createLlmClientSync(sdk as never);

    const response = await client.complete([userMessage]);
    expect(response.content).toBe('Part 1.\nPart 2.');
  });

  it('includes a system message when present', async () => {
    let capturedParams: unknown;
    const sdk = makeMockSdk(async (params) => {
      capturedParams = params;
      return { content: [], usage: { input_tokens: 0, output_tokens: 0 } };
    });
    const client = createLlmClientSync(sdk as never);

    const messages: LlmMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ];
    await client.complete(messages);

    expect((capturedParams as { system: string }).system).toBe('You are helpful.');
  });

  it('throws ValidationError when no user/assistant messages are provided', async () => {
    const sdk = makeMockSdk(async () => ({
      content: [],
      usage: { input_tokens: 0, output_tokens: 0 },
    }));
    const client = createLlmClientSync(sdk as never);

    const systemOnly: LlmMessage[] = [{ role: 'system', content: 'System only' }];
    await expect(client.complete(systemOnly)).rejects.toBeInstanceOf(ValidationError);
  });

  it('wraps API errors in ValidationError', async () => {
    const sdk = makeMockSdk(async () => {
      throw new Error('rate limit exceeded');
    });
    const client = createLlmClientSync(sdk as never);

    await expect(client.complete([userMessage])).rejects.toBeInstanceOf(ValidationError);
  });
});
