#!/usr/bin/env node
/**
 * neip — nEIP CLI entry point.
 *
 * Command structure:
 *   neip auth login
 *   neip auth logout
 *   neip whoami
 *   neip config set <key> <value>
 *   neip config get <key>
 *   neip config list
 *   neip config unset <key>
 *   neip org create <name>
 *   neip org list
 *   neip org switch <id>
 *   neip gl journal create
 *   neip gl journal list
 *   neip gl journal post <id>
 *   neip gl accounts list
 *   neip gl accounts create
 *   neip ar invoice create
 *   neip ar invoice list
 *   neip ar invoice void <id>
 *   neip ar payment create
 *   neip ar payment list
 *
 * Global flags:
 *   --format <table|json>   Output format (default: table)
 *   --dry-run               Preview mutation without making any API call
 *   --explain               Print double-entry breakdown before executing
 *   --version               Print CLI version and exit
 *   --help                  Print help and exit
 */

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { buildAuthCommand, buildWhoamiCommand } from './commands/auth.js';
import { buildConfigCommand } from './commands/config.js';
import { buildArCommand } from './commands/ar/index.js';
import { buildGlCommand } from './commands/gl/index.js';
import { buildOrgCommand } from './commands/org.js';
import { ApiError } from './lib/api-client.js';
import { type OutputFormat, printError, setFormat } from './output/formatter.js';

// ---------------------------------------------------------------------------
// Version — resolved from package.json at runtime (CJS require shim for ESM)
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);

interface PackageJson {
  version: string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../package.json') as PackageJson;

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

/**
 * Top-level error handler — wraps every async command action.
 * Surfaces ApiError details, generic errors, and unexpected values cleanly.
 */
function handleError(err: unknown): never {
  if (err instanceof ApiError) {
    printError(err.detail, err.status);
  } else if (err instanceof Error) {
    printError(err.message);
  } else {
    printError('An unexpected error occurred.');
  }
  process.exit(1);
}

// Catch unhandled promise rejections from synchronous commander actions that
// accidentally return a rejected promise.
process.on('unhandledRejection', (reason) => {
  handleError(reason);
});

// ---------------------------------------------------------------------------
// Program setup
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('neip')
  .description('nEIP — next-generation EIP command-line interface')
  .version(pkg.version, '-v, --version', 'Print CLI version')
  .option(
    '--format <format>',
    'Output format: table (human-readable) or json (machine-readable)',
    'table',
  )
  // Story 6.3 — global mutation-control flags available to every command
  .option(
    '--dry-run',
    'Preview what a mutation command would do without making any API call',
    false,
  )
  .option(
    '--explain',
    'Print a double-entry debit/credit breakdown before executing a mutation',
    false,
  );

// Apply the global --format flag before any command action runs
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.optsWithGlobals() as { format?: string };
  const fmt = opts.format ?? 'table';
  const validFormats: OutputFormat[] = ['table', 'json'];
  if (!validFormats.includes(fmt as OutputFormat)) {
    printError(`Invalid format "${fmt}". Allowed values: table, json`);
    process.exit(1);
  }
  setFormat(fmt as OutputFormat);
});

// ---------------------------------------------------------------------------
// Register sub-commands
// ---------------------------------------------------------------------------

program.addCommand(buildAuthCommand());
program.addCommand(buildWhoamiCommand());
program.addCommand(buildConfigCommand());
program.addCommand(buildOrgCommand());
program.addCommand(buildGlCommand());
program.addCommand(buildArCommand());

// ---------------------------------------------------------------------------
// Parse and run
// ---------------------------------------------------------------------------

try {
  await program.parseAsync(process.argv);
} catch (err) {
  handleError(err);
}
