/**
 * Output formatter — provides consistent JSON and human-readable table output
 * across all CLI commands.
 *
 * Commands retrieve the active format from the program's global option via
 * `getFormat()`.  The format is set once in index.ts on the root command and
 * accessed here without requiring every command to pass it explicitly.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported output formats. */
export type OutputFormat = 'table' | 'json';

/** Structured success envelope passed to the formatter. */
export interface FormattedSuccess<T> {
  ok: true;
  data: T;
  message?: string;
}

/** Structured error envelope passed to the formatter. */
export interface FormattedError {
  ok: false;
  error: string;
  code?: string | number;
}

export type Formatted<T> = FormattedSuccess<T> | FormattedError;

// ---------------------------------------------------------------------------
// Global format state
// ---------------------------------------------------------------------------

let _activeFormat: OutputFormat = 'table';

/** Set the active output format (called once from index.ts). */
export function setFormat(format: OutputFormat): void {
  _activeFormat = format;
}

/** Get the currently active output format. */
export function getFormat(): OutputFormat {
  return _activeFormat;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Print a success result to stdout.
 *
 * - json  → `{ "ok": true, "data": ... }`
 * - table → human-readable key/value list or custom message
 */
export function printSuccess<T>(data: T, message?: string): void {
  if (_activeFormat === 'json') {
    const envelope: FormattedSuccess<T> = { ok: true, data };
    if (message !== undefined) envelope.message = message;
    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
    return;
  }

  // Human-readable
  if (message !== undefined) {
    process.stdout.write(`${message}\n`);
  }

  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    printKeyValue(data as Record<string, unknown>);
  } else if (Array.isArray(data)) {
    printTable(data as Record<string, unknown>[]);
  }
}

/**
 * Print an error to stderr.
 *
 * - json  → `{ "ok": false, "error": "...", "code": ... }`
 * - table → "Error: ..." prefixed line
 */
export function printError(message: string, code?: string | number): void {
  if (_activeFormat === 'json') {
    const envelope: FormattedError = { ok: false, error: message };
    if (code !== undefined) envelope.code = code;
    process.stderr.write(JSON.stringify(envelope, null, 2) + '\n');
    return;
  }

  const codeFragment = code !== undefined ? ` (${String(code)})` : '';
  process.stderr.write(`Error${codeFragment}: ${message}\n`);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function printKeyValue(obj: Record<string, unknown>, indent = ''): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      process.stdout.write(`${indent}${key}:\n`);
      printKeyValue(value as Record<string, unknown>, `${indent}  `);
    } else {
      process.stdout.write(`${indent}${key}: ${String(value ?? '')}\n`);
    }
  }
}

function printTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    process.stdout.write('(no results)\n');
    return;
  }

  // Collect columns from the first row
  const firstRow = rows[0];
  if (firstRow === undefined) return;
  const columns = Object.keys(firstRow);

  // Compute column widths
  const widths: Record<string, number> = {};
  for (const col of columns) {
    widths[col] = col.length;
  }
  for (const row of rows) {
    for (const col of columns) {
      const cellLen = String(row[col] ?? '').length;
      const currentWidth = widths[col] ?? col.length;
      if (cellLen > currentWidth) widths[col] = cellLen;
    }
  }

  const separator = columns.map((c) => '-'.repeat(widths[c] ?? c.length)).join('  ');
  const header = columns.map((c) => c.padEnd(widths[c] ?? c.length)).join('  ');

  process.stdout.write(`${header}\n${separator}\n`);

  for (const row of rows) {
    const line = columns
      .map((c) => String(row[c] ?? '').padEnd(widths[c] ?? c.length))
      .join('  ');
    process.stdout.write(`${line}\n`);
  }
}
