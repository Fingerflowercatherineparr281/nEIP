'use client';

import { useCallback, useState } from 'react';

import { api } from '@/lib/api-client';
import { MoneyDisplay } from '@/components/domain/money-display';
import { ReportShell } from '../_components/report-shell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountLine {
  code: string;
  name: string;
  /** Amount in satang */
  amount: number;
  indent: number;
  isSubtotal: boolean;
}

interface IncomeStatementData {
  revenue: AccountLine[];
  revenueTotal: number;
  expenses: AccountLine[];
  expensesTotal: number;
  netIncome: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IncomeStatementPage(): React.JSX.Element {
  const [data, setData] = useState<IncomeStatementData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async (fiscalYear: string, period: string) => {
    setLoading(true);
    try {
      const result = await api.get<IncomeStatementData>('/reports/income-statement', { fiscalYear, period });
      setData(result);
    } catch {
      // Handled by api-client
    } finally {
      setLoading(false);
    }
  }, []);

  function renderSection(
    title: string,
    lines: AccountLine[],
    total: number,
    totalLabel: string,
  ): React.JSX.Element {
    return (
      <div className="p-4">
        <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">{title}</h2>
        <table className="w-full text-sm">
          <tbody>
            {lines.map((line, i) => (
              <tr
                key={`${line.code}-${i}`}
                className={line.isSubtotal
                  ? 'border-t border-[var(--color-border)] font-semibold'
                  : 'hover:bg-[var(--color-accent)]/30'}
              >
                <td
                  className="py-1.5 text-[var(--color-muted-foreground)]"
                  style={{ paddingLeft: `${line.indent * 1.5 + 0.5}rem` }}
                >
                  {line.code}
                </td>
                <td className="py-1.5">{line.name}</td>
                <td className="py-1.5 text-right">
                  <MoneyDisplay amount={BigInt(line.amount)} size="sm" format="accounting" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--color-foreground)] font-bold">
              <td colSpan={2} className="py-2">{totalLabel}</td>
              <td className="py-2 text-right">
                <MoneyDisplay amount={BigInt(total)} size="md" format="accounting" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <ReportShell
      title="Income Statement"
      description="Revenue, expenses, and net income for a period"
      loading={loading}
      onGenerate={handleGenerate}
    >
      {data ? (
        <div className="divide-y divide-[var(--color-border)]">
          {renderSection('Revenue', data.revenue, data.revenueTotal, 'Total Revenue')}
          {renderSection('Expenses', data.expenses, data.expensesTotal, 'Total Expenses')}
          <div className="bg-[var(--color-muted)] p-4">
            <div className="flex items-center justify-between text-base font-bold">
              <span>Net Income</span>
              <MoneyDisplay amount={BigInt(data.netIncome)} size="lg" format="accounting" />
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
          Select a fiscal year and period, then click Generate to view the income statement.
        </div>
      )}
    </ReportShell>
  );
}
