'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { SkeletonRow } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';

interface StockMovement {
  id: string; productId: string; warehouseId: string;
  movementType: string; quantity: number;
  referenceType: string | null; referenceId: string | null;
  batchNumber: string | null; notes: string | null;
  balanceAfter: number; unitCostSatang: number;
  createdBy: string; createdAt: string;
}

interface MovementsResponse { items: StockMovement[]; total: number; }

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  receive: 'Receive',
  issue: 'Issue',
  transfer: 'Transfer',
  adjust: 'Adjust',
  return: 'Return',
};

const MOVEMENT_COLORS: Record<string, string> = {
  receive: 'text-green-600 dark:text-green-400',
  issue: 'text-red-600 dark:text-red-400',
  transfer: 'text-blue-600 dark:text-blue-400',
  adjust: 'text-yellow-600 dark:text-yellow-400',
  return: 'text-purple-600 dark:text-purple-400',
};

export default function InventoryMovementsPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const [search, setSearch] = useState('');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['productId'] = search;
    return p;
  }, [search]);

  const { data, isLoading } = useQuery<MovementsResponse>({
    queryKey: [tenantId, 'stock-movements', params],
    queryFn: () => api.get<MovementsResponse>('/stock-movements', params),
  });

  const movements = data?.items ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Movement History</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">All stock in/out/transfer/adjustment records</p>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter by product ID..."
        resultCount={data?.total}
      />

      {isLoading ? (
        <SkeletonRow count={8} />
      ) : movements.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No movements found"
          description="Stock movements will appear here as they are recorded."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Date</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Type</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Product</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Balance</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Reference</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)] whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${MOVEMENT_COLORS[m.movementType] ?? ''}`}>
                      {MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{m.productId}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={m.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {m.quantity > 0 ? `+${String(m.quantity)}` : String(m.quantity)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{m.balanceAfter}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{m.referenceType ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)] max-w-xs truncate">{m.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
