'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Package } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { SkeletonRow } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface StockLevel {
  product_id: string; warehouse_id: string;
  quantity_on_hand: number; quantity_reserved: number; quantity_available: number;
  sku: string; name_en: string; warehouse_name: string;
}

interface StockLevelsResponse { items: StockLevel[]; }

interface LowStockItem {
  product_id: string; sku: string; name_en: string; unit: string;
  min_stock_level: number; quantity_on_hand: number; shortage: number;
}

interface LowStockResponse { items: LowStockItem[]; count: number; }

export default function InventoryPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';

  const { data: stockData, isLoading: stockLoading } = useQuery<StockLevelsResponse>({
    queryKey: [tenantId, 'stock-levels'],
    queryFn: () => api.get<StockLevelsResponse>('/stock-levels'),
  });

  const { data: lowStockData } = useQuery<LowStockResponse>({
    queryKey: [tenantId, 'low-stock'],
    queryFn: () => api.get<LowStockResponse>('/inventory/low-stock'),
  });

  const stockLevels = stockData?.items ?? [];
  const lowStock = lowStockData?.items ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Stock Levels</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">Real-time inventory across all warehouses</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/movements">
            <Button variant="outline">Movement History</Button>
          </Link>
        </div>
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              Low Stock Alert — {String(lowStock.length)} product{lowStock.length !== 1 ? 's' : ''} below minimum
            </h2>
          </div>
          <div className="space-y-1">
            {lowStock.slice(0, 5).map((item) => (
              <div key={item.product_id} className="flex items-center justify-between text-sm text-yellow-700 dark:text-yellow-300">
                <span>{item.name_en} ({item.sku})</span>
                <span className="font-mono">
                  {item.quantity_on_hand} / {item.min_stock_level} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock levels table */}
      {stockLoading ? (
        <SkeletonRow count={8} />
      ) : stockLevels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-border)] p-12 text-center">
          <Package className="h-12 w-12 text-[var(--color-muted-foreground)] mb-4" />
          <p className="text-lg font-medium">No stock data yet</p>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
            Record your first stock movement to see levels here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Product</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Warehouse</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">On Hand</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Reserved</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Available</th>
              </tr>
            </thead>
            <tbody>
              {stockLevels.map((level) => (
                <tr
                  key={`${level.product_id}-${level.warehouse_id}`}
                  className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30"
                >
                  <td className="px-4 py-3 font-mono text-xs">{level.sku}</td>
                  <td className="px-4 py-3 font-medium">{level.name_en}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{level.warehouse_name}</td>
                  <td className="px-4 py-3 text-right font-mono">{level.quantity_on_hand}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--color-muted-foreground)]">{level.quantity_reserved}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono font-semibold ${level.quantity_available <= 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                      {level.quantity_available}
                    </span>
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
