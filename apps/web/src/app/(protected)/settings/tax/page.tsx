'use client';

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { SkeletonRow } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { showToast } from '@/components/ui/toast';
import { InlineAlert } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaxType = 'vat' | 'wht';

interface TaxRate {
  id: string;
  taxType: TaxType;
  rateBasisPoints: number;
  incomeType: string | null;
  effectiveFrom: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

interface TaxRateListResponse {
  data: TaxRate[];
}

interface TaxRateFormData {
  taxType: TaxType;
  rateBasisPoints: number;
  incomeType: string;
  effectiveFrom: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function basisPointsToPercent(bp: number): string {
  return (bp / 100).toFixed(2) + '%';
}

// ---------------------------------------------------------------------------
// Tax Rate Form Dialog
// ---------------------------------------------------------------------------

interface TaxRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxRate?: TaxRate;
  onSubmit: (data: TaxRateFormData) => void;
  loading: boolean;
}

function TaxRateDialog({
  open,
  onOpenChange,
  taxRate,
  onSubmit,
  loading,
}: TaxRateDialogProps): React.JSX.Element {
  const isEdit = !!taxRate;

  const [taxType, setTaxType] = useState<TaxType>(taxRate?.taxType ?? 'vat');
  const [ratePercent, setRatePercent] = useState(
    taxRate ? (taxRate.rateBasisPoints / 100).toString() : '',
  );
  const [incomeType, setIncomeType] = useState(taxRate?.incomeType ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(
    taxRate ? taxRate.effectiveFrom.slice(0, 10) : '',
  );
  const [errors, setErrors] = useState<string[]>([]);

  const inputClasses =
    'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const validationErrors: string[] = [];
      const rateNum = parseFloat(ratePercent);
      if (isNaN(rateNum) || rateNum < 0) validationErrors.push('Rate must be a non-negative number');
      if (!effectiveFrom) validationErrors.push('Effective from date is required');
      if (taxType === 'wht' && !incomeType.trim()) validationErrors.push('Income type is required for WHT');

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors([]);
      onSubmit({
        taxType,
        rateBasisPoints: Math.round(rateNum * 100),
        incomeType: incomeType.trim(),
        effectiveFrom,
      });
    },
    [taxType, ratePercent, incomeType, effectiveFrom, onSubmit],
  );

  const handleClose = useCallback(() => {
    setErrors([]);
    if (!isEdit) {
      setTaxType('vat');
      setRatePercent('');
      setIncomeType('');
      setEffectiveFrom('');
    }
    onOpenChange(false);
  }, [isEdit, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={isEdit ? 'Edit Tax Rate' : 'Add Tax Rate'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && (
          <InlineAlert variant="error" message={errors.join(', ')} />
        )}

        <div>
          <label htmlFor="tax-type" className="mb-1.5 block text-sm font-medium text-foreground">
            Tax Type *
          </label>
          <select
            id="tax-type"
            value={taxType}
            onChange={(e) => setTaxType(e.target.value as TaxType)}
            className={inputClasses}
            disabled={isEdit}
          >
            <option value="vat">VAT (Value Added Tax)</option>
            <option value="wht">WHT (Withholding Tax)</option>
          </select>
        </div>

        <div>
          <label htmlFor="tax-rate" className="mb-1.5 block text-sm font-medium text-foreground">
            Rate (%) *
          </label>
          <input
            id="tax-rate"
            type="number"
            min="0"
            step="0.01"
            value={ratePercent}
            onChange={(e) => setRatePercent(e.target.value)}
            placeholder="e.g. 7 for 7%"
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Enter as percentage. 7% = 7, 3% = 3
          </p>
        </div>

        {taxType === 'wht' && (
          <div>
            <label htmlFor="income-type" className="mb-1.5 block text-sm font-medium text-foreground">
              Income Type *
            </label>
            <input
              id="income-type"
              type="text"
              value={incomeType}
              onChange={(e) => setIncomeType(e.target.value)}
              placeholder="e.g. 40(2) Service, 40(8) Other"
              className={inputClasses}
            />
          </div>
        )}

        <div>
          <label htmlFor="effective-from" className="mb-1.5 block text-sm font-medium text-foreground">
            Effective From *
          </label>
          <input
            id="effective-from"
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TaxRatesPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TaxRate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaxRate | null>(null);

  const { data, isLoading } = useQuery<TaxRateListResponse>({
    queryKey: queryKeys.taxRates(tenantId),
    queryFn: () => api.get<TaxRateListResponse>('/tax-rates'),
  });

  const taxRates = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (formData: TaxRateFormData) =>
      api.post<TaxRate>('/tax-rates', {
        taxType: formData.taxType,
        rateBasisPoints: formData.rateBasisPoints,
        ...(formData.incomeType ? { incomeType: formData.incomeType } : {}),
        effectiveFrom: formData.effectiveFrom,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxRates(tenantId) });
      setCreateOpen(false);
      showToast.success('Tax rate created');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to create tax rate');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: TaxRateFormData }) =>
      api.put<TaxRate>(`/tax-rates/${id}`, {
        rateBasisPoints: formData.rateBasisPoints,
        ...(formData.incomeType ? { incomeType: formData.incomeType } : {}),
        effectiveFrom: formData.effectiveFrom,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxRates(tenantId) });
      setEditTarget(null);
      showToast.success('Tax rate updated');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to update tax rate');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tax-rates/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxRates(tenantId) });
      setDeleteTarget(null);
      showToast.success('Tax rate deleted');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to delete tax rate');
    },
  });

  const TAX_TYPE_LABEL: Record<TaxType, string> = {
    vat: 'VAT',
    wht: 'WHT',
  };

  const TAX_TYPE_BADGE: Record<TaxType, string> = {
    vat: 'bg-blue-50 text-blue-700',
    wht: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          href="/settings"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Tax Rates</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Configure VAT and Withholding Tax rates for your organization
            </p>
          </div>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Tax Rate
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonRow count={4} />
      ) : taxRates.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No tax rates configured"
          description="Add your first tax rate to enable VAT and WHT calculations."
          ctaLabel="Add Tax Rate"
          onCtaClick={() => setCreateOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                  Tax Type
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">
                  Rate
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                  Income Type (WHT)
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                  Effective From
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {taxRates.map((rate) => (
                <tr
                  key={rate.id}
                  className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${TAX_TYPE_BADGE[rate.taxType] ?? 'bg-muted text-muted-foreground'}`}
                    >
                      {TAX_TYPE_LABEL[rate.taxType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {basisPointsToPercent(rate.rateBasisPoints)}
                  </td>
                  <td className="px-4 py-3">
                    {rate.incomeType ?? (
                      <span className="text-[var(--color-muted-foreground)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {rate.effectiveFrom.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditTarget(rate)}
                        aria-label={`Edit ${TAX_TYPE_LABEL[rate.taxType]} ${basisPointsToPercent(rate.rateBasisPoints)}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(rate)}
                        aria-label={`Delete ${TAX_TYPE_LABEL[rate.taxType]} ${basisPointsToPercent(rate.rateBasisPoints)}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[var(--color-destructive)]" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <TaxRateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />

      {/* Edit Dialog */}
      {editTarget && (
        <TaxRateDialog
          open={editTarget !== null}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
          taxRate={editTarget}
          onSubmit={(data) => updateMutation.mutate({ id: editTarget.id, formData: data })}
          loading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Tax Rate"
        description={`Are you sure you want to delete this ${deleteTarget ? TAX_TYPE_LABEL[deleteTarget.taxType] : ''} rate of ${deleteTarget ? basisPointsToPercent(deleteTarget.rateBasisPoints) : ''}? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
