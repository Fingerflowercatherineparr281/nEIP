'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, TrendingUp } from 'lucide-react';

import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRow } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';

interface ProfitCenter {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  parentId: string | null;
  isActive: boolean;
}

interface ProfitCenterListResponse {
  items: ProfitCenter[];
  total: number;
}

export default function ProfitCentersPage(): React.JSX.Element {
  const { data, loading, refetch } = useApi<ProfitCenterListResponse>('/profit-centers');
  const centers = data?.items ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ code: '', nameTh: '', nameEn: '', parentId: '' });

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/profit-centers', {
        code: form.code,
        nameTh: form.nameTh,
        nameEn: form.nameEn,
        parentId: form.parentId || undefined,
      });
      showToast.success('Profit center created');
      setShowCreate(false);
      setForm({ code: '', nameTh: '', nameEn: '', parentId: '' });
      refetch();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]';

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Profit Centers (ศูนย์กำไร)</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">Manage profit centers for P&L analysis by business segment</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Profit Center
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <h2 className="mb-3 font-medium">Create Profit Center</h2>
          <form onSubmit={(e) => void handleCreate(e)} className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Code *</label>
              <input className={inputClass} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="PC-RETAIL" required maxLength={20} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Name (Thai) *</label>
              <input className={inputClass} value={form.nameTh} onChange={(e) => setForm((p) => ({ ...p, nameTh: e.target.value }))} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Name (English) *</label>
              <input className={inputClass} value={form.nameEn} onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Parent ID</label>
              <input className={inputClass} value={form.parentId} onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))} placeholder="Optional parent UUID" />
            </div>
            <div className="col-span-2 flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" type="submit" loading={submitting}>Create</Button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <SkeletonRow count={4} />
      ) : centers.length === 0 ? (
        <EmptyState
          context="profit-center-list"
          ctaLabel="Create First Profit Center"
          onCtaClick={() => setShowCreate(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)]/30">
              <tr className="border-b border-[var(--color-border)] text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Name (EN)</th>
                <th className="px-4 py-3 text-left">Name (TH)</th>
                <th className="px-4 py-3 text-left">Parent</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {centers.map((pc) => (
                <tr key={pc.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-accent)]/20">
                  <td className="px-4 py-3 font-mono font-medium text-sm">{pc.code}</td>
                  <td className="px-4 py-3 font-medium">{pc.nameEn}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{pc.nameTh}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">{pc.parentId ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${pc.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      {pc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/profit-centers/${pc.id}/report`}>
                      <Button variant="ghost" size="sm">
                        <TrendingUp className="h-3.5 w-3.5" />
                        P&L Report
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
