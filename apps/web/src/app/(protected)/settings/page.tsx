'use client';

import {
  Bot,
  Building2,
  Calendar,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingSection {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly: boolean;
}

const SECTIONS: SettingSection[] = [
  {
    title: 'Organization',
    description: 'Company profile, address, and tax ID',
    href: '/settings/organization',
    icon: Building2,
    ownerOnly: false,
  },
  {
    title: 'Team Members',
    description: 'Invite users, assign roles, manage access',
    href: '/settings/team',
    icon: Users,
    ownerOnly: true,
  },
  {
    title: 'AI Configuration',
    description: 'LLM API key, HITL confidence thresholds',
    href: '/settings/ai-config',
    icon: Bot,
    ownerOnly: true,
  },
  {
    title: 'Fiscal Year & Periods',
    description: 'Manage fiscal years and open/close periods',
    href: '/settings/fiscal',
    icon: Calendar,
    ownerOnly: true,
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  const visibleSections = SECTIONS.filter((s) => !s.ownerOnly || isOwner);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Settings</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Manage your organization, team, and system configuration
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visibleSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className={cn(
                'group flex items-start gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5',
                'transition-all hover:border-[var(--color-primary)] hover:shadow-md',
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-100)]">
                <Icon className="h-5 w-5 text-[var(--color-primary)]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-primary)]">
                  {section.title}
                </h2>
                <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                  {section.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
