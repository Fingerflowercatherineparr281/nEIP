'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useDebouncedValue } from '@/lib/hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandItem {
  id: string;
  label: string;
  category: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

// ---------------------------------------------------------------------------
// Static pages
// ---------------------------------------------------------------------------

const PAGE_COMMANDS: CommandItem[] = [
  { id: 'p-dashboard', label: 'Dashboard', category: 'Pages', href: '/', icon: LayoutDashboard },
  { id: 'p-approvals', label: 'Approval Queue', category: 'Pages', href: '/approvals', icon: ClipboardCheck },
  { id: 'p-invoices', label: 'Invoices', category: 'Pages', href: '/invoices', icon: FileText },
  { id: 'p-invoices-new', label: 'New Invoice', category: 'Pages', href: '/invoices/new', icon: FileText, keywords: ['create'] },
  { id: 'p-payments', label: 'Payments', category: 'Pages', href: '/payments', icon: CreditCard },
  { id: 'p-payments-new', label: 'Record Payment', category: 'Pages', href: '/payments/new', icon: CreditCard, keywords: ['create', 'new'] },
  { id: 'p-reports', label: 'Financial Reports', category: 'Pages', href: '/reports', icon: BarChart3 },
  { id: 'p-balance-sheet', label: 'Balance Sheet', category: 'Pages', href: '/reports/balance-sheet', icon: BarChart3 },
  { id: 'p-income-stmt', label: 'Income Statement', category: 'Pages', href: '/reports/income-statement', icon: BarChart3 },
  { id: 'p-trial-balance', label: 'Trial Balance', category: 'Pages', href: '/reports/trial-balance', icon: BarChart3 },
  { id: 'p-budget-var', label: 'Budget Variance', category: 'Pages', href: '/reports/budget-variance', icon: BarChart3 },
  { id: 'p-equity', label: 'Equity Changes', category: 'Pages', href: '/reports/equity-changes', icon: BarChart3 },
  { id: 'p-settings', label: 'Settings', category: 'Pages', href: '/settings', icon: Settings },
  { id: 'p-settings-org', label: 'Organization Settings', category: 'Pages', href: '/settings/organization', icon: Settings },
  { id: 'p-settings-team', label: 'Team Settings', category: 'Pages', href: '/settings/team', icon: Settings },
  { id: 'p-settings-ai', label: 'AI Configuration', category: 'Pages', href: '/settings/ai-config', icon: Settings },
  { id: 'p-settings-fiscal', label: 'Fiscal Year Settings', category: 'Pages', href: '/settings/fiscal', icon: Settings },
];

// ---------------------------------------------------------------------------
// Recent searches
// ---------------------------------------------------------------------------

const RECENT_KEY = 'neip-cmd-recent';
const MAX_RECENT = 5;

function getRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function addRecent(query: string): void {
  if (typeof window === 'undefined' || !query.trim()) return;
  try {
    const prev = getRecent().filter((q) => q !== query);
    const next = [query, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// CommandPalette Component
// ---------------------------------------------------------------------------

export function CommandPalette(): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 300);

  // Open/close with Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Small timeout to ensure the modal is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Filter results
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    return PAGE_COMMANDS.filter((cmd) => {
      if (cmd.label.toLowerCase().includes(q)) return true;
      if (cmd.category.toLowerCase().includes(q)) return true;
      if (cmd.keywords?.some((kw) => kw.includes(q))) return true;
      return false;
    });
  }, [debouncedQuery]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of results) {
      const existing = map.get(item.category);
      if (existing) {
        existing.push(item);
      } else {
        map.set(item.category, [item]);
      }
    }
    return map;
  }, [results]);

  // Flat list for keyboard navigation
  const flatResults = results;

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery]);

  // Navigate to selected item
  const navigateTo = useCallback(
    (item: CommandItem) => {
      addRecent(query);
      setOpen(false);
      router.push(item.href);
    },
    [query, router],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatResults[selectedIndex];
        if (item) navigateTo(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    },
    [flatResults, selectedIndex, navigateTo],
  );

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-cmd-item]');
    const item = items[selectedIndex];
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Recent searches
  const recentSearches = useMemo(() => {
    if (query.trim()) return [];
    return getRecent();
  }, [query, open]);

  if (!open) return <></>;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={cn(
          'relative z-50 mx-4 w-full max-w-lg overflow-hidden rounded-xl border border-[var(--color-border)]',
          'bg-[var(--color-card)] shadow-2xl',
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, documents..."
            className="flex-1 bg-transparent text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none"
            aria-label="Search commands"
            autoComplete="off"
          />
          <kbd className="hidden rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted-foreground)] sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2"
          role="listbox"
          aria-label="Command results"
        >
          {/* Recent searches (empty query state) */}
          {!query.trim() && recentSearches.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Recent Searches
              </div>
              {recentSearches.map((recent) => (
                <button
                  key={recent}
                  type="button"
                  onClick={() => setQuery(recent)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                    'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]',
                  )}
                >
                  <Search className="h-4 w-4 shrink-0" />
                  <span>{recent}</span>
                </button>
              ))}
            </div>
          )}

          {/* Empty search state */}
          {!query.trim() && recentSearches.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              Type to search pages, documents, and more...
            </div>
          )}

          {/* No results */}
          {query.trim() && flatResults.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Grouped results */}
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category} className="mb-2">
              <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                {category}
              </div>
              {items.map((item) => {
                const globalIdx = flatResults.indexOf(item);
                const isSelected = globalIdx === selectedIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-cmd-item=""
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => navigateTo(item)}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                      isSelected
                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                        : 'text-[var(--color-foreground)] hover:bg-[var(--color-accent)]',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {isSelected && (
                      <kbd className="rounded border border-current/20 px-1 py-0.5 text-[10px]">
                        Enter
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-2">
          <div className="flex gap-2 text-xs text-[var(--color-muted-foreground)]">
            <span><kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 text-[10px]">&#8593;&#8595;</kbd> Navigate</span>
            <span><kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 text-[10px]">Enter</kbd> Open</span>
            <span><kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 text-[10px]">Esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
