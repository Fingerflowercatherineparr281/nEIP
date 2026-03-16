'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SkeletonRow } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface Department {
  id: string; code: string; nameTh: string; nameEn: string;
  managerId: string | null; costCenterId: string | null;
}

interface DeptListResponse { items: Department[]; total: number; }

const inputClasses = 'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

function DeptDialog({
  open, onOpenChange, dept, onSubmit, loading,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  dept?: Department; onSubmit: (d: { code: string; nameTh: string; nameEn: string }) => void; loading: boolean;
}): React.JSX.Element {
  const [code, setCode] = useState(dept?.code ?? '');
  const [nameTh, setNameTh] = useState(dept?.nameTh ?? '');
  const [nameEn, setNameEn] = useState(dept?.nameEn ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={dept ? 'Edit Department' : 'Add Department'}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ code, nameTh, nameEn }); }} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Code *</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ACC" className={inputClasses} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Name (TH) *</label>
          <input type="text" value={nameTh} onChange={(e) => setNameTh(e.target.value)} placeholder="แผนกบัญชี" className={inputClasses} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Name (EN) *</label>
          <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Accounting" className={inputClasses} required />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" loading={loading}>{dept ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function DepartmentsPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);

  const { data, isLoading } = useQuery<DeptListResponse>({
    queryKey: [tenantId, 'departments'],
    queryFn: () => api.get<DeptListResponse>('/departments'),
  });

  const createMutation = useMutation({
    mutationFn: (d: { code: string; nameTh: string; nameEn: string }) =>
      api.post('/departments', d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [tenantId, 'departments'] });
      setCreateOpen(false);
      showToast.success('Department created');
    },
    onError: (err: Error) => showToast.error(err instanceof AppError ? err.message : 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: string; code: string; nameTh: string; nameEn: string }) =>
      api.put(`/departments/${id}`, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [tenantId, 'departments'] });
      setEditTarget(null);
      showToast.success('Department updated');
    },
    onError: (err: Error) => showToast.error(err instanceof AppError ? err.message : 'Failed'),
  });

  const departments = data?.items ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Departments</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">Manage organisational departments</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />Add Department
        </Button>
      </div>

      {isLoading ? (
        <SkeletonRow count={4} />
      ) : departments.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No departments yet"
          description="Add your first department."
          ctaLabel="Add Department"
          onCtaClick={() => setCreateOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Code</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Name (TH)</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Name (EN)</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{dept.code}</td>
                  <td className="px-4 py-3">{dept.nameTh}</td>
                  <td className="px-4 py-3">{dept.nameEn}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditTarget(dept)}>
                      <Pencil className="h-3.5 w-3.5" />Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeptDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(d) => createMutation.mutate(d)}
        loading={createMutation.isPending}
      />

      {editTarget && (
        <DeptDialog
          open={!!editTarget}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
          dept={editTarget}
          onSubmit={(d) => updateMutation.mutate({ id: editTarget.id, ...d })}
          loading={updateMutation.isPending}
        />
      )}
    </div>
  );
}
