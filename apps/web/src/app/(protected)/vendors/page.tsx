'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
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

interface Vendor {
  id: string;
  name: string;
  taxId: string | null;
  address: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

interface VendorListResponse {
  items: Vendor[];
  total: number;
}

interface VendorFormData {
  name: string;
  taxId: string;
  address: string;
}

// ---------------------------------------------------------------------------
// Vendor Dialog (Create / Edit)
// ---------------------------------------------------------------------------

interface VendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor;
  onSubmit: (data: VendorFormData) => void;
  loading: boolean;
}

function VendorDialog({
  open,
  onOpenChange,
  vendor,
  onSubmit,
  loading,
}: VendorDialogProps): React.JSX.Element {
  const [name, setName] = useState(vendor?.name ?? '');
  const [taxId, setTaxId] = useState(vendor?.taxId ?? '');
  const [address, setAddress] = useState(vendor?.address ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const inputClasses =
    'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const validationErrors: string[] = [];
      if (!name.trim()) validationErrors.push('Vendor name is required');

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors([]);
      onSubmit({ name: name.trim(), taxId: taxId.trim(), address: address.trim() });
    },
    [name, taxId, address, onSubmit],
  );

  const handleClose = useCallback(() => {
    setErrors([]);
    if (!vendor) {
      setName('');
      setTaxId('');
      setAddress('');
    }
    onOpenChange(false);
  }, [vendor, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={vendor ? 'Edit Vendor' : 'Add Vendor'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && (
          <InlineAlert variant="error" message={errors.join(', ')} />
        )}

        <div>
          <label htmlFor="vendor-name" className="mb-1.5 block text-sm font-medium text-foreground">
            Name *
          </label>
          <input
            id="vendor-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Supplies Co., Ltd."
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="vendor-tax-id" className="mb-1.5 block text-sm font-medium text-foreground">
            Tax ID (TIN)
          </label>
          <input
            id="vendor-tax-id"
            type="text"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="e.g. 0105555123456"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="vendor-address" className="mb-1.5 block text-sm font-medium text-foreground">
            Address
          </label>
          <textarea
            id="vendor-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Full address"
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {vendor ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VendorsPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    return p;
  }, [search]);

  const { data, isLoading } = useQuery<VendorListResponse>({
    queryKey: queryKeys.vendors(tenantId, queryParams),
    queryFn: () => api.get<VendorListResponse>('/vendors', queryParams),
  });

  const vendors = data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (formData: VendorFormData) =>
      api.post<Vendor>('/vendors', {
        name: formData.name,
        ...(formData.taxId ? { taxId: formData.taxId } : {}),
        ...(formData.address ? { address: formData.address } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendors(tenantId) });
      setCreateOpen(false);
      showToast.success('Vendor created');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to create vendor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: VendorFormData }) =>
      api.put<Vendor>(`/vendors/${id}`, {
        name: formData.name,
        ...(formData.taxId ? { taxId: formData.taxId } : {}),
        ...(formData.address ? { address: formData.address } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendors(tenantId) });
      setEditTarget(null);
      showToast.success('Vendor updated');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to update vendor');
    },
  });

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Vendors</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Manage your supplier and vendor directory
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      {/* Search */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or tax ID..."
        resultCount={data?.total}
      />

      {/* Table */}
      {isLoading ? (
        <SkeletonRow count={5} />
      ) : vendors.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No vendors found"
          description={search ? 'Try adjusting your search.' : 'Add your first vendor to get started.'}
          {...(!search ? { ctaLabel: 'Add Vendor', onCtaClick: () => setCreateOpen(true) } : {})}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                  Tax ID
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)] md:table-cell">
                  Address
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30"
                >
                  <td className="px-4 py-3 font-medium">{vendor.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {vendor.taxId ?? (
                      <span className="text-[var(--color-muted-foreground)]">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--color-muted-foreground)] md:table-cell">
                    {vendor.address ? (
                      <span className="max-w-xs truncate block">{vendor.address}</span>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditTarget(vendor)}
                      aria-label={`Edit ${vendor.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <VendorDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />

      {/* Edit Dialog */}
      {editTarget && (
        <VendorDialog
          open={editTarget !== null}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
          vendor={editTarget}
          onSubmit={(data) => updateMutation.mutate({ id: editTarget.id, formData: data })}
          loading={updateMutation.isPending}
        />
      )}
    </div>
  );
}
