/**
 * BaseAgent — abstract foundation for all nEIP AI agents.
 *
 * Provides:
 *   - Structured execution lifecycle (plan → execute → score → return)
 *   - HITL confidence zone classification
 *   - Reasoning trace collection (FR18: no black-box AI)
 *   - Tool Registry integration (AR15)
 *   - Timeout and iteration guard-rails
 *   - AgentContext propagation from @neip/shared execution context
 *
 * Architecture references: AR11, AR15, FR17-FR23
 * Story: 5.2
 *
 * Usage:
 *   class InvoiceMatchAgent extends BaseAgent<MatchInput, MatchOutput> {
 *     protected async executeCore(input, context, trace) { ... }
 *   }
 */

// ---------------------------------------------------------------------------
// Ambient timer globals — Node.js provides these but the tsconfig targets
// ES2022 lib which omits DOM/Node typings. Declare the subset we use.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function setTimeout(callback: () => void, ms: number): any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function clearTimeout(id: any): void;

import type { ToolResult } from '@neip/shared';
import { AppError, ValidationError } from '@neip/shared';

import {
  classifyConfidence,
  isAgentSuccess,
  toConfidenceScore,
  ConfidenceZone,
} from '../types/agent-types.js';
import type {
  AgentConfig,
  AgentContext,
  AgentResult,
  AgentFailure,
  AgentSuccess,
  AgentStep,
  ConfidenceScore,
  ToolDescriptor,
} from '../types/agent-types.js';

// ---------------------------------------------------------------------------
// Internal trace builder
// ---------------------------------------------------------------------------

/**
 * Mutable trace accumulator passed to executeCore.
 * Agents append steps to build the reasoning trail returned in AgentResult.
 */
export class AgentTrace {
  private readonly _steps: AgentStep[] = [];
  private _iteration = 0;

  get steps(): ReadonlyArray<AgentStep> {
    return this._steps;
  }

  get iteration(): number {
    return this._iteration;
  }

  incrementIteration(): void {
    this._iteration += 1;
  }

  addStep(
    kind: AgentStep['kind'],
    description: string,
    snapshot?: Readonly<Record<string, unknown>>,
  ): void {
    const step: AgentStep = {
      kind,
      iteration: this._iteration,
      description,
      timestampMs: Date.now(),
      ...(snapshot !== undefined ? { snapshot } : {}),
    };
    this._steps.push(step);
  }

  toReasoningStrings(): ReadonlyArray<string> {
    return this._steps.map(
      (s) => `[${s.kind}@iter${s.iteration}] ${s.description}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Default config values
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_AUTO_THRESHOLD = 0.9;
const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// BaseAgent
// ---------------------------------------------------------------------------

/**
 * Abstract base class for all nEIP agents.
 *
 * @typeParam TInput  — Domain-specific input type for this agent
 * @typeParam TOutput — Domain-specific output type returned on success
 */
export abstract class BaseAgent<TInput, TOutput> {
  protected readonly config: Readonly<AgentConfig>;

  constructor(config: Partial<AgentConfig> & { agentId: string }) {
    this.config = {
      agentId: config.agentId,
      maxIterations: config.maxIterations ?? DEFAULT_MAX_ITERATIONS,
      autoThreshold: config.autoThreshold ?? DEFAULT_AUTO_THRESHOLD,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      ...(config.toolRegistry !== undefined
        ? { toolRegistry: config.toolRegistry }
        : {}),
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Execute the agent with the given input and context.
   *
   * Handles timeout, max-iteration guard, trace collection, and result wrapping.
   * Subclasses implement only the domain logic via `executeCore`.
   */
  async execute(
    input: TInput,
    context: AgentContext,
  ): Promise<AgentResult<TOutput>> {
    const startMs = Date.now();
    const trace = new AgentTrace();

    trace.addStep('reasoning', `Starting agent "${this.config.agentId}"`, {
      agentId: this.config.agentId,
      correlationId: context.correlationId,
      tenantId: context.tenantId,
    });

    try {
      const result = await this.withTimeout(
        this.runWithIterationGuard(input, context, trace),
        this.config.timeoutMs,
        trace,
      );
      return this.wrapResult(result, trace, startMs);
    } catch (err) {
      return this.buildFailure(err, trace, startMs);
    }
  }

  // ---------------------------------------------------------------------------
  // Abstract hook — subclasses implement this
  // ---------------------------------------------------------------------------

  /**
   * Domain-specific execution logic.
   *
   * Subclasses must:
   * 1. Use `trace.addStep(...)` to document reasoning (FR18)
   * 2. Call `trace.incrementIteration()` on each LLM/tool round-trip
   * 3. Check `trace.iteration < config.maxIterations` before looping
   * 4. Return a raw `AgentResult<TOutput>` — the base class wraps timing
   *
   * @param input   Validated domain input
   * @param context Runtime execution context (tenantId, userId, correlationId)
   * @param trace   Mutable trace accumulator — append reasoning steps here
   */
  protected abstract executeCore(
    input: TInput,
    context: AgentContext,
    trace: AgentTrace,
  ): Promise<AgentResult<TOutput>>;

  // ---------------------------------------------------------------------------
  // Protected helpers — available to subclasses
  // ---------------------------------------------------------------------------

  /**
   * Invoke a tool from the registry by name.
   * Appends tool-call and tool-result steps to the trace automatically.
   */
  protected async callTool<TToolInput, TToolOutput>(
    name: string,
    toolInput: TToolInput,
    trace: AgentTrace,
  ): Promise<ToolResult<TToolOutput>> {
    const registry = this.config.toolRegistry;
    if (registry === undefined) {
      const error = new ValidationError({
        detail: `Agent "${this.config.agentId}" attempted to call tool "${name}" but no ToolRegistry is configured.`,
      });
      trace.addStep('tool-call', `Tool "${name}" call failed — no registry`, {
        toolName: name,
        error: error.detail,
      });
      return { success: false, error };
    }

    const tool = registry.getTool<TToolInput, TToolOutput>(name);
    if (tool === undefined) {
      const error = new ValidationError({
        detail: `Tool "${name}" not found in registry. Available: ${registry.listTools().join(', ')}`,
      });
      trace.addStep('tool-call', `Tool "${name}" not found in registry`);
      return { success: false, error };
    }

    trace.addStep('tool-call', `Calling tool "${name}"`, {
      toolName: name,
    });

    try {
      const output = await tool.execute(toolInput);
      trace.addStep('tool-result', `Tool "${name}" succeeded`);
      return { success: true, data: output };
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new ValidationError({
              detail: `Tool "${name}" threw an unexpected error: ${String(err)}`,
              cause: err,
            });
      trace.addStep('tool-result', `Tool "${name}" failed: ${appError.detail}`);
      return { success: false, error: appError };
    }
  }

  /**
   * List all tools available in the configured registry.
   * Returns an empty array if no registry is attached.
   */
  protected listAvailableTools(): ReadonlyArray<string> {
    return this.config.toolRegistry?.listTools() ?? [];
  }

  /**
   * Retrieve a tool descriptor without calling it (e.g. to build LLM prompts).
   */
  protected getTool<TToolInput = unknown, TToolOutput = unknown>(
    name: string,
  ): ToolDescriptor<TToolInput, TToolOutput> | undefined {
    return this.config.toolRegistry?.getTool<TToolInput, TToolOutput>(name);
  }

  /**
   * Build a successful AgentResult with explicit confidence.
   * Derives zone automatically from score.
   */
  protected buildSuccess(
    data: TOutput,
    confidence: number,
    trace: AgentTrace,
    startMs: number,
  ): AgentSuccess<TOutput> {
    const score = toConfidenceScore(confidence);
    return {
      success: true,
      data,
      confidence: score,
      zone: classifyConfidence(score),
      reasoning: trace.toReasoningStrings(),
      durationMs: Date.now() - startMs,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Build a failed AgentResult from an AppError (or any thrown value).
   */
  protected buildFailure(
    err: unknown,
    trace: AgentTrace,
    startMs: number,
  ): AgentFailure {
    const appError =
      err instanceof AppError
        ? err
        : new ValidationError({
            detail: `Unexpected error in agent "${this.config.agentId}": ${String(err)}`,
            cause: err,
          });

    const blockedScore = toConfidenceScore(0);
    return {
      success: false,
      error: appError,
      confidence: blockedScore,
      zone: ConfidenceZone.BLOCKED,
      reasoning: trace.toReasoningStrings(),
      durationMs: Date.now() - startMs,
      completedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async runWithIterationGuard(
    input: TInput,
    context: AgentContext,
    trace: AgentTrace,
  ): Promise<AgentResult<TOutput>> {
    const result = await this.executeCore(input, context, trace);

    if (isAgentSuccess(result) && trace.iteration >= this.config.maxIterations) {
      trace.addStep(
        'reasoning',
        `Max iterations (${this.config.maxIterations}) reached — downgrading confidence`,
      );
      // Downgrade confidence to MANUAL zone if iteration limit was hit
      const cappedScore = toConfidenceScore(
        Math.min((result.confidence as number), 0.49),
      );
      return {
        ...result,
        confidence: cappedScore as ConfidenceScore,
        zone: classifyConfidence(cappedScore),
      };
    }

    return result;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    trace: AgentTrace,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        trace.addStep(
          'reasoning',
          `Agent timed out after ${timeoutMs}ms`,
        );
        reject(
          new ValidationError({
            detail: `Agent "${this.config.agentId}" exceeded timeout of ${timeoutMs}ms.`,
          }),
        );
      }, timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  /**
   * Ensure the final result's reasoning and timing fields reflect the
   * outer execution wrapper (not just what executeCore reported).
   */
  private wrapResult(
    result: AgentResult<TOutput>,
    trace: AgentTrace,
    startMs: number,
  ): AgentResult<TOutput> {
    const reasoning = trace.toReasoningStrings();
    const durationMs = Date.now() - startMs;
    const completedAt = new Date().toISOString();

    if (isAgentSuccess(result)) {
      return { ...result, reasoning, durationMs, completedAt };
    }
    return { ...result, reasoning, durationMs, completedAt };
  }
}

// ---------------------------------------------------------------------------
// No-op LLM stub — used when no API key is configured
// ---------------------------------------------------------------------------

/**
 * Stub LlmClient that signals it is not configured.
 * Agents should check `llmClient.isConfigured` before calling `complete`.
 * When unconfigured, the agent must either fall back to rule-based logic
 * or return BLOCKED.
 */
export class UnconfiguredLlmClient {
  readonly isConfigured = false as const;
  readonly provider = 'none';
  readonly model = 'none';

  async complete(): Promise<never> {
    throw new ValidationError({
      detail:
        'No LLM client is configured. Set LLM_API_KEY in the environment to enable AI features.',
    });
  }
}
