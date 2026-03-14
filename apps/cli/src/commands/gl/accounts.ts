/**
 * neip gl accounts — General Ledger chart-of-accounts commands.
 *
 * Commands:
 *   neip gl accounts list    — list all accounts in the chart of accounts
 *   neip gl accounts create  — create a new account interactively
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../../lib/api-client.js';
import { printError, printSuccess } from '../../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Account type classifications per standard CoA design. */
type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

/** Normal balance side (debit-normal vs credit-normal accounts). */
type NormalBalance = 'debit' | 'credit';

/** Payload sent to create an account. */
interface CreateAccountPayload {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  description: string;
  parentId?: string;
}

/** Response shape for a chart-of-accounts entry. */
interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  description: string;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Paginated list response wrapper. */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Options accepted by `gl accounts list`. */
interface AccountsListOptions {
  page: string;
  pageSize: string;
  type?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

const NORMAL_BALANCE_BY_TYPE: Record<AccountType, NormalBalance> = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
};

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

async function accountsList(options: AccountsListOptions): Promise<void> {
  const params: Record<string, string> = {
    page: options.page,
    pageSize: options.pageSize,
  };

  if (options.type !== undefined && options.type !== '') {
    params['type'] = options.type;
  }
  if (options.search !== undefined && options.search !== '') {
    params['search'] = options.search;
  }

  const result = await api.get<PaginatedResponse<Account>>(
    '/api/v1/gl/accounts',
    params,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data, total, page, pageSize } = result.data;

  printSuccess(
    data,
    `Showing ${String(data.length)} of ${String(total)} accounts (page ${String(page)}/${String(Math.ceil(total / pageSize))})`,
  );
}

async function accountsCreate(): Promise<void> {
  process.stdout.write('Creating a new account. Enter details below.\n');

  const code = await promptLine('Account code (e.g. 1001): ');
  const name = await promptLine('Account name: ');
  const typeInput = await promptLine(`Account type (${VALID_ACCOUNT_TYPES.join(' | ')}): `);
  const description = await promptLine('Description (optional): ');
  const parentId = await promptLine('Parent account ID (optional, leave blank to skip): ');

  if (code === '') {
    printError('Account code is required.');
    process.exit(1);
  }
  if (name === '') {
    printError('Account name is required.');
    process.exit(1);
  }
  if (!VALID_ACCOUNT_TYPES.includes(typeInput as AccountType)) {
    printError(`Invalid account type "${typeInput}". Must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`);
    process.exit(1);
  }

  const type = typeInput as AccountType;
  const normalBalance = NORMAL_BALANCE_BY_TYPE[type];

  const payload: CreateAccountPayload = {
    code,
    name,
    type,
    normalBalance,
    description,
  };

  if (parentId !== '') {
    payload.parentId = parentId;
  }

  const result = await api.post<{ data: Account }>(
    '/api/v1/gl/accounts',
    payload,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, `Account ${result.data.data.code} — ${result.data.data.name} created.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `gl accounts` sub-command group.
 */
export function buildAccountsCommand(): Command {
  const accounts = new Command('accounts').description('Chart of accounts operations');

  accounts
    .command('list')
    .description('List all accounts in the chart of accounts')
    .option('--page <number>', 'Page number (1-based)', '1')
    .option('--page-size <number>', 'Number of accounts per page', '50')
    .option('--type <type>', 'Filter by account type: asset, liability, equity, revenue, expense')
    .option('--search <term>', 'Search by account code or name')
    .action(async (options: AccountsListOptions) => {
      await accountsList(options);
    });

  accounts
    .command('create')
    .description('Create a new account in the chart of accounts interactively')
    .action(async () => {
      await accountsCreate();
    });

  return accounts;
}
