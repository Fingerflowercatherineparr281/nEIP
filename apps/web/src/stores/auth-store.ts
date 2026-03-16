'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearTokens } from '@/lib/api-client';

export type UserRole = 'owner' | 'admin' | 'accountant' | 'viewer';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgId: string;
  orgName: string;
  onboardingComplete?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  tenantId: string | null;
  _hydrated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  setTenantId: (tenantId: string) => void;
  setOnboardingComplete: () => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      tenantId: null,
      _hydrated: false,
      setAuth: (user: AuthUser, token: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('neip-auth-token', token);
        }
        set({ user, token, tenantId: user.orgId });
      },
      setTenantId: (tenantId: string) => {
        set({ tenantId });
      },
      setOnboardingComplete: () => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, onboardingComplete: true } });
        }
      },
      logout: () => {
        clearTokens();
        set({ user: null, token: null, tenantId: null });
      },
      isAuthenticated: () => {
        const { user, token } = get();
        return user !== null && token !== null;
      },
    }),
    {
      name: 'neip-auth',
      onRehydrateStorage: () => {
        return () => {
          useAuthStore.setState({ _hydrated: true } as Partial<AuthState>);
        };
      },
    },
  ),
);
