'use client';

import { useCallback, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { SkeletonRow } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportShellProps {
  title: string;
  description: string;
  loading: boolean;
  onGenerate: (fiscalYear: string, period: string) => void;
  children: React.ReactNode;
}

const FISCAL_YEARS = ['2569', '2568', '2567', '2566'];
const PERIODS = [
  { label: 'Full Year', value: 'full' },
  { label: 'Q1 (Jan-Mar)', value: 'q1' },
  { label: 'Q2 (Apr-Jun)', value: 'q2' },
  { label: 'Q3 (Jul-Sep)', value: 'q3' },
  { label: 'Q4 (Oct-Dec)', value: 'q4' },
  { label: 'January', value: '01' },
  { label: 'February', value: '02' },
  { label: 'March', value: '03' },
  { label: 'April', value: '04' },
  { label: 'May', value: '05' },
  { label: 'June', value: '06' },
  { label: 'July', value: '07' },
  { label: 'August', value: '08' },
  { label: 'September', value: '09' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
];

const inputClasses = cn(
  'h-9 rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
  'text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportShell({
  title,
  description,
  loading,
  onGenerate,
  children,
}: ReportShellProps): React.JSX.Element {
  const router = useRouter();
  const [fiscalYear, setFiscalYear] = useState(FISCAL_YEARS[0]!);
  const [period, setPeriod] = useState('full');

  const handleGenerate = useCallback(() => {
    onGenerate(fiscalYear, period);
  }, [fiscalYear, period, onGenerate]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/reports')} aria-label="Back to reports">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">{title}</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">{description}</p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Period selectors */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Fiscal Year
          </label>
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className={cn(inputClasses, 'w-28')}
          >
            {FISCAL_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={cn(inputClasses, 'w-40')}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <Button variant="primary" size="md" onClick={handleGenerate} loading={loading}>
          Generate
        </Button>
      </div>

      {/* Report content */}
      {loading ? (
        <SkeletonRow count={8} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
          {children}
        </div>
      )}
    </div>
  );
}
