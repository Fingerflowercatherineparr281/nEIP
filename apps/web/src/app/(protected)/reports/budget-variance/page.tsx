'use client';

import { useCallback, useState } from 'react';

import { cn } from '@/lib/cn';
import { api } from '@/lib/api-client';
import { MoneyDisplay } from '@/components/domain/money-display';
import { ReportShell } from '../_components/report-shell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VarianceLine {
  code: string;
  name: string;
  /** Budget in satang */
  budget: number;
  /** Actual in satang */
  actual: number;
  /** Variance in satang (actual - budget) */
  variance: number;
  /** Variance percentage */
  variancePercent: number;
  category: string;
}

interface BudgetVarianceData {
  lines: VarianceLine[];
}

function varianceColor(pct: number): string {
  if (pct >= 10) return 'text-[var(--color-money-negative)] font-semibold';
  if (pct >= 5) return 'text-[var(--color-due-soon)]';
  if (pct <= -5) return 'text-[var(--color-money-positive)]';
  return 'text-[var(--color-muted-foreground)]';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BudgetVariancePage(): React.JSX.Element {
  const [data, setData] = useState<BudgetVarianceData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async (fiscalYear: string, period: string) => {
    setLoading(true);
    try {
      const result = await api.get<BudgetVarianceData>('/reports/budget-variance', { fiscalYear, period });
      setData(result);
    } catch {
      // Handled by api-client
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <ReportShell
      title="Budget vs Actual"
      description="Budget variance analysis with color-coded percentages"
      loading={loading}
      onGenerate={handleGenerate}
    >
      {data ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Budget</th>
              <th className="px-4 py-3 text-right">Actual</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3 text-right">Var %</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line, i) => (
              <tr
                key={`${line.code}-${i}`}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-accent)]/30"
              >
                <td className="px-4 py-2 font-mono-figures text-[var(--color-muted-foreground)]">
                  {line.code}
                </td>
                <td className="px-4 py-2">{line.name}</td>
                <td className="px-4 py-2 text-[var(--color-muted-foreground)]">{line.category}</td>
                <td className="px-4 py-2 text-right">
                  <MoneyDisplay amount={BigInt(line.budget)} size="sm" />
                </td>
                <td className="px-4 py-2 text-right">
                  <MoneyDisplay amount={BigInt(line.actual)} size="sm" />
                </td>
                <td className="px-4 py-2 text-right">
                  <MoneyDisplay amount={BigInt(line.variance)} size="sm" showSign format="accounting" />
                </td>
                <td className={cn('px-4 py-2 text-right font-mono-figures', varianceColor(line.variancePercent))}>
                  {line.variancePercent > 0 ? '+' : ''}{line.variancePercent.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="px-4 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
          Select a fiscal year and period, then click Generate to view budget variance.
        </div>
      )}
    </ReportShell>
  );
}
