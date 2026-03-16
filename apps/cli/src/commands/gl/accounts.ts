/**
 * neip gl accounts — General Ledger chart-of-accounts commands.
 *
 * Commands:
 *   neip gl accounts list    — list all accounts in the chart of accounts
 *   neip gl accounts create  — create a new account interactively
 *
 * API notes:
 *   - GET  /api/v1/accounts  returns { items, total, limit, offset, hasMore }
 *   - Account fields: id, code, nameTh, nameEn, accountType, isActive, parentId,
 *     createdAt, updatedAt
 *   - POST /api/v1/accounts  creates an account
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
  nameEn: string;
  nameTh: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  description?: string;
  parentId?: string;
}

/** Response shape for a chart-of-accounts entry from the API. */
interface Account {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  accountType: AccountType;
  isActive: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Paginated list response returned by the API. */
interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Options accepted by `gl accounts list`. */
interface AccountsListOptions {
  limit: string;
  offset: string;
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
  // Only pass params that the user explicitly provided to avoid Fastify
  // integer-type coercion issues with URL query strings.
  const params: Record<string, string> = {};

  // Pass numeric params only when explicitly overriding defaults
  if (options.limit !== '100') params['limit'] = options.limit;
  if (options.offset !== '0') params['offset'] = options.offset;

  if (options.type !== undefined && options.type !== '') {
    params['accountType'] = options.type;
  }
  if (options.search !== undefined && options.search !== '') {
    params['search'] = options.search;
  }

  const result = await api.get<ListResponse<Account>>(
    '/api/v1/accounts',
    Object.keys(params).length > 0 ? params : undefined,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { items, total, limit, offset } = result.data;

  // Map to a flat display shape for the table formatter
  const display = items.map((a) => ({
    id: a.id,
    code: a.code,
    nameEn: a.nameEn,
    nameTh: a.nameTh,
    accountType: a.accountType,
    isActive: String(a.isActive),
    parentId: a.parentId ?? '',
    createdAt: a.createdAt,
  }));

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  printSuccess(
    display,
    `Showing ${String(items.length)} of ${String(total)} accounts (page ${String(page)}/${String(totalPages)})`,
  );
}

async function accountsCreate(): Promise<void> {
  process.stdout.write('Creating a new account. Enter details below.\n');

  const code = await promptLine('Account code (e.g. 1001): ');
  const nameEn = await promptLine('Account name (English): ');
  const nameTh = await promptLine('Account name (Thai, optional): ');
  const typeInput = await promptLine(`Account type (${VALID_ACCOUNT_TYPES.join(' | ')}): `);
  const parentId = await promptLine('Parent account ID (optional, leave blank to skip): ');

  if (code === '') {
    printError('Account code is required.');
    process.exit(1);
  }
  if (nameEn === '') {
    printError('Account name (English) is required.');
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
    nameEn,
    nameTh: nameTh === '' ? nameEn : nameTh,
    accountType: type,
    normalBalance,
  };

  if (parentId !== '') {
    payload.parentId = parentId;
  }

  const result = await api.post<Account>(
    '/api/v1/accounts',
    payload,
  );

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const account = result.data;
  printSuccess(account, `Account ${account.code} — ${account.nameEn} created.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `gl accounts` sub-command group.
 */
export function buildAccountsCommand(): Command {
  const accounts = new Command('accounts')
    .description('จัดการผังบัญชี (Chart of Accounts) — Chart of accounts operations')
    .addHelpText('after', `
Examples:
  $ neip gl accounts list                        # แสดงผังบัญชีทั้งหมด
  $ neip gl accounts list --type asset           # เฉพาะบัญชีสินทรัพย์
  $ neip gl accounts list --search "cash"        # ค้นหาบัญชี
  $ neip gl accounts create                      # สร้างบัญชีใหม่ (interactive)

Account types: asset, liability, equity, revenue, expense
  `);

  accounts
    .command('list')
    .description('แสดงบัญชีทั้งหมดในผังบัญชี — List all accounts in the chart of accounts')
    .option('--limit <number>', 'จำนวนสูงสุด — Maximum number of accounts to return', '100')
    .option('--offset <number>', 'ข้าม N รายการแรก — Number of accounts to skip', '0')
    .option('--type <type>', 'ประเภทบัญชี: asset, liability, equity, revenue, expense — Filter by account type')
    .option('--search <term>', 'ค้นหาด้วยรหัสหรือชื่อบัญชี — Search by account code or name')
    .action(async (options: AccountsListOptions) => {
      await accountsList(options);
    });

  accounts
    .command('create')
    .description('สร้างบัญชีใหม่ในผังบัญชี (interactive) — Create a new account in the chart of accounts interactively')
    .action(async () => {
      await accountsCreate();
    });

  return accounts;
}
