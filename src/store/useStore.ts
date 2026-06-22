import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Wallet } from '../lib/supabase';

export type ViewMode = 'buying' | 'selling';

interface StoreState {
  currentUser: User | null;
  wallet: Wallet | null;
  viewMode: ViewMode;
  setCurrentUser: (user: User | null) => void;
  setWallet: (wallet: Wallet | null) => void;
  toggleViewMode: () => void;
  setViewMode: (mode: ViewMode) => void;
  /** Resets every store slice to its initial state. Call this on logout. */
  clearAll: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      currentUser: null,
      wallet: null,
      viewMode: 'buying',
      setCurrentUser: (user) => set({ currentUser: user }),
      setWallet: (wallet) => set({ wallet }),
      toggleViewMode: () => set((state) => ({
        viewMode: state.viewMode === 'buying' ? 'selling' : 'buying'
      })),
      setViewMode: (mode) => set({ viewMode: mode }),
      clearAll: () => set({ currentUser: null, wallet: null, viewMode: 'buying' }),
    }),
    {
      name: 'skilldesks-store',
      // ONLY persist viewMode to prevent session data from bleeding across logins
      partialize: (state) => ({ viewMode: state.viewMode }),
    }
  )
);
