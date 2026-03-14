'use client';

import {
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useSidebarStore } from '@/stores/sidebar-store';
import { TenantSwitcher } from '@/components/tenant-switcher';
import type { Organization } from '@/components/tenant-switcher';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Approvals', href: '/approvals', icon: ClipboardCheck, badge: 5 },
  { label: 'Invoices', href: '/invoices', icon: FileText },
  { label: 'Receipts', href: '/receipts', icon: Receipt },
  { label: 'Payments', href: '/payments', icon: CreditCard },
  { label: 'Contacts', href: '/contacts', icon: Users },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
];

const bottomNavItems: NavItem[] = [
  { label: 'AI Chat', href: '/ai-chat', icon: Bot },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  show: boolean;
}

function Tooltip({ label, children, show }: TooltipProps): React.JSX.Element {
  if (!show) {
    return <>{children}</>;
  }
  return (
    <div className="group/tooltip relative">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-100 opacity-0 shadow-lg transition-opacity group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
      >
        {label}
      </div>
    </div>
  );
}

interface NavLinkProps {
  item: NavItem;
  collapsed: boolean;
  onClick?: () => void;
}

function NavLink({ item, collapsed, onClick }: NavLinkProps): React.JSX.Element {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const Icon = item.icon;

  const linkProps = onClick !== undefined ? { onClick } : {};

  return (
    <Tooltip label={item.label} show={collapsed}>
      <Link
        href={item.href}
        {...linkProps}
        className={cn(
          'group flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
          isActive
            ? 'bg-slate-700 text-white'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white',
          collapsed && 'justify-center px-2',
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="relative flex shrink-0 items-center">
          <Icon className="h-5 w-5" aria-hidden="true" />
          {item.badge !== undefined && item.badge > 0 && (
            <span
              aria-label={`${item.badge} pending`}
              className={cn(
                'absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-semibold leading-none text-white',
                !collapsed && '-right-0.5 -top-0.5',
              )}
            >
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="flex-1 truncate">{item.label}</span>
        )}
        {!collapsed && item.badge !== undefined && item.badge > 0 && (
          <span
            aria-hidden="true"
            className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white"
          >
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </Link>
    </Tooltip>
  );
}

interface UserMenuProps {
  collapsed: boolean;
}

function UserMenu({ collapsed }: UserMenuProps): React.JSX.Element {
  return (
    <Tooltip label="Somchai Jaidee" show={collapsed}>
      <button
        type="button"
        className={cn(
          'group flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors',
          'hover:bg-slate-800 hover:text-white',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
          collapsed && 'justify-center px-2',
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
          SJ
        </span>
        {!collapsed && (
          <span className="flex-1 truncate text-left">
            <span className="block truncate text-sm font-medium text-white">
              Somchai Jaidee
            </span>
            <span className="block truncate text-xs text-slate-400">
              somchai@example.com
            </span>
          </span>
        )}
      </button>
    </Tooltip>
  );
}

// Placeholder org list — in production, fetched from API or JWT claims
const PLACEHOLDER_ORGS: Organization[] = [
  { id: 'org-1', name: 'Acme Corp', role: 'owner' },
];

export function Sidebar(): React.JSX.Element {
  const { collapsed, toggle } = useSidebarStore();

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'relative flex h-screen shrink-0 flex-col bg-slate-900 transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Top section — logo + tenant */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-3 border-b border-slate-800 px-4 py-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-white"
          aria-label="nEIP logo"
        >
          nE
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">nEIP</p>
            <p className="truncate text-xs text-slate-400">Acme Corp</p>
          </div>
        )}
      </div>

      {/* Tenant switcher — Story 12.3 */}
      <div className="shrink-0 border-b border-slate-800 px-2 py-2">
        <TenantSwitcher organizations={PLACEHOLDER_ORGS} collapsed={collapsed} />
      </div>

      {/* Main nav — scrollable */}
      <nav
        aria-label="Module navigation"
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3"
      >
        <ul role="list" className="flex flex-col gap-0.5">
          {mainNavItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section — AI Chat, Settings, User */}
      <div className="shrink-0 border-t border-slate-800 px-2 py-3">
        <ul role="list" className="flex flex-col gap-0.5">
          {bottomNavItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} collapsed={collapsed} />
            </li>
          ))}
          <li>
            <UserMenu collapsed={collapsed} />
          </li>
        </ul>
      </div>

      {/* Collapse toggle button */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        className={cn(
          'absolute -right-3 top-[4.5rem] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 shadow-md',
          'transition-colors hover:bg-slate-800 hover:text-white',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </aside>
  );
}
