'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SkeletonRow } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { showToast } from '@/components/ui/toast';
import { InlineAlert } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { api, AppError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetItem {
  id: string;
  accountId: string;
  fiscalYear: number;
  amountSatang: string;
  createdAt: string;
  updatedAt: string;
}

interface BudgetListResponse {
  items: BudgetItem[];
  total: number;
}

interface AccountRaw {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  accountType: string;
}

interface AccountListResponse {
  items: AccountRaw[];
  total: number;
}

interface BudgetFormData {
  accountId: string;
  fiscalYear: number;
  amountSatang: string;
}

// ---------------------------------------------------------------------------
// Create Budget Dialog
// ---------------------------------------------------------------------------

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountRaw[];
  onSubmit: (data: BudgetFormData) => void;
  loading: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i);

function CreateBudgetDialog({
  open,
  onOpenChange,
  accounts,
  onSubmit,
  loading,
}: CreateBudgetDialogProps): React.JSX.Element {
  const [accountId, setAccountId] = useState('');
  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR);
  const [amountBaht, setAmountBaht] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const inputClasses =
    'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const validationErrors: string[] = [];
      if (!accountId) validationErrors.push('Account is required');
      const bahtNum = parseFloat(amountBaht);
      if (!amountBaht || isNaN(bahtNum) || bahtNum <= 0)
        validationErrors.push('Amount must be a positive number');

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors([]);
      const amountSatang = Math.round(bahtNum * 100).toString();
      onSubmit({ accountId, fiscalYear, amountSatang });
    },
    [accountId, fiscalYear, amountBaht, onSubmit],
  );

  const handleClose = useCallback(() => {
    setAccountId('');
    setFiscalYear(CURRENT_YEAR);
    setAmountBaht('');
    setErrors([]);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose} title="Create Budget">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && (
          <InlineAlert variant="error" message={errors.join(', ')} />
        )}

        <div>
          <label htmlFor="budget-account" className="mb-1.5 block text-sm font-medium text-foreground">
            Account *
          </label>
          <select
            id="budget-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={inputClasses}
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.nameTh}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="budget-year" className="mb-1.5 block text-sm font-medium text-foreground">
            Fiscal Year *
          </label>
          <select
            id="budget-year"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            className={inputClasses}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="budget-amount" className="mb-1.5 block text-sm font-medium text-foreground">
            Budget Amount (THB) *
          </label>
          <input
            id="budget-amount"
            type="number"
            min="0"
            step="0.01"
            value={amountBaht}
            onChange={(e) => setAmountBaht(e.target.value)}
            placeholder="e.g. 500000.00"
            className={inputClasses}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit Budget Dialog
// ---------------------------------------------------------------------------

interface EditBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetItem | null;
  accountName: string;
  onSubmit: (id: string, amountSatang: string) => void;
  loading: boolean;
}

function EditBudgetDialog({
  open,
  onOpenChange,
  budget,
  accountName,
  onSubmit,
  loading,
}: EditBudgetDialogProps): React.JSX.Element {
  const initialBaht = budget ? (parseInt(budget.amountSatang, 10) / 100).toFixed(2) : '';
  const [amountBaht, setAmountBaht] = useState(initialBaht);
  const [errors, setErrors] = useState<string[]>([]);

  const inputClasses =
    'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const bahtNum = parseFloat(amountBaht);
      if (isNaN(bahtNum) || bahtNum <= 0) {
        setErrors(['Amount must be a positive number']);
        return;
      }
      setErrors([]);
      if (budget) {
        onSubmit(budget.id, Math.round(bahtNum * 100).toString());
      }
    },
    [amountBaht, budget, onSubmit],
  );

  const handleClose = useCallback(() => {
    setAmountBaht(initialBaht);
    setErrors([]);
    onOpenChange(false);
  }, [initialBaht, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose} title="Edit Budget">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && <InlineAlert variant="error" message={errors.join(', ')} />}

        <p className="text-sm text-[var(--color-muted-foreground)]">
          Account: <span className="font-medium text-[var(--color-foreground)]">{accountName}</span>
          {budget && (
            <span className="ml-2">/ FY {budget.fiscalYear}</span>
          )}
        </p>

        <div>
          <label htmlFor="edit-budget-amount" className="mb-1.5 block text-sm font-medium text-foreground">
            Budget Amount (THB) *
          </label>
          <input
            id="edit-budget-amount"
            type="number"
            min="0"
            step="0.01"
            value={amountBaht}
            onChange={(e) => setAmountBaht(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BudgetsPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BudgetItem | null>(null);

  const budgetParams = useMemo(
    () => ({ fiscalYear: fiscalYear.toString() }),
    [fiscalYear],
  );

  const { data: budgetData, isLoading: budgetsLoading } = useQuery<BudgetListResponse>({
    queryKey: queryKeys.budgets(tenantId, fiscalYear),
    queryFn: () => api.get<BudgetListResponse>('/budgets', budgetParams),
  });

  const { data: accountData, isLoading: accountsLoading } = useQuery<AccountListResponse>({
    queryKey: queryKeys.accountList(tenantId),
    queryFn: () => api.get<AccountListResponse>('/accounts'),
  });

  const budgets = budgetData?.items ?? [];
  const accounts = accountData?.items ?? [];

  const accountMap = useMemo(() => {
    const map = new Map<string, AccountRaw>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  const createMutation = useMutation({
    mutationFn: (data: BudgetFormData) => api.post('/budgets', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets(tenantId, fiscalYear) });
      setCreateOpen(false);
      showToast.success('Budget created');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to create budget');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, amountSatang }: { id: string; amountSatang: string }) =>
      api.put(`/budgets/${id}`, { amountSatang }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets(tenantId, fiscalYear) });
      setEditTarget(null);
      showToast.success('Budget updated');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to update budget');
    },
  });

  const editAccountName = useMemo(() => {
    if (!editTarget) return '';
    const acct = accountMap.get(editTarget.accountId);
    return acct ? `${acct.code} — ${acct.nameTh}` : editTarget.accountId;
  }, [editTarget, accountMap]);

  const inputClasses =
    'h-9 rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]';

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Budget Management</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Manage annual budgets by account and fiscal year
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Budget
        </Button>
      </div>

      {/* Fiscal Year Filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="fy-filter" className="text-sm font-medium text-[var(--color-foreground)]">
          Fiscal Year:
        </label>
        <select
          id="fy-filter"
          value={fiscalYear}
          onChange={(e) => setFiscalYear(Number(e.target.value))}
          className={inputClasses}
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {budgetData && (
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {budgetData.total} {budgetData.total === 1 ? 'budget' : 'budgets'}
          </span>
        )}
      </div>

      {/* Table */}
      {budgetsLoading || accountsLoading ? (
        <SkeletonRow count={5} />
      ) : budgets.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No budgets for this fiscal year"
          description="Create your first budget allocation to get started."
          ctaLabel="Create Budget"
          onCtaClick={() => setCreateOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                  Account Code
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                  Account Name
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">
                  Budget Amount
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => {
                const account = accountMap.get(budget.accountId);
                return (
                  <tr
                    key={budget.id}
                    className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30"
                  >
                    <td className="px-4 py-3 font-mono text-sm">
                      {account?.code ?? budget.accountId}
                    </td>
                    <td className="px-4 py-3">
                      {account ? (
                        <div>
                          <span>{account.nameTh}</span>
                          {account.nameEn && (
                            <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                              {account.nameEn}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]">Unknown account</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MoneyDisplay amount={BigInt(budget.amountSatang)} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditTarget(budget)}
                        aria-label={`Edit budget for ${account?.code ?? budget.accountId}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <CreateBudgetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={accounts}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />

      {/* Edit Dialog */}
      <EditBudgetDialog
        open={editTarget !== null}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        budget={editTarget}
        accountName={editAccountName}
        onSubmit={(id, amountSatang) => updateMutation.mutate({ id, amountSatang })}
        loading={updateMutation.isPending}
      />
    </div>
  );
}
