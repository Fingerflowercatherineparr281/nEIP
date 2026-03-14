'use client';

import { useCallback, useState } from 'react';

import { api } from '@/lib/api-client';
import { MoneyDisplay } from '@/components/domain/money-display';
import { ReportShell } from '../_components/report-shell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EquityComponent {
  name: string;
  /** Opening balance in satang */
  opening: number;
  /** Additions in satang */
  additions: number;
  /** Deductions in satang */
  deductions: number;
  /** Net income in satang */
  netIncome: number;
  /** Closing balance in satang */
  closing: number;
}

interface EquityChangesData {
  components: EquityComponent[];
  totalOpening: number;
  totalAdditions: number;
  totalDeductions: number;
  totalNetIncome: number;
  totalClosing: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EquityChangesPage(): React.JSX.Element {
  const [data, setData] = useState<EquityChangesData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async (fiscalYear: string, period: string) => {
    setLoading(true);
    try {
      const result = await api.get<EquityChangesData>('/reports/equity-changes', { fiscalYear, period });
      setData(result);
    } catch {
      // Handled by api-client
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <ReportShell
      title="Statement of Changes in Equity"
      description="Opening balance, changes, and closing balance"
      loading={loading}
      onGenerate={handleGenerate}
    >
      {data ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <th className="px-4 py-3">Component</th>
              <th className="px-4 py-3 text-right">Opening</th>
              <th className="px-4 py-3 text-right">Additions</th>
              <th className="px-4 py-3 text-right">Deductions</th>
              <th className="px-4 py-3 text-right">Net Income</th>
              <th className="px-4 py-3 text-right">Closing</th>
            </tr>
          </thead>
          <tbody>
            {data.components.map((comp, i) => (
              <tr
                key={`${comp.name}-${i}`}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-accent)]/30"
              >
                <td className="px-4 py-2 font-medium">{comp.name}</td>
                <td className="px-4 py-2 text-right">
                  <MoneyDisplay amount={BigInt(comp.opening)} size="sm" format="accounting" />
                </td>
                <td className="px-4 py-2 text-right">
                  <MoneyDisplay amount={BigInt(comp.additions)} size="sm" format="accounting" />
                </td>
                <td className="px-4 py-2 text-right">
                  <MoneyDisplay amount={BigInt(comp.deductions)} size="sm" format="accounting" />
                </td>
                <td className="px-4 py-2 text-right">
                  <MoneyDisplay amount={BigInt(comp.netIncome)} size="sm" format="accounting" />
                </td>
                <td className="px-4 py-2 text-right">
                  <MoneyDisplay amount={BigInt(comp.closing)} size="sm" format="accounting" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--color-foreground)] font-bold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">
                <MoneyDisplay amount={BigInt(data.totalOpening)} size="md" format="accounting" />
              </td>
              <td className="px-4 py-3 text-right">
                <MoneyDisplay amount={BigInt(data.totalAdditions)} size="md" format="accounting" />
              </td>
              <td className="px-4 py-3 text-right">
                <MoneyDisplay amount={BigInt(data.totalDeductions)} size="md" format="accounting" />
              </td>
              <td className="px-4 py-3 text-right">
                <MoneyDisplay amount={BigInt(data.totalNetIncome)} size="md" format="accounting" />
              </td>
              <td className="px-4 py-3 text-right">
                <MoneyDisplay amount={BigInt(data.totalClosing)} size="md" format="accounting" />
              </td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div className="px-4 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
          Select a fiscal year and period, then click Generate to view equity changes.
        </div>
      )}
    </ReportShell>
  );
}
