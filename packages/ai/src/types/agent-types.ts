/**
 * Agent type definitions for nEIP AI layer.
 *
 * Implements the 5-zone HITL (Human-in-the-Loop) confidence model:
 *   AUTO    ≥90%  — fully automated, no human review needed
 *   SUGGEST 75-89% — AI suggests, human confirms
 *   REVIEW  50-74% — human review required
 *   MANUAL  10-49% — AI uncertain, human takes over
 *   BLOCKED  <10%  — AI refuses to proceed
 *
 * Architecture references: AR11, FR17-FR23
 * Story: 5.2
 */

import type { AppError } from '@neip/shared';

// ---------------------------------------------------------------------------
// Confidence zones — HITL 5-zone model
// ---------------------------------------------------------------------------

/**
 * Numeric confidence score in the range [0, 1].
 * Branded to prevent accidental raw number assignment.
 */
export type ConfidenceScore = number & { readonly __brand: 'ConfidenceScore' };

/** Create a validated ConfidenceScore. Throws if value is outside [0, 1]. */
export function toConfidenceScore(value: number): ConfidenceScore {
  if (value < 0 || value > 1) {
    throw new RangeError(
      `ConfidenceScore must be between 0 and 1, received: ${value}`,
    );
  }
  return value as ConfidenceScore;
}

/**
 * 5-zone confidence classification.
 *
 * Boundary conditions (inclusive lower bound, exclusive upper bound):
 *   BLOCKED  [0.00, 0.10)
 *   MANUAL   [0.10, 0.50)
 *   REVIEW   [0.50, 0.75)
 *   SUGGEST  [0.75, 0.90)
 *   AUTO     [0.90, 1.00]
 */
export enum ConfidenceZone {
  /** ≥90%: Fully automated — no human intervention required */
  AUTO = 'AUTO',
  /** 75-89%: AI suggests — human confirms before committing */
  SUGGEST = 'SUGGEST',
  /** 50-74%: Human review required before any action */
  REVIEW = 'REVIEW',
  /** 10-49%: AI is uncertain — human should take over */
  MANUAL = 'MANUAL',
  /** <10%: AI refuses to proceed — escalate immediately */
  BLOCKED = 'BLOCKED',
}

/** Derive the confidence zone from a raw numeric score. */
export function classifyConfidence(score: ConfidenceScore): ConfidenceZone {
  if (score >= 0.9) return ConfidenceZone.AUTO;
  if (score >= 0.75) return ConfidenceZone.SUGGEST;
  if (score >= 0.5) return ConfidenceZone.REVIEW;
  if (score >= 0.1) return ConfidenceZone.MANUAL;
  return ConfidenceZone.BLOCKED;
}

// ---------------------------------------------------------------------------
// Agent result — structured output with confidence scoring
// ---------------------------------------------------------------------------

/**
 * Structured result returned by every agent execution.
 *
 * Discriminated on `success` — mirrors ToolResult from @neip/shared but
 * adds confidence scoring and reasoning transparency (FR18).
 */
export type AgentResult<T> = AgentSuccess<T> | AgentFailure;

export interface AgentSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly error?: never;
  /** Numeric confidence score in [0, 1] */
  readonly confidence: ConfidenceScore;
  /** Classified confidence zone derived from score */
  readonly zone: ConfidenceZone;
  /**
   * Step-by-step reasoning trace — required by FR18 (no black-box AI).
   * Each entry is a human-readable explanation of one reasoning step.
   */
  readonly reasoning: ReadonlyArray<string>;
  /** Wall-clock duration in milliseconds for this execution */
  readonly durationMs: number;
  /** ISO 8601 timestamp when this result was produced */
  readonly completedAt: string;
}

export interface AgentFailure {
  readonly success: false;
  readonly data?: never;
  readonly error: AppError;
  /** Confidence is always 0 for failures */
  readonly confidence: ConfidenceScore;
  /** Zone is always BLOCKED for failures */
  readonly zone: ConfidenceZone.BLOCKED;
  /** Reasoning trace up to the point of failure */
  readonly reasoning: ReadonlyArray<string>;
  readonly durationMs: number;
  readonly completedAt: string;
}

/** Type guard: narrows AgentResult<T> to AgentSuccess<T> */
export function isAgentSuccess<T>(result: AgentResult<T>): result is AgentSuccess<T> {
  return result.success === true;
}

/** Type guard: narrows AgentResult<T> to AgentFailure */
export function isAgentFailure<T>(result: AgentResult<T>): result is AgentFailure {
  return result.success === false;
}

// ---------------------------------------------------------------------------
// Tool registry integration
// ---------------------------------------------------------------------------

/**
 * Descriptor for a single tool available to agents.
 * Tools are registered via the Tool Registry (Story 2.2, AR15).
 */
export interface ToolDescriptor<TInput = unknown, TOutput = unknown> {
  /** Unique tool identifier within the registry */
  readonly name: string;
  /** Human-readable description for LLM tool selection */
  readonly description: string;
  /** JSON Schema for the input — used for validation and LLM prompting */
  readonly inputSchema: Record<string, unknown>;
  /**
   * Callable implementation. Returns a ToolResult-shaped response so that
   * agents can use the same ok/err helpers from @neip/shared.
   */
  readonly execute: (input: TInput) => Promise<TOutput>;
}

/**
 * Registry interface for discovering and invoking tools.
 * Agents receive this at construction time (dependency injection).
 */
export interface ToolRegistry {
  /** Return a tool by name, or undefined if not registered */
  getTool<TInput = unknown, TOutput = unknown>(
    name: string,
  ): ToolDescriptor<TInput, TOutput> | undefined;

  /** List all registered tool names */
  listTools(): ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

/**
 * Static configuration provided at agent construction time.
 * All agents share this structure; agent-specific options go in subclasses.
 */
export interface AgentConfig {
  /** Human-readable agent identifier (used in logs and traces) */
  readonly agentId: string;
  /**
   * Maximum number of LLM/tool-call iterations before the agent gives up.
   * Prevents infinite loops in agentic loops.
   * @default 10
   */
  readonly maxIterations: number;
  /**
   * Minimum confidence score for the agent to return AUTO zone.
   * Defaults to 0.9 per the HITL model.
   * @default 0.9
   */
  readonly autoThreshold: number;
  /**
   * Timeout in milliseconds for a single agent execution.
   * @default 30000
   */
  readonly timeoutMs: number;
  /** Optional tool registry — agents without tools still work. */
  readonly toolRegistry?: ToolRegistry | undefined;
}

// ---------------------------------------------------------------------------
// Agent execution context
// ---------------------------------------------------------------------------

/**
 * Runtime context injected into every agent execution.
 *
 * Carries tenant isolation, request tracing, and auth identity so that agents
 * can propagate these to downstream tool calls without re-passing them
 * through every method signature.
 */
export interface AgentContext {
  /** Tenant identifier for multi-tenancy data isolation */
  readonly tenantId: string;
  /** The user triggering this agent execution */
  readonly userId: string;
  /** Correlation ID for distributed tracing (ties back to HTTP request) */
  readonly correlationId: string;
  /** Optional parent span ID for nested tracing */
  readonly parentSpanId?: string | undefined;
  /**
   * Arbitrary metadata bag for passing domain-specific context.
   * Keys are camelCase strings; values are JSON-serialisable primitives.
   */
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

// ---------------------------------------------------------------------------
// Agent step — internal reasoning unit (FR18: show reasoning)
// ---------------------------------------------------------------------------

/** The type of action taken in a single agent step */
export type AgentStepKind =
  | 'llm-call'
  | 'tool-call'
  | 'tool-result'
  | 'reasoning'
  | 'final-answer';

/**
 * A single step in an agent's execution trace.
 * Collected into AgentSuccess.reasoning for transparency.
 */
export interface AgentStep {
  readonly kind: AgentStepKind;
  readonly iteration: number;
  readonly description: string;
  /** Serialisable snapshot of relevant state at this step */
  readonly snapshot?: Readonly<Record<string, unknown>> | undefined;
  readonly timestampMs: number;
}

// ---------------------------------------------------------------------------
// LLM message types (pluggable interface — no LangChain dependency)
// ---------------------------------------------------------------------------

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmMessage {
  readonly role: MessageRole;
  readonly content: string;
  /** Tool call ID — present on tool-result messages */
  readonly toolCallId?: string | undefined;
}

export interface LlmToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface LlmResponse {
  /** Text content of the response, if any */
  readonly content: string | null;
  /** Tool calls requested by the LLM, if any */
  readonly toolCalls: ReadonlyArray<LlmToolCall>;
  /** Raw token counts for cost tracking */
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Pluggable LLM interface
// ---------------------------------------------------------------------------

/**
 * Minimal interface that any LLM backend must satisfy.
 * Keeps the agent layer decoupled from specific providers (Claude, GPT, etc.)
 * and from LangChain abstractions — so agents compile and run without any
 * LLM installed, and LangChain can be wired in later as an adapter.
 */
export interface LlmClient {
  /**
   * Send a sequence of messages and receive a structured response.
   * Implementations must handle retries, rate limits, and timeouts internally.
   */
  complete(
    messages: ReadonlyArray<LlmMessage>,
    options?: LlmCompletionOptions,
  ): Promise<LlmResponse>;

  /** True if the client is configured and ready (e.g. API key present) */
  readonly isConfigured: boolean;

  /** Provider identifier for logging and diagnostics */
  readonly provider: string;

  /** Model identifier being used */
  readonly model: string;
}

export interface LlmCompletionOptions {
  /** Maximum output tokens */
  readonly maxTokens?: number | undefined;
  /** Temperature in [0, 1] — lower = more deterministic */
  readonly temperature?: number | undefined;
  /** Tool descriptors to expose to this completion */
  readonly tools?: ReadonlyArray<ToolDescriptor> | undefined;
}
