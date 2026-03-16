'use client';

import { Bot, ClipboardCheck, LayoutDashboard, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

interface BottomNavTab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const tabs: BottomNavTab[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Approvals', href: '/approvals', icon: ClipboardCheck },
  { label: 'Import', href: '/import', icon: Bot },
  { label: 'More', href: '/settings', icon: MoreHorizontal },
];

export function BottomNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background safe-area-pb"
    >
      <ul
        role="list"
        className="mx-auto flex max-w-lg items-stretch"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <li key={tab.href} className="flex flex-1">
              <Link
                href={tab.href}
                className={cn(
                  'relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={
                  tab.badge !== undefined && tab.badge > 0
                    ? `${tab.label}, ${tab.badge} pending`
                    : tab.label
                }
              >
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold leading-none text-white"
                    >
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </span>
                <span aria-hidden="true">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
