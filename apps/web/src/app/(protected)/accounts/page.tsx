'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { FilterBar } from '@/components/ui/filter-bar';
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

interface Account {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  type: string;
  status: 'active' | 'inactive';
}

interface AccountListResponse {
  data: Account[];
  total: number;
}

interface AccountFormData {
  code: string;
  nameTh: string;
  nameEn: string;
  type: string;
}

const ACCOUNT_TYPES = [
  { label: 'Asset', value: 'asset' },
  { label: 'Liability', value: 'liability' },
  { label: 'Equity', value: 'equity' },
  { label: 'Revenue', value: 'revenue' },
  { label: 'Expense', value: 'expense' },
];

// ---------------------------------------------------------------------------
// Add/Edit Dialog
// ---------------------------------------------------------------------------

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
  onSubmit: (data: AccountFormData) => void;
  loading: boolean;
}

function AccountDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
  loading,
}: AccountDialogProps): React.JSX.Element {
  const [code, setCode] = useState(account?.code ?? '');
  const [nameTh, setNameTh] = useState(account?.nameTh ?? '');
  const [nameEn, setNameEn] = useState(account?.nameEn ?? '');
  const [type, setType] = useState(account?.type ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const validationErrors: string[] = [];
      if (!code.trim()) validationErrors.push('Code is required');
      if (!nameTh.trim()) validationErrors.push('Thai name is required');
      if (!type) validationErrors.push('Type is required');

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors([]);
      onSubmit({ code: code.trim(), nameTh: nameTh.trim(), nameEn: nameEn.trim(), type });
    },
    [code, nameTh, nameEn, type, onSubmit],
  );

  const inputClasses =
    'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={account ? 'Edit Account' : 'Add Account'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && (
          <InlineAlert
            variant="error"
            message={errors.join(', ')}
          />
        )}

        <div>
          <label htmlFor="acct-code" className="mb-1.5 block text-sm font-medium text-foreground">
            Code *
          </label>
          <input
            id="acct-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 1100"
            className={inputClasses}
            disabled={!!account}
          />
        </div>

        <div>
          <label htmlFor="acct-name-th" className="mb-1.5 block text-sm font-medium text-foreground">
            Name (Thai) *
          </label>
          <input
            id="acct-name-th"
            type="text"
            value={nameTh}
            onChange={(e) => setNameTh(e.target.value)}
            placeholder="e.g. เงินสด"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="acct-name-en" className="mb-1.5 block text-sm font-medium text-foreground">
            Name (English)
          </label>
          <input
            id="acct-name-en"
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="e.g. Cash"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="acct-type" className="mb-1.5 block text-sm font-medium text-foreground">
            Type *
          </label>
          <select
            id="acct-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClasses}
            disabled={!!account}
          >
            <option value="">Select type</option>
            {ACCOUNT_TYPES.map((at) => (
              <option key={at.value} value={at.value}>
                {at.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {account ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Inline Edit Cell
// ---------------------------------------------------------------------------

interface InlineEditCellProps {
  value: string;
  onSave: (value: string) => void;
}

function InlineEditCell({ value, onSave }: InlineEditCellProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = useCallback(() => {
    if (editValue.trim() && editValue.trim() !== value) {
      onSave(editValue.trim());
    }
    setEditing(false);
  }, [editValue, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSave();
      if (e.key === 'Escape') {
        setEditValue(value);
        setEditing(false);
      }
    },
    [handleSave, value],
  );

  if (editing) {
    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="h-8 w-full rounded border border-input bg-transparent px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-1 text-left"
      title="Click to edit"
    >
      <span>{value}</span>
      <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" aria-hidden="true" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Accounts Page
// ---------------------------------------------------------------------------

export default function AccountsPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  // Filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  // Build filter params
  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    if (typeFilter) params['type'] = typeFilter;
    return params;
  }, [search, typeFilter]);

  // Query
  const { data, isLoading } = useQuery<AccountListResponse>({
    queryKey: queryKeys.accountList(tenantId, filters),
    queryFn: () => api.get<AccountListResponse>('/accounts', filters),
  });

  const accounts = data?.data ?? [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (formData: AccountFormData) => api.post('/accounts', formData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts(tenantId) });
      setAddDialogOpen(false);
      showToast.success('Account created');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to create account');
    },
  });

  // Update mutation (inline edit)
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; nameTh?: string; nameEn?: string }) =>
      api.patch(`/accounts/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts(tenantId) });
      showToast.success('Account updated');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to update account');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts(tenantId) });
      setDeleteTarget(null);
      showToast.success('Account deactivated');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to deactivate account');
    },
  });

  const handleInlineEdit = useCallback(
    (accountId: string, field: 'nameTh' | 'nameEn', value: string) => {
      updateMutation.mutate({ id: accountId, [field]: value });
    },
    [updateMutation],
  );

  const typeBadgeClasses: Record<string, string> = {
    asset: 'bg-blue-50 text-blue-700',
    liability: 'bg-red-50 text-red-700',
    equity: 'bg-purple-50 text-purple-700',
    revenue: 'bg-green-50 text-green-700',
    expense: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
        <Button variant="primary" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by code or name..."
        statusOptions={ACCOUNT_TYPES}
        statusValue={typeFilter}
        onStatusChange={setTypeFilter}
        resultCount={data?.total ?? 0}
        className="mb-4"
      />

      {/* Table */}
      {isLoading ? (
        <SkeletonRow count={8} />
      ) : accounts.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No accounts found"
          description={search || typeFilter ? 'Try adjusting your filters.' : 'Add your first account to get started.'}
          {...(!search && !typeFilter ? { ctaLabel: 'Add Account', onCtaClick: () => setAddDialogOpen(true) } : {})}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name (Thai)</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Name (English)</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct) => (
                <tr key={acct.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-sm">{acct.code}</td>
                  <td className="px-4 py-3">
                    <InlineEditCell
                      value={acct.nameTh}
                      onSave={(val) => handleInlineEdit(acct.id, 'nameTh', val)}
                    />
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <InlineEditCell
                      value={acct.nameEn}
                      onSave={(val) => handleInlineEdit(acct.id, 'nameEn', val)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${typeBadgeClasses[acct.type] ?? 'bg-muted text-muted-foreground'}`}
                    >
                      {acct.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${acct.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {acct.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(acct)}
                      aria-label={`Delete ${acct.code}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Account Dialog */}
      <AccountDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Deactivate Account"
        description={`Are you sure you want to deactivate account ${deleteTarget?.code ?? ''} (${deleteTarget?.nameTh ?? ''})? This is a soft delete and can be reversed.`}
        confirmLabel="Deactivate"
        confirmVariant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
