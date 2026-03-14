import type { AppError } from '../errors/app-error.js';

/**
 * ToolResult<T> — discriminated union return type for all tool/service calls.
 * Architecture reference: AR15 (Tool Registry pattern)
 *
 * Usage:
 *   function myTool(): ToolResult<string> {
 *     if (ok) return { success: true, data: 'value' };
 *     return { success: false, error: new ValidationError({ detail: '...' }) };
 *   }
 */
export type ToolResult<T> =
  | ToolSuccess<T>
  | ToolFailure;

export interface ToolSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly error?: never;
}

export interface ToolFailure {
  readonly success: false;
  readonly data?: never;
  readonly error: AppError;
}

/** Type guard: narrows ToolResult<T> to ToolSuccess<T> */
export function isToolSuccess<T>(result: ToolResult<T>): result is ToolSuccess<T> {
  return result.success === true;
}

/** Type guard: narrows ToolResult<T> to ToolFailure */
export function isToolFailure<T>(result: ToolResult<T>): result is ToolFailure {
  return result.success === false;
}

/** Convenience constructor for a successful result */
export function ok<T>(data: T): ToolSuccess<T> {
  return { success: true, data };
}

/** Convenience constructor for a failed result */
export function err(error: AppError): ToolFailure {
  return { success: false, error };
}
