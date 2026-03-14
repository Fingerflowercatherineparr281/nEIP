'use client';

import { useCallback, useState } from 'react';

import { api } from '@/lib/api-client';
import { MoneyDisplay } from '@/components/domain/money-display';
import { ReportShell } from '../_components/report-shell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrialBalanceLine {
  code: string;
  name: string;
  /** Debit in satang */
  debit: number;
  /** Credit in satang */
  credit: number;
}

interface TrialBalanceData {
  accounts: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TrialBalancePage(): React.JSX.Element {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async (fiscalYear: string, period: string) => {
    setLoading(true);
    try {
      const result = await api.get<TrialBalanceData>('/reports/trial-balance', { fiscalYear, period });
      setData(result);
    } catch {
      // Handled by api-client
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <ReportShell
      title="Trial Balance"
      description="All accounts with debit and credit totals"
      loading={loading}
      onGenerate={handleGenerate}
    >
      {data ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Account Name</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((acct, i) => (
              <tr
                key={`${acct.code}-${i}`}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-accent)]/30"
              >
                <td className="px-4 py-2 font-mono-figures text-[var(--color-muted-foreground)]">
                  {acct.code}
                </td>
                <td className="px-4 py-2">{acct.name}</td>
                <td className="px-4 py-2 text-right">
                  {acct.debit > 0 ? (
                    <MoneyDisplay amount={BigInt(acct.debit)} size="sm" />
                  ) : (
                    <span className="text-[var(--color-muted-foreground)]">--</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {acct.credit > 0 ? (
                    <MoneyDisplay amount={BigInt(acct.credit)} size="sm" />
                  ) : (
                    <span className="text-[var(--color-muted-foreground)]">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--color-foreground)] font-bold">
              <td colSpan={2} className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">
                <MoneyDisplay amount={BigInt(data.totalDebit)} size="md" />
              </td>
              <td className="px-4 py-3 text-right">
                <MoneyDisplay amount={BigInt(data.totalCredit)} size="md" />
              </td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div className="px-4 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
          Select a fiscal year and period, then click Generate to view the trial balance.
        </div>
      )}
    </ReportShell>
  );
}
