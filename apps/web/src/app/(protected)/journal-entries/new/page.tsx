'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/ui/toast';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Raw API response from /accounts uses snake_case
interface AccountRaw {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  account_type: string;
  is_active: boolean;
}

interface AccountListResponse {
  items: AccountRaw[];
  total: number;
}

// Normalized camelCase version used by UI
interface Account {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  type: string;
}

interface LineItem {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
}

interface JournalEntryPayload {
  date: string;
  memo: string;
  lines: Array<{
    accountId: string;
    debitAmount: number;
    creditAmount: number;
  }>;
  status: 'draft' | 'pending';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function parseMoney(value: string): number {
  return Math.round(parseFloat(value.replace(/,/g, '') || '0') * 100);
}

function formatMoney(satang: number): string {
  if (satang === 0) return '';
  const val = (satang / 100).toFixed(2);
  return Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function emptyLine(): LineItem {
  return {
    id: generateId(),
    accountId: '',
    accountCode: '',
    accountName: '',
    debit: '',
    credit: '',
  };
}

// ---------------------------------------------------------------------------
// Account Search Select
// ---------------------------------------------------------------------------

interface AccountSelectProps {
  accounts: Account[];
  value: string;
  onChange: (accountId: string, code: string, name: string) => void;
}

function AccountSelect({ accounts, value, onChange }: AccountSelectProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return accounts.slice(0, 20);
    const q = search.toLowerCase();
    return accounts
      .filter(
        (a) =>
          a.code.toLowerCase().includes(q) ||
          a.nameTh.toLowerCase().includes(q) ||
          a.nameEn.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [accounts, search]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === value),
    [accounts, value],
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={open ? search : selectedAccount ? `${selectedAccount.code} - ${selectedAccount.nameTh}` : ''}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setSearch('');
        }}
        placeholder="Search account..."
        className="h-9 w-full min-w-[180px] rounded-md border border-input bg-transparent px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {filtered.map((acct) => (
            <button
              key={acct.id}
              type="button"
              onClick={() => {
                onChange(acct.id, acct.code, acct.nameTh);
                setOpen(false);
                setSearch('');
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="font-mono text-xs text-muted-foreground">{acct.code}</span>
              <span className="truncate">{acct.nameTh}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Amount Input
// ---------------------------------------------------------------------------

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function AmountInput({ value, onChange, placeholder = '0.00' }: AmountInputProps): React.JSX.Element {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only digits, dots, and commas
    const raw = e.target.value.replace(/[^0-9.,]/g, '');
    setDisplayValue(raw);
  }, []);

  const handleBlur = useCallback(() => {
    const satang = parseMoney(displayValue);
    const formatted = formatMoney(satang);
    setDisplayValue(formatted);
    onChange(formatted);
  }, [displayValue, onChange]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className="h-9 w-28 rounded-md border border-input bg-transparent px-2 text-right font-mono tabular-nums text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
    />
  );
}

// ---------------------------------------------------------------------------
// New Journal Entry Page
// ---------------------------------------------------------------------------

export default function NewJournalEntryPage(): React.JSX.Element {
  const router = useRouter();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);

  // Form state
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0] ?? '');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  // Auto-save timer ref
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch accounts for the select
  const { data: accountsData } = useQuery<AccountListResponse>({
    queryKey: queryKeys.accountList(tenantId),
    queryFn: () => api.get<AccountListResponse>('/accounts'),
    staleTime: 60 * 1000,
  });

  // Map snake_case API response to camelCase for UI consumption
  const accounts: Account[] = (accountsData?.items ?? []).map((raw) => ({
    id: raw.id,
    code: raw.code,
    nameTh: raw.name_th,
    nameEn: raw.name_en,
    type: raw.account_type,
  }));

  // Compute totals
  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += parseMoney(line.debit);
      totalCredit += parseMoney(line.credit);
    }
    return { totalDebit, totalCredit, difference: totalDebit - totalCredit };
  }, [lines]);

  const isBalanced = totals.difference === 0 && totals.totalDebit > 0;

  // Line item handlers
  const updateLine = useCallback(
    (lineId: string, updates: Partial<LineItem>) => {
      setLines((prev) =>
        prev.map((l) => (l.id === lineId ? { ...l, ...updates } : l)),
      );
    },
    [],
  );

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => {
      if (prev.length <= 2) return prev; // Must have at least 2 lines
      return prev.filter((l) => l.id !== lineId);
    });
  }, []);

  // Build payload
  const buildPayload = useCallback(
    (status: 'draft' | 'pending'): JournalEntryPayload => ({
      date,
      memo,
      status,
      lines: lines
        .filter((l) => l.accountId)
        .map((l) => ({
          accountId: l.accountId,
          debitAmount: parseMoney(l.debit),
          creditAmount: parseMoney(l.credit),
        })),
    }),
    [date, memo, lines],
  );

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: JournalEntryPayload) => {
      if (draftId) {
        return api.put<{ id: string }>(`/journal-entries/${draftId}`, payload);
      }
      return api.post<{ id: string }>('/journal-entries', payload);
    },
    onSuccess: (data) => {
      if (data && typeof data === 'object' && 'id' in data) {
        setDraftId(data.id);
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.journalEntries(tenantId),
      });
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to save');
    },
  });

  // Auto-save draft every 30s
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      const hasData = lines.some((l) => l.accountId);
      if (hasData) {
        saveMutation.mutate(buildPayload('draft'));
      }
    }, 30_000);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [lines, date, memo]); // saveMutation and buildPayload intentionally omitted to prevent re-registering interval

  // Submit handler
  const handleSubmit = useCallback(() => {
    setError(null);

    if (!date) {
      setError('Date is required');
      return;
    }

    const validLines = lines.filter((l) => l.accountId);
    if (validLines.length < 2) {
      setError('At least two line items with accounts are required');
      return;
    }

    if (!isBalanced) {
      setError('Debits and credits must be equal');
      return;
    }

    saveMutation.mutate(buildPayload('pending'), {
      onSuccess: () => {
        showToast.success('Journal entry submitted');
        router.push('/journal-entries');
      },
    });
  }, [date, lines, isBalanced, saveMutation, buildPayload, router]);

  // Save as draft handler
  const handleSaveDraft = useCallback(() => {
    saveMutation.mutate(buildPayload('draft'), {
      onSuccess: () => {
        showToast.success('Draft saved');
      },
    });
  }, [saveMutation, buildPayload]);

  const inputClasses =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 lg:px-8">
      {/* Header */}
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        New Journal Entry
      </h1>

      {/* Error */}
      {error && (
        <div className="mb-4">
          <InlineAlert variant="error" message={error} />
        </div>
      )}

      {/* Form fields */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="je-date" className="mb-1.5 block text-sm font-medium text-foreground">
            Date *
          </label>
          <input
            id="je-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="je-memo" className="mb-1.5 block text-sm font-medium text-foreground">
            Memo
          </label>
          <input
            id="je-memo"
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Description of this entry..."
            className={inputClasses}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="mb-4">
        <h2 className="mb-3 text-lg font-semibold text-foreground">Line Items</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Account</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Debit</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Credit</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">
                    <AccountSelect
                      accounts={accounts}
                      value={line.accountId}
                      onChange={(id, code, name) =>
                        updateLine(line.id, { accountId: id, accountCode: code, accountName: name })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <AmountInput
                      value={line.debit}
                      onChange={(val) => updateLine(line.id, { debit: val })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <AmountInput
                      value={line.credit}
                      onChange={(val) => updateLine(line.id, { credit: val })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length <= 2}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals */}
            <tfoot>
              <tr className="border-t border-border bg-muted/30">
                <td className="px-3 py-2 text-right font-medium text-foreground">
                  Totals
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums font-medium text-foreground">
                  {formatMoney(totals.totalDebit) || '0.00'}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums font-medium text-foreground">
                  {formatMoney(totals.totalCredit) || '0.00'}
                </td>
                <td />
              </tr>
              {totals.difference !== 0 && (
                <tr className="bg-destructive/5">
                  <td className="px-3 py-2 text-right text-sm font-medium text-destructive">
                    Difference
                  </td>
                  <td colSpan={2} className="px-3 py-2 text-right font-mono tabular-nums text-sm font-medium text-destructive">
                    {formatMoney(Math.abs(totals.difference))}
                    {totals.difference > 0 ? ' (Debit heavy)' : ' (Credit heavy)'}
                  </td>
                  <td />
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        <Button variant="outline" size="sm" onClick={addLine} className="mt-3">
          <Plus className="h-4 w-4" />
          Add Line
        </Button>
      </div>

      {/* Sticky submit footer */}
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-4 py-3 ${sidebarCollapsed ? 'lg:left-16' : 'lg:left-64'}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isBalanced ? (
              <span className="text-success">Balanced</span>
            ) : (
              <span className="text-destructive">
                Unbalanced: {formatMoney(Math.abs(totals.difference))} difference
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              loading={saveMutation.isPending}
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={saveMutation.isPending}
              disabled={!isBalanced}
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
