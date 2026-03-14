'use client';

import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar';
import { cn } from '@/lib/cn';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Skip to main content — a11y */}
      <a
        href="#main-content"
        className={cn(
          'fixed left-2 top-2 z-[100] -translate-y-16 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg',
          'transition-transform focus:translate-y-0',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        Skip to main content
      </a>

      {/* Desktop sidebar — hidden below lg (1024px) */}
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar />
      </div>

      {/* Main layout column */}
      <div
        className={cn(
          'flex flex-1 flex-col',
          // On mobile add padding at the bottom for the fixed bottom nav
          'pb-[calc(44px+env(safe-area-inset-bottom))] lg:pb-0',
        )}
      >
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto focus-visible:outline-none"
          aria-label="Main content"
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — hidden at md (768px) and above */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
