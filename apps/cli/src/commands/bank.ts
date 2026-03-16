/**
 * neip bank — Bank Reconciliation commands (FI-BL).
 *
 * Commands:
 *   neip bank list              — list bank accounts
 *   neip bank create            — create a bank account interactively
 *   neip bank transactions <id> — show recent transactions for an account
 *   neip bank reconcile <txnId> — reconcile a bank transaction to a JE
 *   neip bank report <id>       — reconciliation report (unmatched items)
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); resolve(a.trim()); });
  });
}

interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  balanceSatang: string;
}

interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  debitSatang: string;
  creditSatang: string;
  reconciled: boolean;
  reference: string | null;
}

async function bankList(): Promise<void> {
  const result = await api.get<{ items: BankAccount[]; total: number }>('/api/v1/bank-accounts');
  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data.items, `${result.data.total} bank accounts`);
}

async function bankCreate(): Promise<void> {
  const accountName = await prompt('Account name: ');
  const accountNumber = await prompt('Account number: ');
  const bankName = await prompt('Bank name (e.g. SCB, KBank): ');
  const currency = await prompt('Currency [THB]: ');

  const result = await api.post<BankAccount>('/api/v1/bank-accounts', {
    accountName,
    accountNumber,
    bankName,
    currency: currency || 'THB',
  });

  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Bank account ${result.data.accountName} created.`);
}

async function bankTransactions(id: string): Promise<void> {
  const result = await api.get<{
    account: BankAccount;
    recentTransactions: BankTransaction[];
  }>(`/api/v1/bank-accounts/${id}`);

  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }

  const { account, recentTransactions } = result.data;
  const balance = (parseInt(account.balanceSatang, 10) / 100).toFixed(2);
  printSuccess(recentTransactions, `${account.bankName} — ${account.accountName} | Balance: ฿${balance}`);
}

async function bankReconcile(txnId: string): Promise<void> {
  const jeId = await prompt('Journal Entry ID to match: ');
  if (!jeId) { printError('Journal Entry ID is required.'); process.exit(1); }

  const result = await api.post<BankTransaction>(`/api/v1/bank-transactions/${txnId}/reconcile`, {
    journalEntryId: jeId,
  });

  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }
  printSuccess(result.data, `Transaction ${txnId} reconciled to JE ${jeId}.`);
}

async function bankReport(id: string): Promise<void> {
  const result = await api.get<{
    unreconciledCount: number;
    unreconciledDebitSatang: string;
    unreconciledCreditSatang: string;
    unreconciledTransactions: BankTransaction[];
  }>(`/api/v1/bank-accounts/${id}/reconciliation`);

  if (!result.ok) { printError(result.error.detail, result.error.status); process.exit(1); }

  const { unreconciledCount, unreconciledTransactions } = result.data;
  printSuccess(unreconciledTransactions, `${unreconciledCount} unreconciled transactions`);
}

export function buildBankCommand(): Command {
  const cmd = new Command('bank')
    .description('จัดการบัญชีธนาคารและกระทบยอด (FI-BL) — Bank account and reconciliation management')
    .addHelpText('after', `
Examples:
  $ neip bank list                          # แสดงบัญชีธนาคารทั้งหมด
  $ neip bank create                        # เพิ่มบัญชีธนาคารใหม่ (interactive)
  $ neip bank transactions <id>             # ดูรายการเดินบัญชี
  $ neip bank reconcile <txnId>             # กระทบยอดรายการกับ journal entry
  $ neip bank report <id>                   # รายงานรายการที่ยังไม่กระทบยอด
  `);

  cmd.command('list')
    .description('แสดงรายการบัญชีธนาคาร — List bank accounts')
    .action(async () => { await bankList(); });

  cmd.command('create')
    .description('เพิ่มบัญชีธนาคารใหม่ (interactive) — Create a bank account interactively')
    .action(async () => { await bankCreate(); });

  cmd.command('transactions <id>')
    .description('แสดงรายการเดินบัญชีล่าสุด — Show recent transactions for a bank account')
    .action(async (id: string) => { await bankTransactions(id); });

  cmd.command('reconcile <txnId>')
    .description('กระทบยอดรายการธนาคารกับ journal entry — Reconcile a bank transaction to a journal entry')
    .action(async (txnId: string) => { await bankReconcile(txnId); });

  cmd.command('report <id>')
    .description('รายงานรายการที่ยังไม่กระทบยอด — Reconciliation report showing unmatched items')
    .action(async (id: string) => { await bankReport(id); });

  return cmd;
}
