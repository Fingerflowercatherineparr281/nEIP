'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Eye, TrendingDown } from 'lucide-react';

import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRow } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FixedAsset {
  id: string;
  assetCode: string;
  nameTh: string;
  nameEn: string;
  category: string;
  purchaseDate: string;
  purchaseCostSatang: string;
  accumulatedDepreciationSatang: string;
  netBookValueSatang: string;
  status: string;
  depreciationMethod: string;
}

interface FixedAssetListResponse {
  items: FixedAsset[];
  total: number;
  hasMore: boolean;
}

const CATEGORY_OPTIONS = [
  { label: 'Land', value: 'land' },
  { label: 'Building', value: 'building' },
  { label: 'Equipment', value: 'equipment' },
  { label: 'Vehicle', value: 'vehicle' },
  { label: 'Furniture', value: 'furniture' },
  { label: 'IT Equipment', value: 'it_equipment' },
  { label: 'Other', value: 'other' },
];

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Disposed', value: 'disposed' },
  { label: 'Written Off', value: 'written_off' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-600 bg-green-50',
  disposed: 'text-orange-600 bg-orange-50',
  written_off: 'text-red-600 bg-red-50',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FixedAssetsPage(): React.JSX.Element {
  const router = useRouter();
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [depreciatingId, setDepreciatingId] = useState<string | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (category) p['category'] = category;
    if (status) p['status'] = status;
    return p;
  }, [category, status]);

  const { data, loading, refetch } = useApi<FixedAssetListResponse>('/fixed-assets', params);
  const assets = data?.items ?? [];

  const handleRunDepreciation = async (asset: FixedAsset): Promise<void> => {
    setDepreciatingId(asset.id);
    try {
      await api.post(`/fixed-assets/${asset.id}/depreciate`, {});
      showToast.success(`Depreciation run for ${asset.assetCode}`);
      refetch();
    } catch {
      showToast.error('Failed to run depreciation');
    } finally {
      setDepreciatingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
            Fixed Assets (สินทรัพย์ถาวร)
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Manage your fixed asset register and depreciation schedules
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/fixed-assets/report">
            <Button variant="outline" size="sm">
              Report
            </Button>
          </Link>
          <Link href="/fixed-assets/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              Register Asset
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar
          searchValue=""
          onSearchChange={() => undefined}
          searchPlaceholder="Search assets..."
          statusOptions={STATUS_OPTIONS}
          statusValue={status}
          onStatusChange={setStatus}
          resultCount={data?.total}
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-muted-foreground)]">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonRow count={5} />
      ) : assets.length === 0 ? (
        <EmptyState
          context="first-time"
          message="No fixed assets registered"
          description="Register your first asset to begin tracking depreciation."
          ctaLabel="Register First Asset"
          onCtaClick={() => router.push('/fixed-assets/new')}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)]/30">
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Accumulated Depr.</th>
                <th className="px-4 py-3 text-right">Net Book Value</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent)]/30"
                >
                  <td className="px-4 py-3 font-medium font-mono text-sm">{asset.assetCode}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{asset.nameEn}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">{asset.nameTh}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-[var(--color-muted-foreground)]">
                    {asset.category.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(asset.purchaseCostSatang || 0)} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(asset.accumulatedDepreciationSatang || 0)} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(asset.netBookValueSatang || 0)} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[asset.status] ?? ''}`}>
                      {asset.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/fixed-assets/${asset.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                      {asset.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={depreciatingId === asset.id}
                          onClick={() => void handleRunDepreciation(asset)}
                        >
                          <TrendingDown className="h-3.5 w-3.5" />
                          Depreciate
                        </Button>
                      )}
                    </div>
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
