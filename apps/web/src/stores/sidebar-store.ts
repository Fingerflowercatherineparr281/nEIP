'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  collapsed: boolean;
  openGroups: Record<string, boolean>;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleGroup: (groupId: string) => void;
  openGroup: (groupId: string) => void;
  setOpenGroups: (groups: Record<string, boolean>) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      openGroups: {},
      toggle: () => set((state) => ({ collapsed: !state.collapsed })),
      setCollapsed: (collapsed: boolean) => set({ collapsed }),
      toggleGroup: (groupId: string) =>
        set((state) => ({
          openGroups: {
            ...state.openGroups,
            [groupId]: !state.openGroups[groupId],
          },
        })),
      openGroup: (groupId: string) =>
        set((state) => ({
          openGroups: {
            ...state.openGroups,
            [groupId]: true,
          },
        })),
      setOpenGroups: (groups: Record<string, boolean>) =>
        set({ openGroups: groups }),
    }),
    {
      name: 'neip-sidebar-state',
      // Only persist collapsed and openGroups — actions are not serializable
      partialize: (state) => ({
        collapsed: state.collapsed,
        openGroups: state.openGroups,
      }),
    },
  ),
);
