'use client';

import { useCallback, useState } from 'react';

import { api } from '@/lib/api-client';
import { MoneyDisplay } from '@/components/domain/money-display';
import { ReportShell } from '../_components/report-shell';

// ---------------------------------------------------------------------------
// Types — matched to actual API response
// ---------------------------------------------------------------------------

interface AmountWithCurrency {
  amountSatang: string | number;
  currency?: string;
}

interface TrialBalanceLine {
  code?: string;
  name?: string;
  nameTh?: string;
  nameEn?: string;
  accountType?: string;
  /** Debit in satang — may be nested object */
  debit?: number | AmountWithCurrency;
  debitSatang?: number | string;
  /** Credit in satang — may be nested object */
  credit?: number | AmountWithCurrency;
  creditSatang?: number | string;
}

interface TrialBalanceData {
  reportName?: string;
  generatedAt?: string;
  fiscalYear?: number;
  accounts: TrialBalanceLine[];
  /** May be object {amountSatang, currency} or number */
  totalDebits: number | AmountWithCurrency;
  totalCredits: number | AmountWithCurrency;
  // Legacy keys (keep for compat)
  totalDebit?: number | AmountWithCurrency;
  totalCredit?: number | AmountWithCurrency;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSatang(val: number | AmountWithCurrency | undefined): bigint {
  if (val === undefined || val === null) return 0n;
  if (typeof val === 'number') return BigInt(val);
  if (typeof val === 'object' && 'amountSatang' in val) {
    return BigInt(val.amountSatang || 0);
  }
  return 0n;
}

function getAccountName(acct: TrialBalanceLine): string {
  return acct.nameEn ?? acct.nameTh ?? acct.name ?? '—';
}

function getDebitSatang(acct: TrialBalanceLine): bigint {
  if (acct.debitSatang !== undefined) return BigInt(acct.debitSatang);
  if (acct.debit !== undefined) return toSatang(acct.debit as number | AmountWithCurrency);
  return 0n;
}

function getCreditSatang(acct: TrialBalanceLine): bigint {
  if (acct.creditSatang !== undefined) return BigInt(acct.creditSatang);
  if (acct.credit !== undefined) return toSatang(acct.credit as number | AmountWithCurrency);
  return 0n;
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

  // Normalize totals — API uses `totalDebits`/`totalCredits`
  const totalDebitSatang = data
    ? toSatang((data.totalDebits ?? data.totalDebit) as number | AmountWithCurrency | undefined)
    : 0n;
  const totalCreditSatang = data
    ? toSatang((data.totalCredits ?? data.totalCredit) as number | AmountWithCurrency | undefined)
    : 0n;

  // Filter out empty account rows
  const accounts = (data?.accounts ?? []).filter(
    (acct) => acct && (acct.code || acct.name || acct.nameTh || acct.nameEn),
  );

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
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-muted-foreground)]">
                  No account data available for this fiscal year.
                </td>
              </tr>
            ) : (
              accounts.map((acct, i) => {
                const debit = getDebitSatang(acct);
                const credit = getCreditSatang(acct);
                return (
                  <tr
                    key={`${acct.code ?? ''}-${i}`}
                    className="border-b border-[var(--color-border)] hover:bg-[var(--color-accent)]/30"
                  >
                    <td className="px-4 py-2 font-mono-figures text-[var(--color-muted-foreground)]">
                      {acct.code ?? '—'}
                    </td>
                    <td className="px-4 py-2">{getAccountName(acct)}</td>
                    <td className="px-4 py-2 text-right">
                      {debit > 0n ? (
                        <MoneyDisplay amount={debit} size="sm" />
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]">--</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {credit > 0n ? (
                        <MoneyDisplay amount={credit} size="sm" />
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]">--</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--color-foreground)] font-bold">
              <td colSpan={2} className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">
                <MoneyDisplay amount={totalDebitSatang} size="md" />
              </td>
              <td className="px-4 py-3 text-right">
                <MoneyDisplay amount={totalCreditSatang} size="md" />
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
