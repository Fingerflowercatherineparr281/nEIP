'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuthStore } from '@/stores/auth-store';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

export default function ProtectedLayout({
  children,
}: ProtectedLayoutProps): React.JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Give zustand persist time to rehydrate from localStorage
    // This runs once on mount — after 200ms, check auth state
    const timer = setTimeout(() => {
      const state = useAuthStore.getState();
      if (!state.user || !state.token) {
        // Check localStorage directly as final fallback
        const storedAuth = localStorage.getItem('neip-auth');
        if (storedAuth) {
          try {
            const parsed = JSON.parse(storedAuth);
            if (parsed?.state?.user && parsed?.state?.token) {
              // Manually restore state if persist middleware didn't fire
              useAuthStore.setState({
                user: parsed.state.user,
                token: parsed.state.token,
                tenantId: parsed.state.tenantId,
              });
              setReady(true);
              return;
            }
          } catch { /* ignore */ }
        }
        router.replace('/login');
      } else {
        setReady(true);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [router]);

  // Also react to store changes (e.g. if hydration completes after mount)
  useEffect(() => {
    if (user && token && !ready) {
      setReady(true);
    }
  }, [user, token, ready]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
