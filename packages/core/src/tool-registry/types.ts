/**
 * Tool Registry types — Story 2.2.
 * Architecture reference: AR15 (Tool Registry pattern)
 */

import type { z } from 'zod';
import type { ToolResult } from '@neip/shared';

// ---------------------------------------------------------------------------
// Execution context
// ---------------------------------------------------------------------------

/**
 * Context that every tool execution receives.
 * Carries identity and tracing information for the current request.
 */
export interface ExecutionContext {
  /** Tenant identifier — the company/organisation running the request. */
  readonly tenantId: string;
  /** User identifier — who initiated the request. */
  readonly userId: string;
  /** Globally unique identifier for this request (for distributed tracing). */
  readonly requestId: string;
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

/**
 * ToolDefinition<TInput, TOutput> — the complete description of a registerable
 * business operation.
 *
 * Naming convention: `domain.operation`  (e.g. `gl.createJournalEntry`)
 *
 * @typeParam TInput  - The Zod-inferred input type for this tool.
 * @typeParam TOutput - The resolved data type returned on success.
 */
export interface ToolDefinition<TInput, TOutput> {
  /**
   * Fully-qualified tool name using dot-separated domain namespace.
   * Examples: `gl.createJournalEntry`, `ar.createInvoice`
   */
  readonly name: string;

  /** Human-readable description of what the tool does. */
  readonly description: string;

  /**
   * Zod schema used to validate and parse input before the handler runs.
   * The inferred type of this schema must match TInput.
   */
  readonly inputSchema: z.ZodType<TInput>;

  /**
   * Business-logic handler.
   *
   * Called only after `inputSchema` validation succeeds.
   * Must return a `ToolResult<TOutput>` — either `ok(data)` or `err(error)`.
   */
  readonly handler: (params: TInput, ctx: ExecutionContext) => Promise<ToolResult<TOutput>>;
}
