'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { SkeletonRow } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface Product {
  id: string; sku: string; nameTh: string; nameEn: string;
  description: string | null; category: string | null; unit: string;
  costPriceSatang: number; sellingPriceSatang: number;
  minStockLevel: number; isActive: boolean;
}

interface ProductListResponse { items: Product[]; total: number; }

function formatBaht(satang: number): string {
  return (satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}

export default function ProductsPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    return p;
  }, [search]);

  const { data, isLoading } = useQuery<ProductListResponse>({
    queryKey: [tenantId, 'products', params],
    queryFn: () => api.get<ProductListResponse>('/products', params),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put<Product>(`/products/${id}`, { isActive: !isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [tenantId, 'products'] });
      showToast.success('Product updated');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to update product');
    },
  });

  const products = data?.items ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Products</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">Manage your product catalog</p>
        </div>
        <Link href="/products/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </Link>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by SKU, name..."
        resultCount={data?.total}
      />

      {isLoading ? (
        <SkeletonRow count={5} />
      ) : products.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No products found"
          description={search ? 'Try adjusting your search.' : 'Add your first product to get started.'}
          {...(!search ? { ctaLabel: 'Add Product', onCtaClick: () => { window.location.href = '/products/new'; } } : {})}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Name</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Category</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Unit</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Cost (฿)</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Price (฿)</th>
                <th className="px-4 py-3 text-center font-medium text-[var(--color-muted-foreground)]">Min Stock</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 font-mono text-xs">{product.sku}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{product.nameEn}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">{product.nameTh}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{product.category ?? '—'}</td>
                  <td className="px-4 py-3">{product.unit}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatBaht(product.costPriceSatang)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatBaht(product.sellingPriceSatang)}</td>
                  <td className="px-4 py-3 text-center">{product.minStockLevel}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/products/new?edit=${product.id}`}>
                        <Button variant="ghost" size="sm">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMutation.mutate({ id: product.id, isActive: product.isActive })}
                      >
                        {product.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
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
