'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Download, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportType = 'journal_entries' | 'chart_of_accounts' | 'contacts';

type ImportPhase =
  | 'upload'
  | 'preview'
  | 'importing'
  | 'complete';

interface PreviewData {
  headers: string[];
  columnMapping: Record<string, string>;
  previewRows: Record<string, unknown>[];
  totalRows: number;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResultData {
  imported: number;
  failed: number;
  total: number;
  errors: ImportError[];
}

interface ImportHistoryEntry {
  jobId: string;
  importType: ImportType;
  state: string;
  imported: number;
  failed: number;
  total: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  journal_entries: 'Journal Entries',
  chart_of_accounts: 'Chart of Accounts',
  contacts: 'Contacts',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportPage(): React.JSX.Element {
  const [phase, setPhase] = useState<ImportPhase>('upload');
  const [importType, setImportType] = useState<ImportType>('journal_entries');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ImportResultData | null>(null);
  const [history, setHistory] = useState<ImportHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const validateFile = useCallback((file: File): boolean => {
    const validTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!validTypes.includes(file.type) && ext !== 'csv' && ext !== 'xlsx') {
      setError('Please upload a CSV or XLSX file.');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10 MB.');
      return false;
    }

    setError(null);
    return true;
  }, []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!validateFile(file)) return;

      setSelectedFile(file);
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('importType', importType);

        const response = await fetch(`/api/v1/import/preview`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({ detail: 'Preview failed' })) as { detail?: string };
          throw new Error(errBody.detail ?? 'Failed to preview file');
        }

        const previewData = await response.json() as PreviewData;
        setPreview(previewData);
        setPhase('preview');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to preview file');
      } finally {
        setIsLoading(false);
      }
    },
    [importType, validateFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        void handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  // -------------------------------------------------------------------------
  // Import execution
  // -------------------------------------------------------------------------

  const startImport = useCallback(async () => {
    if (!selectedFile) return;

    setPhase('importing');
    setIsLoading(true);
    setError(null);
    setProgress({ current: 0, total: preview?.totalRows ?? 0 });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('importType', importType);

      const response = await fetch('/api/v1/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ detail: 'Import failed' })) as { detail?: string };
        throw new Error(errBody.detail ?? 'Failed to start import');
      }

      const { jobId } = await response.json() as { jobId: string };

      // Poll for progress
      let completed = false;
      while (!completed) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await fetch(`/api/v1/import/${jobId}`);
        if (!statusResponse.ok) continue;

        const status = await statusResponse.json() as {
          state: string;
          progress?: ImportResultData;
        };

        if (status.progress) {
          setProgress({
            current: status.progress.imported + status.progress.failed,
            total: status.progress.total,
          });
        }

        if (status.state === 'completed' || status.state === 'failed') {
          completed = true;
          if (status.progress) {
            setResult(status.progress);
          }
          setPhase('complete');

          // Add to history
          setHistory((prev) => [
            {
              jobId,
              importType,
              state: status.state,
              imported: status.progress?.imported ?? 0,
              failed: status.progress?.failed ?? 0,
              total: status.progress?.total ?? 0,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setPhase('complete');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, importType, preview]);

  // -------------------------------------------------------------------------
  // Error report download
  // -------------------------------------------------------------------------

  const downloadErrorReport = useCallback(() => {
    if (!result?.errors.length) return;

    const csv = [
      'Row,Field,Error',
      ...result.errors.map(
        (e) =>
          `${e.row},"${e.field.replace(/"/g, '""')}","${e.message.replace(/"/g, '""')}"`,
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_errors_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  const resetImport = useCallback(() => {
    setPhase('upload');
    setSelectedFile(null);
    setPreview(null);
    setProgress({ current: 0, total: 0 });
    setResult(null);
    setError(null);
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
          Import Data
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Upload CSV or Excel files to import data into your organisation.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Phase: Upload */}
      {phase === 'upload' && (
        <div className="space-y-6">
          {/* Import type selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-foreground)]">
              Import Type
            </label>
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as ImportType)}
              className="w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm"
            >
              {Object.entries(IMPORT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors',
              isDragOver
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-muted)] hover:border-[var(--color-primary)]/50',
            )}
          >
            <Upload className="mx-auto h-12 w-12 text-[var(--color-muted-foreground)]" />
            <p className="mt-4 text-sm font-medium text-[var(--color-foreground)]">
              Drag and drop your file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Supports CSV and XLSX files up to 10 MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Phase: Preview */}
      {phase === 'preview' && preview && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-[var(--color-primary)]" />
            <div>
              <p className="font-medium text-[var(--color-foreground)]">
                {selectedFile?.name}
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {preview.totalRows} rows detected
              </p>
            </div>
          </div>

          {/* Column mapping */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-[var(--color-foreground)]">
              Column Mapping
            </h3>
            <div className="rounded-lg border border-[var(--color-muted)] divide-y divide-[var(--color-muted)]">
              {preview.headers.map((header) => (
                <div
                  key={header}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="text-[var(--color-muted-foreground)]">
                    {header}
                  </span>
                  <span className="font-medium text-[var(--color-foreground)]">
                    {preview.columnMapping[header] ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        {preview.columnMapping[header]}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[var(--color-muted-foreground)]">
                        <XCircle className="h-3.5 w-3.5" />
                        Not mapped
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview table */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-[var(--color-foreground)]">
              Preview (first {Math.min(5, preview.previewRows.length)} rows)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-[var(--color-muted)]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-muted)] bg-[var(--color-muted)]/50">
                    {Object.values(preview.columnMapping).map((field) => (
                      <th
                        key={field}
                        className="px-4 py-2 text-left font-medium text-[var(--color-foreground)]"
                      >
                        {field}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[var(--color-muted)] last:border-0"
                    >
                      {Object.values(preview.columnMapping).map((field) => (
                        <td
                          key={field}
                          className="px-4 py-2 text-[var(--color-foreground)]"
                        >
                          {String(row[field] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetImport}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void startImport()} loading={isLoading}>
              Start Import
            </Button>
          </div>
        </div>
      )}

      {/* Phase: Importing */}
      {phase === 'importing' && (
        <div className="space-y-4">
          <ProgressBar
            value={progress.current}
            max={progress.total || 100}
            label={`Importing... ${progress.current}/${progress.total} rows`}
            showValue
          />
        </div>
      )}

      {/* Phase: Complete */}
      {phase === 'complete' && result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-lg border border-[var(--color-muted)] p-6">
            <h3 className="text-lg font-semibold text-[var(--color-foreground)]">
              Import Complete
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Imported</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--color-foreground)]">
                  {result.total}
                </p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Total</p>
              </div>
            </div>
          </div>

          {/* Error table */}
          {result.errors.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-[var(--color-foreground)]">
                  Errors ({result.errors.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadErrorReport}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Error Report
                </Button>
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-[var(--color-muted)]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-muted)] bg-[var(--color-muted)]/50">
                      <th className="px-4 py-2 text-left font-medium">Row</th>
                      <th className="px-4 py-2 text-left font-medium">Field</th>
                      <th className="px-4 py-2 text-left font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.slice(0, 50).map((err, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-[var(--color-muted)] last:border-0"
                      >
                        <td className="px-4 py-2 font-mono text-xs">{err.row}</td>
                        <td className="px-4 py-2">{err.field || '-'}</td>
                        <td className="px-4 py-2 text-red-600">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button variant="primary" onClick={resetImport}>
            Import Another File
          </Button>
        </div>
      )}

      {/* Phase: Complete with no result (error only) */}
      {phase === 'complete' && !result && (
        <div className="space-y-4">
          <EmptyState
            icon={XCircle}
            message="Import failed"
            description={error ?? 'An unexpected error occurred during import.'}
            ctaLabel="Try Again"
            onCtaClick={resetImport}
          />
        </div>
      )}

      {/* Import History */}
      {history.length > 0 && (
        <div className="border-t border-[var(--color-muted)] pt-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-[var(--color-foreground)]">
            <History className="h-4 w-4" />
            Recent Imports
          </h3>
          <div className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.jobId}
                className="flex items-center justify-between rounded-lg border border-[var(--color-muted)] px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-medium">
                    {IMPORT_TYPE_LABELS[entry.importType]}
                  </span>
                  <span className="mx-2 text-[var(--color-muted-foreground)]">
                    {new Date(entry.createdAt).toLocaleString('th-TH')}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-green-600">{entry.imported} imported</span>
                  {entry.failed > 0 && (
                    <span className="text-red-600">{entry.failed} failed</span>
                  )}
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-medium',
                      entry.state === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700',
                    )}
                  >
                    {entry.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
