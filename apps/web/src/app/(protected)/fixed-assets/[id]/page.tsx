'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, TrendingDown, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';

import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';

interface FixedAsset {
  id: string;
  assetCode: string;
  nameTh: string;
  nameEn: string;
  category: string;
  purchaseDate: string;
  purchaseCostSatang: string;
  salvageValueSatang: string;
  usefulLifeMonths: number;
  depreciationMethod: string;
  accumulatedDepreciationSatang: string;
  netBookValueSatang: string;
  status: string;
  disposalDate: string | null;
  disposalAmountSatang: string | null;
  glAccountId: string | null;
  depreciationAccountId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function FixedAssetDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: asset, loading, refetch } = useApi<FixedAsset>(`/fixed-assets/${id}`);
  const [depreciating, setDepreciating] = useState(false);
  const [disposing, setDisposing] = useState(false);
  const [disposeAmount, setDisposeAmount] = useState('');
  const [showDisposeForm, setShowDisposeForm] = useState(false);

  const handleDepreciate = async (): Promise<void> => {
    setDepreciating(true);
    try {
      const result = await api.post<{ depreciationSatang: string }>(`/fixed-assets/${id}/depreciate`, {});
      const amount = parseFloat(result.depreciationSatang) / 100;
      showToast.success(`Depreciation of ฿${amount.toFixed(2)} recorded`);
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Depreciation failed';
      showToast.error(msg);
    } finally {
      setDepreciating(false);
    }
  };

  const handleDispose = async (): Promise<void> => {
    if (!disposeAmount) { showToast.error('Enter disposal amount'); return; }
    setDisposing(true);
    try {
      const amountSatang = String(Math.round(parseFloat(disposeAmount) * 100));
      await api.post(`/fixed-assets/${id}/dispose`, {
        disposalDate: new Date().toISOString().slice(0, 10),
        disposalAmountSatang: amountSatang,
      });
      showToast.success('Asset disposed successfully');
      setShowDisposeForm(false);
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Disposal failed';
      showToast.error(msg);
    } finally {
      setDisposing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6">
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-4 lg:p-6">
        <p className="text-[var(--color-muted-foreground)]">Asset not found.</p>
      </div>
    );
  }

  const deprPercent = asset.purchaseCostSatang !== '0'
    ? Math.round((parseInt(asset.accumulatedDepreciationSatang, 10) / parseInt(asset.purchaseCostSatang, 10)) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl p-4 lg:p-6">
      <div className="mb-6">
        <Link href="/fixed-assets" className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
          <ChevronLeft className="h-4 w-4" />
          Back to Fixed Assets
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{asset.nameEn}</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">{asset.assetCode} — {asset.nameTh}</p>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${asset.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
            {asset.status}
          </span>
        </div>
      </div>

      {/* Asset details grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Purchase Cost</p>
          <MoneyDisplay amount={BigInt(asset.purchaseCostSatang)} size="lg" className="mt-1" />
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Net Book Value</p>
          <MoneyDisplay amount={BigInt(asset.netBookValueSatang)} size="lg" className="mt-1" />
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Accumulated Depreciation</p>
          <MoneyDisplay amount={BigInt(asset.accumulatedDepreciationSatang)} size="lg" className="mt-1" />
          <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-orange-400" style={{ width: `${Math.min(deprPercent, 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{deprPercent}% depreciated</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Details</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted-foreground)]">Category</dt>
              <dd className="capitalize">{asset.category.replace('_', ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted-foreground)]">Purchase Date</dt>
              <dd>{asset.purchaseDate}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted-foreground)]">Useful Life</dt>
              <dd>{asset.usefulLifeMonths} months</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted-foreground)]">Method</dt>
              <dd className="capitalize">{asset.depreciationMethod.replace('_', ' ')}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Actions */}
      {asset.status === 'active' && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" loading={depreciating} onClick={() => void handleDepreciate()}>
            <TrendingDown className="h-4 w-4" />
            Run Monthly Depreciation
          </Button>
          <Button variant="destructive" onClick={() => setShowDisposeForm(!showDisposeForm)}>
            <Trash2 className="h-4 w-4" />
            Dispose Asset
          </Button>
        </div>
      )}

      {/* Dispose form */}
      {showDisposeForm && (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <h3 className="font-medium text-orange-800">Dispose Asset</h3>
          <p className="mt-1 text-sm text-orange-600">Enter the proceeds from disposal to record a gain or loss.</p>
          <div className="mt-3 flex gap-3">
            <input
              type="number"
              step="0.01"
              min="0"
              value={disposeAmount}
              onChange={(e) => setDisposeAmount(e.target.value)}
              placeholder="Disposal proceeds (THB)"
              className="flex-1 rounded-md border border-orange-300 bg-white px-3 py-2 text-sm"
            />
            <Button variant="destructive" loading={disposing} onClick={() => void handleDispose()}>
              Confirm Disposal
            </Button>
            <Button variant="outline" onClick={() => setShowDisposeForm(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
