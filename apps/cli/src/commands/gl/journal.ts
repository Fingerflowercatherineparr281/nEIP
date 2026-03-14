/**
 * neip gl journal — General Ledger journal entry commands.
 *
 * Commands:
 *   neip gl journal create              — create a new journal entry interactively
 *   neip gl journal list                — list journal entries (paginated)
 *   neip gl journal post <id>           — post a draft journal entry
 *
 * Story 6.3 flags (inherited from root program via optsWithGlobals):
 *   --dry-run   Show what would be sent without making any API call.
 *   --explain   Print a double-entry debit/credit breakdown before executing.
 */

import { createInterface } from 'node:readline';
import { type Command, createCommand } from 'commander';
import { api } from '../../lib/api-client.js';
import { type MutationFlags, printDoubleEntryBreakdown } from '../../lib/mutation-flags.js';
import { printError, printSuccess } from '../../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single line item within a journal entry. */
interface JournalLine {
  accountId: string;
  description: string;
  debit: number;
  credit: number;
}

/** Payload sent to create a journal entry. */
interface CreateJournalEntryPayload {
  date: string;
  reference: string;
  description: string;
  lines: JournalLine[];
}

/** Response shape for a journal entry resource. */
interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  status: 'draft' | 'posted' | 'voided';
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
}

/** Paginated list response wrapper. */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Options accepted by `gl journal list`. */
interface JournalListOptions {
  page: string;
  pageSize: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a single line from stdin with a prompt. */
function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function journalCreate(flags: MutationFlags): Promise<void> {
  process.stdout.write('Creating a new journal entry. Enter details below.\n');

  const date = await promptLine('Date (YYYY-MM-DD) [today]: ');
  const reference = await promptLine('Reference (e.g. JE-001): ');
  const description = await promptLine('Description: ');

  if (reference === '') {
    printError('Reference is required.');
    process.exit(1);
  }
  if (description === '') {
    printError('Description is required.');
    process.exit(1);
  }

  const resolvedDate =
    date === ''
      ? new Date().toISOString().slice(0, 10)
      : date;

  // Collect at least one line
  const lines: JournalLine[] = [];
  process.stdout.write('\nEnter line items (leave Account ID blank to finish):\n');

  for (;;) {
    const accountId = await promptLine(`  Line ${String(lines.length + 1)} — Account ID: `);
    if (accountId === '') break;

    const lineDescription = await promptLine('  Description: ');
    const debitStr = await promptLine('  Debit amount (0 if none): ');
    const creditStr = await promptLine('  Credit amount (0 if none): ');

    const debit = Number(debitStr === '' ? '0' : debitStr);
    const credit = Number(creditStr === '' ? '0' : creditStr);

    if (Number.isNaN(debit) || Number.isNaN(credit)) {
      printError('Debit and credit must be numeric values.');
      process.exit(1);
    }

    lines.push({ accountId, description: lineDescription, debit, credit });
  }

  if (lines.length === 0) {
    printError('At least one line item is required.');
    process.exit(1);
  }

  const payload: CreateJournalEntryPayload = {
    date: resolvedDate,
    reference,
    description,
    lines,
  };

  // --explain: print double-entry breakdown before any API call
  if (flags.explain) {
    printDoubleEntryBreakdown(description, resolvedDate, reference, lines);
  }

  // --dry-run: skip the API call and print the sentinel
  if (flags.dryRun) {
    process.stdout.write('DRY RUN — no changes made\n');
    printSuccess(payload, 'Preview of journal entry that would be created:');
    return;
  }

  const result = await api.post<{ data: JournalEntry }>(
    '/api/v1/gl/journal-entries',
    payload,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Journal entry ${result.data.data.id} created.`);
}

async function journalList(options: JournalListOptions): Promise<void> {
  const params: Record<string, string> = {
    page: options.page,
    pageSize: options.pageSize,
  };

  if (options.status !== undefined && options.status !== '') {
    params['status'] = options.status;
  }

  const result = await api.get<PaginatedResponse<JournalEntry>>(
    '/api/v1/gl/journal-entries',
    params,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data, total, page, pageSize } = result.data;

  printSuccess(data, `Showing ${String(data.length)} of ${String(total)} entries (page ${String(page)}/${String(Math.ceil(total / pageSize))})`);
}

async function journalPost(id: string): Promise<void> {
  if (id === '') {
    printError('Journal entry ID is required.');
    process.exit(1);
  }

  const result = await api.post<{ data: JournalEntry }>(
    `/api/v1/gl/journal-entries/${id}/post`,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Journal entry ${id} posted successfully.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `gl journal` sub-command group.
 */
export function buildJournalCommand(): Command {
  const journal = createCommand('journal').description('General Ledger journal entry operations');

  journal
    .command('create')
    .description('Create a new journal entry interactively')
    .action(async function (this: Command) {
      // Read --dry-run / --explain from the global option chain
      const globals = this.optsWithGlobals<MutationFlags>();
      await journalCreate({
        dryRun: globals.dryRun === true,
        explain: globals.explain === true,
      });
    });

  journal
    .command('list')
    .description('List journal entries with optional pagination and status filter')
    .option('--page <number>', 'Page number (1-based)', '1')
    .option('--page-size <number>', 'Number of entries per page', '20')
    .option('--status <status>', 'Filter by status: draft, posted, voided')
    .action(async (options: JournalListOptions) => {
      await journalList(options);
    });

  journal
    .command('post <id>')
    .description('Post a draft journal entry, making it permanent')
    .action(async (id: string) => {
      await journalPost(id);
    });

  return journal;
}
