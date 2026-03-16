'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Eye } from 'lucide-react';

import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRow } from '@/components/ui/skeleton';
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

interface BankAccountListResponse {
  items: BankAccount[];
  total: number;
}

interface CreateFormState {
  accountName: string;
  accountNumber: string;
  bankName: string;
  currency: string;
}

export default function BankPage(): React.JSX.Element {
  const { data, loading, refetch } = useApi<BankAccountListResponse>('/bank-accounts');
  const accounts = data?.items ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateFormState>({
    accountName: '',
    accountNumber: '',
    bankName: '',
    currency: 'THB',
  });

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/bank-accounts', form);
      showToast.success('Bank account created');
      setShowCreate(false);
      setForm({ accountName: '', accountNumber: '', bankName: '', currency: 'THB' });
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create bank account';
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]';

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
            Bank Reconciliation (กระทบยอดธนาคาร)
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Manage bank accounts and reconcile transactions
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Add Bank Account
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="mb-4 font-medium">New Bank Account</h2>
          <form onSubmit={(e) => void handleCreate(e)} className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Account Name *</label>
              <input className={inputClass} value={form.accountName} onChange={(e) => setForm((p) => ({ ...p, accountName: e.target.value }))} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Account Number *</label>
              <input className={inputClass} value={form.accountNumber} onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value }))} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bank Name *</label>
              <input className={inputClass} value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} placeholder="e.g. SCB, KBank, BBL" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <select className={inputClass} value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
                <option value="THB">THB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="col-span-2 flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" type="submit" loading={submitting}>Create</Button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts list */}
      {loading ? (
        <SkeletonRow count={3} />
      ) : accounts.length === 0 ? (
        <EmptyState
          context="first-time"
          message="No bank accounts yet"
          description="Connect your first bank account to start reconciling transactions."
          ctaLabel="Add First Bank Account"
          onCtaClick={() => setShowCreate(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acct) => (
            <div
              key={acct.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{acct.accountName}</p>
                  <p className="text-sm text-[var(--color-muted-foreground)]">{acct.bankName}</p>
                  <p className="font-mono text-xs text-[var(--color-muted-foreground)]">{acct.accountNumber}</p>
                </div>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{acct.currency}</span>
              </div>
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <p className="text-xs text-[var(--color-muted-foreground)]">Balance</p>
                <MoneyDisplay amount={BigInt(acct.balanceSatang)} size="md" className="mt-0.5" />
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/bank/${acct.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="h-3.5 w-3.5" />
                    Transactions
                  </Button>
                </Link>
                <Link href={`/bank/${acct.id}?tab=reconciliation`} className="flex-1">
                  <Button variant="ghost" size="sm" className="w-full">
                    Reconcile
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
