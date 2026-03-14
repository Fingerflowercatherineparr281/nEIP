'use client';

import { QueryProvider } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toast';
import { CommandPalette } from '@/components/command-palette';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps): React.JSX.Element {
  return (
    <QueryProvider>
      {children}
      <Toaster />
      <CommandPalette />
    </QueryProvider>
  );
}
