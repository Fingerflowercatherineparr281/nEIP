/**
 * ToolRegistry — central registry for all business operations.
 * Architecture reference: AR15 (Tool Registry pattern), Story 2.2.
 *
 * Usage:
 *   const registry = new ToolRegistry();
 *   registry.register(myToolDefinition);
 *   const result = await registry.execute('gl.createJournalEntry', rawParams, ctx);
 */

import { z } from 'zod';
import { AppError, ValidationError, err, ok } from '@neip/shared';
import type { ToolResult } from '@neip/shared';
import type { ExecutionContext, ToolDefinition } from './types.js';

// ---------------------------------------------------------------------------
// Internal map type (erases generics to allow heterogeneous storage)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

// ---------------------------------------------------------------------------
// ToolRegistry
// ---------------------------------------------------------------------------

/**
 * Mutable registry that stores and executes named tool definitions.
 *
 * All business operations MUST go through the registry (AR15).
 * Tools are keyed by their `name` property (e.g. `gl.createJournalEntry`).
 */
export class ToolRegistry {
  private readonly _tools = new Map<string, AnyToolDefinition>();

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  /**
   * Register a tool definition.
   *
   * @throws {Error} if a tool with the same name has already been registered.
   */
  register<TInput, TOutput>(toolDef: ToolDefinition<TInput, TOutput>): void {
    if (this._tools.has(toolDef.name)) {
      throw new Error(`ToolRegistry: tool "${toolDef.name}" is already registered.`);
    }
    this._tools.set(toolDef.name, toolDef);
  }

  // -------------------------------------------------------------------------
  // execute
  // -------------------------------------------------------------------------

  /**
   * Validate `params` against the tool's Zod schema and, on success, invoke
   * the handler with the parsed input and execution context.
   *
   * Error handling:
   * - Unknown tool name → `ToolResult` with `AppError` (status 404)
   * - Zod validation failure → `ToolResult` with `ValidationError` (status 400)
   * - Handler throws an `AppError` → returned as `ToolResult` failure
   * - Handler throws anything else → wrapped in `AppError` (status 500)
   *
   * @typeParam T - Expected success data type (caller asserts via generic).
   */
  async execute<T>(
    name: string,
    params: unknown,
    ctx: ExecutionContext,
  ): Promise<ToolResult<T>> {
    // 1. Look up the tool -------------------------------------------------------
    const tool = this._tools.get(name);
    if (tool === undefined) {
      return err(
        new AppError({
          type: 'https://problems.neip.app/tool-not-found',
          title: 'Tool Not Found',
          status: 404,
          detail: `No tool registered under the name "${name}".`,
        }),
      );
    }

    // 2. Validate input with Zod ------------------------------------------------
    const parseResult = tool.inputSchema.safeParse(params);
    if (!parseResult.success) {
      const zodError = parseResult.error;

      // Map Zod issues to structured field errors.
      const fieldErrors = zodError.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      }));

      return err(
        new ValidationError({
          detail: `Validation failed for tool "${name}": ${zodError.issues.map((i) => i.message).join('; ')}`,
          errors: fieldErrors,
        }),
      );
    }

    // 3. Invoke the handler -----------------------------------------------------
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await tool.handler(parseResult.data, ctx) as ToolResult<T>;
      return result;
    } catch (thrown: unknown) {
      if (thrown instanceof AppError) {
        return err(thrown);
      }

      const message =
        thrown instanceof Error ? thrown.message : String(thrown);

      return err(
        new AppError({
          type: 'https://problems.neip.app/internal-error',
          title: 'Internal Server Error',
          status: 500,
          detail: `Tool "${name}" handler threw an unexpected error: ${message}`,
          cause: thrown,
        }),
      );
    }
  }

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  /**
   * Return all registered tool definitions.
   *
   * The returned array contains the original definition objects; callers
   * should treat them as read-only.
   */
  list(): ReadonlyArray<AnyToolDefinition> {
    return Array.from(this._tools.values());
  }
}

// Re-export helpers so callers don't need a separate import from @neip/shared.
export { ok, err, z };
