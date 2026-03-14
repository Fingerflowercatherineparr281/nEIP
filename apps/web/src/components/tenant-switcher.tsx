'use client';

/**
 * TenantSwitcher — Dropdown for switching between user's organizations.
 *
 * Features:
 *   1. Shows all organizations the user has access to with role indicator
 *   2. Selecting an org switches tenant context in Zustand auth store
 *   3. TanStack Query cache is invalidated on switch (isolation per tenantId)
 *   4. Designed to integrate into the sidebar component
 *
 * Story: 12.3
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Organization {
  /** Organization (tenant) ID. */
  id: string;
  /** Display name. */
  name: string;
  /** User's role in this organization. */
  role: string;
}

interface TenantSwitcherProps {
  /** List of organizations the user can access. */
  organizations: ReadonlyArray<Organization>;
  /** Whether the sidebar is collapsed (icon-only mode). */
  collapsed?: boolean;
}

// ---------------------------------------------------------------------------
// Role badge colors
// ---------------------------------------------------------------------------

const roleBadgeStyles: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800',
  admin: 'bg-blue-100 text-blue-800',
  accountant: 'bg-green-100 text-green-800',
  viewer: 'bg-slate-100 text-slate-700',
};

function getRoleBadgeStyle(role: string): string {
  return roleBadgeStyles[role.toLowerCase()] ?? 'bg-slate-100 text-slate-700';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TenantSwitcher({
  organizations,
  collapsed = false,
}: TenantSwitcherProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const tenantId = useAuthStore((s) => s.tenantId);
  const setTenantId = useAuthStore((s) => s.setTenantId);

  const currentOrg = organizations.find((org) => org.id === tenantId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  function handleOrgSwitch(orgId: string): void {
    if (orgId === tenantId) {
      setIsOpen(false);
      return;
    }

    // Switch tenant context
    setTenantId(orgId);

    // Invalidate all TanStack Query caches to ensure data isolation
    // Each query key is prefixed with tenantId, but we clear everything
    // to be safe — stale data from the previous tenant must not leak.
    void queryClient.invalidateQueries();
    void queryClient.resetQueries();

    setIsOpen(false);
  }

  // Don't render if user has access to only one organization
  if (organizations.length <= 1) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2',
          collapsed && 'justify-center px-2',
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        {!collapsed && (
          <span className="truncate text-xs text-slate-400">
            {currentOrg?.name ?? 'No organization'}
          </span>
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current organization: ${currentOrg?.name ?? 'Select organization'}. Click to switch.`}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
          'hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
          collapsed && 'justify-center px-2',
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left text-xs text-slate-300">
              {currentOrg?.name ?? 'Select organization'}
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 shrink-0 text-slate-500 transition-transform',
                isOpen && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Select organization"
          className={cn(
            'absolute z-50 mt-1 w-64 overflow-hidden rounded-md border border-slate-700 bg-slate-800 shadow-xl',
            collapsed ? 'left-full top-0 ml-2' : 'bottom-full left-0 mb-1',
          )}
        >
          <div className="px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Organizations
            </p>
          </div>

          <ul className="max-h-60 overflow-y-auto py-1">
            {organizations.map((org) => {
              const isActive = org.id === tenantId;
              return (
                <li key={org.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleOrgSwitch(org.id)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                      'hover:bg-slate-700 focus-visible:bg-slate-700 focus-visible:outline-none',
                      isActive && 'bg-slate-700/50',
                    )}
                  >
                    <div className="flex flex-1 min-w-0 flex-col">
                      <span
                        className={cn(
                          'truncate font-medium',
                          isActive ? 'text-white' : 'text-slate-300',
                        )}
                      >
                        {org.name}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                          getRoleBadgeStyle(org.role),
                        )}
                      >
                        {org.role}
                      </span>
                    </div>

                    {isActive && (
                      <Check
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-label="Currently selected"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
