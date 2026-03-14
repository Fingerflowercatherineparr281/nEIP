/**
 * Minimal structured logger for the worker process.
 *
 * Uses console.* so there are zero extra dependencies.  This will be replaced
 * by Pino in a later story (NFR-O1 — JSON structured logging).
 *
 * The interface intentionally mirrors the Pino API so the swap-out is a
 * single-file change.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogEntry = Record<string, unknown> & { msg: string };

function write(level: LogLevel, entry: LogEntry): void {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    service: 'worker',
    ...entry,
  });

  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const log = {
  debug: (entry: LogEntry) => write('debug', entry),
  info: (entry: LogEntry) => write('info', entry),
  warn: (entry: LogEntry) => write('warn', entry),
  error: (entry: LogEntry) => write('error', entry),
} as const;
