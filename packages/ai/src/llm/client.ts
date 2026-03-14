/**
 * LLM client setup — BYOK (Bring Your Own Key) configuration.
 *
 * Reads LLM_API_KEY from the environment (via @neip/shared env).
 * Wraps the Anthropic Claude API with the pluggable LlmClient interface
 * so that agents remain decoupled from the underlying SDK.
 *
 * When no API key is present the factory returns UnconfiguredLlmClient,
 * which lets agents degrade gracefully (rule-based fallback or BLOCKED zone).
 *
 * Architecture reference: AR11, FR17
 * Story: 5.2
 */

import { ValidationError } from '@neip/shared';

import type {
  LlmClient,
  LlmCompletionOptions,
  LlmMessage,
  LlmResponse,
  LlmToolCall,
} from '../types/agent-types.js';
import { UnconfiguredLlmClient } from '../agents/base-agent.js';

// ---------------------------------------------------------------------------
// Environment — read directly so this module can be used without the shared
// env singleton (which validates DATABASE_URL etc. that aren't needed here).
// ---------------------------------------------------------------------------

declare const process: { env: Record<string, string | undefined> };

// ---------------------------------------------------------------------------
// Provider constants
// ---------------------------------------------------------------------------

export const ANTHROPIC_PROVIDER = 'anthropic' as const;

/**
 * Default Claude model.
 * Operators can override by setting LLM_MODEL in the environment.
 */
export const DEFAULT_CLAUDE_MODEL = 'claude-3-5-sonnet-20241022' as const;

// ---------------------------------------------------------------------------
// Anthropic Claude client
// ---------------------------------------------------------------------------

/**
 * Wire shape of an Anthropic API message (subset we need).
 * Declared here to avoid importing @anthropic-ai/sdk as a hard dependency.
 * If the SDK is installed, cast to its types at the call site.
 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUse;

interface AnthropicApiResponse {
  content: AnthropicContentBlock[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Minimal Anthropic SDK interface — only the parts BaseAgent uses.
 * Avoids a hard dependency on @anthropic-ai/sdk; the real SDK satisfies this.
 */
interface AnthropicSdk {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: AnthropicMessage[];
      tools?: Array<{
        name: string;
        description: string;
        input_schema: Record<string, unknown>;
      }>;
      temperature?: number;
    }): Promise<AnthropicApiResponse>;
  };
}

// ---------------------------------------------------------------------------
// ClaudeLlmClient
// ---------------------------------------------------------------------------

/**
 * LlmClient implementation backed by Anthropic Claude.
 *
 * The constructor accepts a pre-built SDK instance so it can be tested with
 * a mock, and also to avoid loading the Anthropic SDK at module parse time
 * (dynamic import pattern).
 */
export class ClaudeLlmClient implements LlmClient {
  readonly isConfigured = true as const;
  readonly provider = ANTHROPIC_PROVIDER;
  readonly model: string;

  private readonly sdk: AnthropicSdk;
  private readonly defaultMaxTokens: number;

  constructor(sdk: AnthropicSdk, model: string, defaultMaxTokens = 4096) {
    this.sdk = sdk;
    this.model = model;
    this.defaultMaxTokens = defaultMaxTokens;
  }

  async complete(
    messages: ReadonlyArray<LlmMessage>,
    options?: LlmCompletionOptions,
  ): Promise<LlmResponse> {
    // Split off a leading system message if present
    let systemPrompt: string | undefined;
    const conversationMessages: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = systemPrompt !== undefined
          ? `${systemPrompt}\n\n${msg.content}`
          : msg.content;
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        conversationMessages.push({ role: msg.role, content: msg.content });
      }
      // 'tool' role messages are intentionally omitted here — a production
      // implementation would need to convert them to Anthropic tool_result blocks.
    }

    if (conversationMessages.length === 0) {
      throw new ValidationError({
        detail: 'At least one user or assistant message is required for LLM completion.',
      });
    }

    const tools = options?.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    const params: Parameters<AnthropicSdk['messages']['create']>[0] = {
      model: this.model,
      max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
      messages: conversationMessages,
      ...(systemPrompt !== undefined ? { system: systemPrompt } : {}),
      ...(tools !== undefined && tools.length > 0 ? { tools } : {}),
      ...(options?.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
    };

    let raw: AnthropicApiResponse;
    try {
      raw = await this.sdk.messages.create(params);
    } catch (err) {
      throw new ValidationError({
        detail: `Anthropic API call failed: ${String(err)}`,
        cause: err,
      });
    }

    // Parse content blocks into unified response shape
    let textContent: string | null = null;
    const toolCalls: LlmToolCall[] = [];

    for (const block of raw.content) {
      if (block.type === 'text') {
        textContent = textContent !== null
          ? `${textContent}\n${block.text}`
          : block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        });
      }
    }

    return {
      content: textContent,
      toolCalls,
      usage: {
        inputTokens: raw.usage.input_tokens,
        outputTokens: raw.usage.output_tokens,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Configuration options for createLlmClient.
 */
export interface LlmClientConfig {
  /**
   * Override the API key. If not provided, reads LLM_API_KEY from env.
   */
  readonly apiKey?: string | undefined;
  /**
   * Override the model. If not provided, reads LLM_MODEL from env or
   * falls back to DEFAULT_CLAUDE_MODEL.
   */
  readonly model?: string | undefined;
  /**
   * Default maximum tokens per completion.
   * @default 4096
   */
  readonly defaultMaxTokens?: number | undefined;
}

/**
 * Factory that creates the appropriate LlmClient based on environment config.
 *
 * Returns:
 * - `ClaudeLlmClient` when an API key is available and @anthropic-ai/sdk is
 *   loadable (dynamic import — no hard peer dependency).
 * - `UnconfiguredLlmClient` when the key is absent or the SDK is not installed,
 *   so agents degrade gracefully.
 *
 * @example
 * ```ts
 * const llm = await createLlmClient();
 * if (!llm.isConfigured) {
 *   console.warn('AI features disabled — set LLM_API_KEY to enable');
 * }
 * ```
 */
export async function createLlmClient(
  config: LlmClientConfig = {},
): Promise<LlmClient> {
  const apiKey = config.apiKey ?? process.env['LLM_API_KEY'];

  if (apiKey === undefined || apiKey.trim() === '') {
    return new UnconfiguredLlmClient();
  }

  const model =
    config.model ?? process.env['LLM_MODEL'] ?? DEFAULT_CLAUDE_MODEL;
  const defaultMaxTokens = config.defaultMaxTokens ?? 4096;

  // Dynamic import — @anthropic-ai/sdk is an optional peer dependency.
  // If it is not installed the factory falls back to UnconfiguredLlmClient.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anthropicModule = await import('@anthropic-ai/sdk' as any) as {
      default: new (options: { apiKey: string }) => AnthropicSdk;
    };
    const AnthropicConstructor = anthropicModule.default;
    const sdk = new AnthropicConstructor({ apiKey });
    return new ClaudeLlmClient(sdk, model, defaultMaxTokens);
  } catch {
    // SDK not installed — return unconfigured client so agents degrade gracefully
    return new UnconfiguredLlmClient();
  }
}

/**
 * Synchronous factory for use in tests or contexts where dynamic import
 * is not practical. Requires the caller to supply the SDK instance directly.
 *
 * @example
 * ```ts
 * import Anthropic from '@anthropic-ai/sdk';
 * const sdk = new Anthropic({ apiKey: 'sk-ant-...' });
 * const llm = createLlmClientSync(sdk);
 * ```
 */
export function createLlmClientSync(
  sdk: AnthropicSdk,
  config: LlmClientConfig = {},
): ClaudeLlmClient {
  const model =
    config.model ?? process.env['LLM_MODEL'] ?? DEFAULT_CLAUDE_MODEL;
  const defaultMaxTokens = config.defaultMaxTokens ?? 4096;
  return new ClaudeLlmClient(sdk, model, defaultMaxTokens);
}
