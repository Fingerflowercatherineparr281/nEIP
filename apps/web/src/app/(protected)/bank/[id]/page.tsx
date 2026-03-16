'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Plus, CheckCircle } from 'lucide-react';

import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';

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
  reference: string | null;
  reconciled: boolean;
  reconciledJeId: string | null;
}

interface AccountDetailResponse {
  account: BankAccount;
  recentTransactions: BankTransaction[];
}

export default function BankAccountDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, loading, refetch } = useApi<AccountDetailResponse>(`/bank-accounts/${id}`);
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [jeInput, setJeInput] = useState('');

  const [txnForm, setTxnForm] = useState({
    transactionDate: new Date().toISOString().slice(0, 10),
    description: '',
    debitSatang: '',
    creditSatang: '',
    reference: '',
  });

  const handleAddTxn = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/bank-accounts/${id}/transactions`, {
        transactionDate: txnForm.transactionDate,
        description: txnForm.description,
        debitSatang: txnForm.debitSatang ? String(Math.round(parseFloat(txnForm.debitSatang) * 100)) : '0',
        creditSatang: txnForm.creditSatang ? String(Math.round(parseFloat(txnForm.creditSatang) * 100)) : '0',
        reference: txnForm.reference || undefined,
      });
      showToast.success('Transaction added');
      setShowAddTxn(false);
      refetch();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconcile = async (txnId: string): Promise<void> => {
    if (!jeInput.trim()) { showToast.error('Enter Journal Entry ID'); return; }
    try {
      await api.post(`/bank-transactions/${txnId}/reconcile`, { journalEntryId: jeInput.trim() });
      showToast.success('Transaction reconciled');
      setReconcileId(null);
      setJeInput('');
      refetch();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Reconciliation failed');
    }
  };

  if (loading) return <div className="p-4 lg:p-6"><SkeletonCard count={2} /></div>;
  if (!data) return <div className="p-4 lg:p-6"><p>Account not found.</p></div>;

  const { account, recentTransactions } = data;
  const inputClass = 'w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]';

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-6">
      <div className="mb-6">
        <Link href="/bank" className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
          <ChevronLeft className="h-4 w-4" />
          Back to Bank Accounts
        </Link>
        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{account.accountName}</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">{account.bankName} — {account.accountNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--color-muted-foreground)]">Balance ({account.currency})</p>
            <MoneyDisplay amount={BigInt(account.balanceSatang)} size="lg" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Transactions</h2>
        <Button variant="outline" size="sm" onClick={() => setShowAddTxn(!showAddTxn)}>
          <Plus className="h-3.5 w-3.5" />
          Add Transaction
        </Button>
      </div>

      {showAddTxn && (
        <div className="mb-4 rounded-lg border border-[var(--color-border)] p-4">
          <form onSubmit={(e) => void handleAddTxn(e)} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Date *</label>
                <input type="date" className={inputClass} value={txnForm.transactionDate} onChange={(e) => setTxnForm((p) => ({ ...p, transactionDate: e.target.value }))} required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Debit (THB)</label>
                <input type="number" step="0.01" min="0" className={inputClass} value={txnForm.debitSatang} onChange={(e) => setTxnForm((p) => ({ ...p, debitSatang: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Credit (THB)</label>
                <input type="number" step="0.01" min="0" className={inputClass} value={txnForm.creditSatang} onChange={(e) => setTxnForm((p) => ({ ...p, creditSatang: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Description *</label>
              <input className={inputClass} value={txnForm.description} onChange={(e) => setTxnForm((p) => ({ ...p, description: e.target.value }))} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Reference</label>
              <input className={inputClass} value={txnForm.reference} onChange={(e) => setTxnForm((p) => ({ ...p, reference: e.target.value }))} />
            </div>
            <div className="col-span-2 flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setShowAddTxn(false)}>Cancel</Button>
              <Button variant="primary" type="submit" loading={submitting}>Add</Button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)]/30">
            <tr className="border-b border-[var(--color-border)] text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Reference</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map((txn) => (
              <tr key={txn.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-accent)]/20">
                <td className="px-4 py-3 text-sm">{txn.transactionDate}</td>
                <td className="px-4 py-3">{txn.description}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">{txn.reference ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  {txn.debitSatang !== '0' && <MoneyDisplay amount={BigInt(txn.debitSatang)} size="sm" />}
                </td>
                <td className="px-4 py-3 text-right">
                  {txn.creditSatang !== '0' && <MoneyDisplay amount={BigInt(txn.creditSatang)} size="sm" />}
                </td>
                <td className="px-4 py-3">
                  {txn.reconciled ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Reconciled
                    </span>
                  ) : (
                    <span className="text-xs text-orange-500">Unreconciled</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!txn.reconciled && (
                    reconcileId === txn.id ? (
                      <div className="flex gap-1">
                        <input
                          className="w-32 rounded border border-[var(--color-input)] px-2 py-1 text-xs"
                          value={jeInput}
                          onChange={(e) => setJeInput(e.target.value)}
                          placeholder="JE UUID"
                        />
                        <Button variant="primary" size="sm" onClick={() => void handleReconcile(txn.id)}>OK</Button>
                        <Button variant="ghost" size="sm" onClick={() => { setReconcileId(null); setJeInput(''); }}>X</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => { setReconcileId(txn.id); setJeInput(''); }}>
                        Match JE
                      </Button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentTransactions.length === 0 && (
          <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            No transactions yet. Add a manual entry or import a bank statement.
          </div>
        )}
      </div>
    </div>
  );
}
