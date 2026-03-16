'use client';

/**
 * P&L Comparison page — /reports/pnl
 *
 * Tabs: Monthly | YTD | YoY | MoM
 *
 * All monetary amounts are stored as satang strings (bigint-safe) and
 * rendered via <MoneyDisplay>.
 */

import { useCallback, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api-client';
import { MoneyDisplay } from '@/components/domain/money-display';
import { Button } from '@/components/ui/button';
import { SkeletonRow } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FISCAL_YEARS = [2026, 2025, 2024, 2023];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const inputClasses = cn(
  'h-9 rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
  'text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
);

type PnlMode = 'monthly' | 'ytd' | 'yoy' | 'mom';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface MonthlyAccount {
  code: string;
  nameTh: string;
  type: 'revenue' | 'expense';
  months: string[]; // 12 satang strings
  total: string;
}

interface MonthlySummary {
  totalRevenue: string[];
  totalExpenses: string[];
  netIncome: string[];
}

interface MonthlyResponse {
  mode: 'monthly' | 'ytd';
  fiscalYear: number;
  accounts: MonthlyAccount[];
  summary: MonthlySummary;
}

interface ComparisonAccount {
  code: string;
  nameTh: string;
  type: 'revenue' | 'expense';
  current: string;
  previous: string;
  changeSatang: string;
  changePercent: number | null;
}

interface YoyResponse {
  mode: 'yoy';
  currentYear: number;
  previousYear: number;
  accounts: ComparisonAccount[];
  summary: {
    currentRevenue: string;
    previousRevenue: string;
    currentExpenses: string;
    previousExpenses: string;
    currentNet: string;
    previousNet: string;
  };
}

interface MomResponse {
  mode: 'mom';
  currentPeriod: { year: number; month: number };
  previousPeriod: { year: number; month: number };
  accounts: ComparisonAccount[];
  summary: {
    currentRevenue: string;
    previousRevenue: string;
    currentExpenses: string;
    previousExpenses: string;
    currentNet: string;
    previousNet: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function satangToBigInt(s: string | undefined | null): bigint {
  if (s === undefined || s === null || s === '') return 0n;
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  label: string;
  colSpan: number;
}

function SectionHeader({ label, colSpan }: SectionHeaderProps): React.JSX.Element {
  return (
    <tr className="bg-[var(--color-muted)]">
      <td
        colSpan={colSpan}
        className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]"
      >
        {label}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Monthly / YTD table
// ---------------------------------------------------------------------------

function MonthlyTable({ data }: { data: MonthlyResponse }): React.JSX.Element {
  const revenueAccounts = data.accounts.filter((a) => a.type === 'revenue');
  const expenseAccounts = data.accounts.filter((a) => a.type === 'expense');
  const colCount = 14; // code+name + 12 months + total

  function AccountRow({ account }: { account: MonthlyAccount }): React.JSX.Element {
    return (
      <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-accent)]/20">
        <td className="whitespace-nowrap px-3 py-1.5 text-xs text-[var(--color-muted-foreground)]">
          {account.code}
        </td>
        <td className="min-w-[10rem] px-3 py-1.5 text-sm">{account.nameTh}</td>
        {account.months.map((m, i) => (
          <td key={i} className="whitespace-nowrap px-2 py-1.5 text-right">
            <MoneyDisplay amount={satangToBigInt(m)} size="sm" format="accounting" />
          </td>
        ))}
        <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold">
          <MoneyDisplay amount={satangToBigInt(account.total)} size="sm" format="accounting" />
        </td>
      </tr>
    );
  }

  function SummaryRow({
    label,
    values,
    highlight,
  }: {
    label: string;
    values: string[];
    highlight?: boolean;
  }): React.JSX.Element {
    const total = values.reduce((s, v) => s + satangToBigInt(v), 0n);
    return (
      <tr
        className={cn(
          'border-t-2 border-[var(--color-foreground)]',
          highlight && 'bg-[var(--color-muted)] font-bold text-base',
          !highlight && 'font-semibold',
        )}
      >
        <td colSpan={2} className="px-3 py-2 text-sm">
          {label}
        </td>
        {values.map((v, i) => (
          <td key={i} className="whitespace-nowrap px-2 py-2 text-right">
            <MoneyDisplay amount={satangToBigInt(v)} size="sm" format="accounting" />
          </td>
        ))}
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <MoneyDisplay amount={total} size="sm" format="accounting" />
        </td>
      </tr>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-[var(--color-muted-foreground)]">
              Code
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-muted-foreground)]">
              Account
            </th>
            {MONTH_LABELS.map((m) => (
              <th
                key={m}
                className="whitespace-nowrap px-2 py-2 text-right text-xs font-semibold text-[var(--color-muted-foreground)]"
              >
                {m}
              </th>
            ))}
            <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-[var(--color-muted-foreground)]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="Revenue" colSpan={colCount} />
          {revenueAccounts.map((a) => (
            <AccountRow key={a.code} account={a} />
          ))}
          <SummaryRow label="Total Revenue" values={data.summary.totalRevenue} />

          <SectionHeader label="Expenses" colSpan={colCount} />
          {expenseAccounts.map((a) => (
            <AccountRow key={a.code} account={a} />
          ))}
          <SummaryRow label="Total Expenses" values={data.summary.totalExpenses} />

          <SummaryRow label="Net Income" values={data.summary.netIncome} highlight />
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// YoY / MoM comparison table
// ---------------------------------------------------------------------------

interface ComparisonTableProps {
  accounts: ComparisonAccount[];
  currentLabel: string;
  previousLabel: string;
  summary: {
    currentRevenue: string;
    previousRevenue: string;
    currentExpenses: string;
    previousExpenses: string;
    currentNet: string;
    previousNet: string;
  };
}

function ComparisonTable({
  accounts,
  currentLabel,
  previousLabel,
  summary,
}: ComparisonTableProps): React.JSX.Element {
  const revenueAccounts = accounts.filter((a) => a.type === 'revenue');
  const expenseAccounts = accounts.filter((a) => a.type === 'expense');

  function AccountRow({ account }: { account: ComparisonAccount }): React.JSX.Element {
    const changeBigInt = satangToBigInt(account.changeSatang);
    return (
      <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-accent)]/20">
        <td className="whitespace-nowrap px-3 py-1.5 text-xs text-[var(--color-muted-foreground)]">
          {account.code}
        </td>
        <td className="min-w-[12rem] px-3 py-1.5 text-sm">{account.nameTh}</td>
        <td className="whitespace-nowrap px-3 py-1.5 text-right">
          <MoneyDisplay amount={satangToBigInt(account.current)} size="sm" format="accounting" />
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 text-right">
          <MoneyDisplay amount={satangToBigInt(account.previous)} size="sm" format="accounting" />
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 text-right">
          <MoneyDisplay amount={changeBigInt} size="sm" format="accounting" showSign />
        </td>
        <td
          className={cn(
            'whitespace-nowrap px-3 py-1.5 text-right text-sm font-mono',
            account.changePercent !== null && account.changePercent >= 0
              ? 'text-[var(--color-money-positive)]'
              : account.changePercent !== null
                ? 'text-[var(--color-money-negative)]'
                : 'text-[var(--color-muted-foreground)]',
          )}
        >
          {formatPercent(account.changePercent)}
        </td>
      </tr>
    );
  }

  function SummaryRow({
    label,
    current,
    previous,
    highlight,
  }: {
    label: string;
    current: string;
    previous: string;
    highlight?: boolean;
  }): React.JSX.Element {
    const curBig = satangToBigInt(current);
    const prevBig = satangToBigInt(previous);
    const changeBig = curBig - prevBig;
    const pct = prevBig === 0n ? null : Number((changeBig * 10000n) / prevBig) / 100;
    return (
      <tr
        className={cn(
          'border-t-2 border-[var(--color-foreground)]',
          highlight && 'bg-[var(--color-muted)] font-bold',
          !highlight && 'font-semibold',
        )}
      >
        <td colSpan={2} className="px-3 py-2 text-sm">
          {label}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <MoneyDisplay amount={curBig} size="sm" format="accounting" />
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <MoneyDisplay amount={prevBig} size="sm" format="accounting" />
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <MoneyDisplay amount={changeBig} size="sm" format="accounting" showSign />
        </td>
        <td
          className={cn(
            'whitespace-nowrap px-3 py-2 text-right text-sm font-mono',
            pct !== null && pct >= 0
              ? 'text-[var(--color-money-positive)]'
              : pct !== null
                ? 'text-[var(--color-money-negative)]'
                : 'text-[var(--color-muted-foreground)]',
          )}
        >
          {formatPercent(pct)}
        </td>
      </tr>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-[var(--color-muted-foreground)]">
              Code
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-muted-foreground)]">
              Account
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-[var(--color-muted-foreground)]">
              {currentLabel}
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-[var(--color-muted-foreground)]">
              {previousLabel}
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-[var(--color-muted-foreground)]">
              Change
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-[var(--color-muted-foreground)]">
              Change %
            </th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="Revenue" colSpan={6} />
          {revenueAccounts.map((a) => (
            <AccountRow key={a.code} account={a} />
          ))}
          <SummaryRow
            label="Total Revenue"
            current={summary.currentRevenue}
            previous={summary.previousRevenue}
          />

          <SectionHeader label="Expenses" colSpan={6} />
          {expenseAccounts.map((a) => (
            <AccountRow key={a.code} account={a} />
          ))}
          <SummaryRow
            label="Total Expenses"
            current={summary.currentExpenses}
            previous={summary.previousExpenses}
          />

          <SummaryRow
            label="Net Income"
            current={summary.currentNet}
            previous={summary.previousNet}
            highlight
          />
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PnlComparisonPage(): React.JSX.Element {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<PnlMode>('monthly');
  const [fiscalYear, setFiscalYear] = useState<number>(FISCAL_YEARS[0]!);
  const [fiscalPeriod, setFiscalPeriod] = useState<number>(new Date().getMonth() + 1);
  const [compareYear, setCompareYear] = useState<number>(FISCAL_YEARS[1]!);
  const [loading, setLoading] = useState(false);

  const [monthlyData, setMonthlyData] = useState<MonthlyResponse | null>(null);
  const [ytdData, setYtdData] = useState<MonthlyResponse | null>(null);
  const [yoyData, setYoyData] = useState<YoyResponse | null>(null);
  const [momData, setMomData] = useState<MomResponse | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        mode: activeMode,
        fiscalYear: String(fiscalYear),
      };

      if (activeMode === 'mom' || activeMode === 'monthly') {
        params['fiscalPeriod'] = String(fiscalPeriod);
      }
      if (activeMode === 'yoy') {
        params['compareYear'] = String(compareYear);
      }

      const result = await api.get<MonthlyResponse | YoyResponse | MomResponse>(
        '/reports/pnl-comparison',
        params,
      );

      switch (activeMode) {
        case 'monthly':
          setMonthlyData(result as MonthlyResponse);
          break;
        case 'ytd':
          setYtdData(result as MonthlyResponse);
          break;
        case 'yoy':
          setYoyData(result as YoyResponse);
          break;
        case 'mom':
          setMomData(result as MomResponse);
          break;
      }
    } catch {
      // Errors surfaced by api-client
    } finally {
      setLoading(false);
    }
  }, [activeMode, fiscalYear, fiscalPeriod, compareYear]);

  const TABS: { id: PnlMode; label: string }[] = [
    { id: 'monthly', label: 'Monthly' },
    { id: 'ytd', label: 'YTD' },
    { id: 'yoy', label: 'Year-over-Year' },
    { id: 'mom', label: 'Month-over-Month' },
  ];

  function renderContent(): React.JSX.Element {
    if (loading) {
      return (
        <div className="p-4">
          <SkeletonRow count={10} />
        </div>
      );
    }

    switch (activeMode) {
      case 'monthly':
        return monthlyData ? (
          <MonthlyTable data={monthlyData} />
        ) : (
          <EmptyState />
        );
      case 'ytd':
        return ytdData ? (
          <MonthlyTable data={ytdData} />
        ) : (
          <EmptyState />
        );
      case 'yoy':
        return yoyData ? (
          <ComparisonTable
            accounts={yoyData.accounts}
            currentLabel={`FY ${yoyData.currentYear}`}
            previousLabel={`FY ${yoyData.previousYear}`}
            summary={yoyData.summary}
          />
        ) : (
          <EmptyState />
        );
      case 'mom':
        return momData ? (
          <ComparisonTable
            accounts={momData.accounts}
            currentLabel={`${MONTH_LABELS[(momData.currentPeriod.month - 1) % 12]} ${momData.currentPeriod.year}`}
            previousLabel={`${MONTH_LABELS[(momData.previousPeriod.month - 1) % 12]} ${momData.previousPeriod.year}`}
            summary={momData.summary}
          />
        ) : (
          <EmptyState />
        );
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/reports')}
            aria-label="Back to reports"
          >
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
              P&L Comparison
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Compare profit & loss across periods, years, and months
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveMode(tab.id)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeMode === tab.id
                ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
                : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Fiscal Year
          </label>
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            className={cn(inputClasses, 'w-28')}
          >
            {FISCAL_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {activeMode === 'yoy' && (
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Compare Year
            </label>
            <select
              value={compareYear}
              onChange={(e) => setCompareYear(Number(e.target.value))}
              className={cn(inputClasses, 'w-28')}
            >
              {FISCAL_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}

        {(activeMode === 'mom') && (
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Period (Month)
            </label>
            <select
              value={fiscalPeriod}
              onChange={(e) => setFiscalPeriod(Number(e.target.value))}
              className={cn(inputClasses, 'w-36')}
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={i + 1} value={i + 1}>
                  {label} (Period {i + 1})
                </option>
              ))}
            </select>
          </div>
        )}

        <Button variant="primary" size="md" onClick={handleGenerate} loading={loading}>
          Generate
        </Button>
      </div>

      {/* Report content */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
        {renderContent()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState(): React.JSX.Element {
  return (
    <div className="px-4 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
      Select options above and click Generate to view the P&L comparison.
    </div>
  );
}
