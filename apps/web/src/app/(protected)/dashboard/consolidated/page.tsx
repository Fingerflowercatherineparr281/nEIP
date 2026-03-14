'use client';

/**
 * Consolidated Cross-Organization Overview — Story 14.3
 *
 * Features:
 * 1. Table of all user's organizations with key metrics
 * 2. Sortable by any metric column
 * 3. Click org to navigate and switch tenant context
 * 4. All amounts use MoneyDisplay
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, ArrowUpDown } from 'lucide-react';

import { SkeletonRow } from '@/components/ui/skeleton';
import { MoneyDisplay } from '@/components/domain/money-display';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MoneyVO {
  amountSatang: string;
  currency: string;
}

interface OrgMetrics {
  tenantId: string;
  tenantName: string;
  revenueMtd: MoneyVO;
  expensesMtd: MoneyVO;
  netIncome: MoneyVO;
  outstandingAr: MoneyVO;
  outstandingAp: MoneyVO;
}

interface ConsolidatedData {
  generatedAt: string;
  organizations: OrgMetrics[];
}

type SortKey = 'tenantName' | 'revenueMtd' | 'expensesMtd' | 'netIncome' | 'outstandingAr' | 'outstandingAp';
type SortDirection = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMoneyValue(item: OrgMetrics, key: SortKey): bigint | string {
  switch (key) {
    case 'tenantName':
      return item.tenantName;
    case 'revenueMtd':
      return BigInt(item.revenueMtd.amountSatang);
    case 'expensesMtd':
      return BigInt(item.expensesMtd.amountSatang);
    case 'netIncome':
      return BigInt(item.netIncome.amountSatang);
    case 'outstandingAr':
      return BigInt(item.outstandingAr.amountSatang);
    case 'outstandingAp':
      return BigInt(item.outstandingAp.amountSatang);
  }
}

// ---------------------------------------------------------------------------
// Sortable column header
// ---------------------------------------------------------------------------

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortHeader({ label, sortKey, currentSort, direction, onSort, className }: SortHeaderProps): React.JSX.Element {
  const isActive = currentSort === sortKey;
  return (
    <th
      className={`py-3 px-2 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground ${className ?? ''}`}
      onClick={() => onSort(sortKey)}
      role="columnheader"
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <ArrowUpDown
          className={`h-3 w-3 ${isActive ? 'text-foreground' : 'text-muted-foreground/50'}`}
          aria-hidden="true"
        />
      </div>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ConsolidatedDashboardPage(): React.JSX.Element {
  const router = useRouter();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const setTenantId = useAuthStore((s) => s.setTenantId);

  const [sortKey, setSortKey] = useState<SortKey>('tenantName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { data, isLoading } = useQuery<ConsolidatedData>({
    queryKey: [tenantId, 'dashboard', 'consolidated'],
    queryFn: () => api.get<ConsolidatedData>('/dashboard/consolidated'),
  });

  const handleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedOrgs = useMemo(() => {
    const orgs = [...(data?.organizations ?? [])];
    orgs.sort((a, b) => {
      const aVal = getMoneyValue(a, sortKey);
      const bVal = getMoneyValue(b, sortKey);

      let comparison: number;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal, 'th');
      } else {
        const aBig = aVal as bigint;
        const bBig = bVal as bigint;
        comparison = aBig < bBig ? -1 : aBig > bBig ? 1 : 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return orgs;
  }, [data?.organizations, sortKey, sortDirection]);

  const handleOrgClick = (orgTenantId: string): void => {
    setTenantId(orgTenantId);
    router.push('/dashboard');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-foreground">Consolidated Overview</h1>
      </div>

      {data?.generatedAt && (
        <p className="mb-4 text-xs text-muted-foreground">
          Generated: {new Date(data.generatedAt).toLocaleString('th-TH')}
        </p>
      )}

      {isLoading ? (
        <SkeletonRow count={5} />
      ) : sortedOrgs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">No organizations found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <SortHeader
                  label="Organization"
                  sortKey="tenantName"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="text-left"
                />
                <SortHeader
                  label="Revenue (MTD)"
                  sortKey="revenueMtd"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortHeader
                  label="Expenses (MTD)"
                  sortKey="expensesMtd"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortHeader
                  label="Net Income"
                  sortKey="netIncome"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortHeader
                  label="Outstanding AR"
                  sortKey="outstandingAr"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortHeader
                  label="Outstanding AP"
                  sortKey="outstandingAp"
                  currentSort={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
              </tr>
            </thead>
            <tbody>
              {sortedOrgs.map((org) => (
                <tr
                  key={org.tenantId}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => handleOrgClick(org.tenantId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOrgClick(org.tenantId);
                    }
                  }}
                >
                  <td className="py-3 px-2 font-medium text-foreground">
                    {org.tenantName}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <MoneyDisplay
                      amount={BigInt(org.revenueMtd.amountSatang)}
                      size="sm"
                    />
                  </td>
                  <td className="py-3 px-2 text-right">
                    <MoneyDisplay
                      amount={BigInt(org.expensesMtd.amountSatang)}
                      size="sm"
                    />
                  </td>
                  <td className="py-3 px-2 text-right">
                    <MoneyDisplay
                      amount={BigInt(org.netIncome.amountSatang)}
                      size="sm"
                      showSign
                    />
                  </td>
                  <td className="py-3 px-2 text-right">
                    <MoneyDisplay
                      amount={BigInt(org.outstandingAr.amountSatang)}
                      size="sm"
                    />
                  </td>
                  <td className="py-3 px-2 text-right">
                    <MoneyDisplay
                      amount={BigInt(org.outstandingAp.amountSatang)}
                      size="sm"
                    />
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
