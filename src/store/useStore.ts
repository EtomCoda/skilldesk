import { create } from 'zustand';
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
}

export const useStore = create<StoreState>((set) => ({
  currentUser: null,
  wallet: null,
  viewMode: 'buying',
  setCurrentUser: (user) => set({ currentUser: user }),
  setWallet: (wallet) => set({ wallet }),
  toggleViewMode: () => set((state) => ({
    viewMode: state.viewMode === 'buying' ? 'selling' : 'buying'
  })),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
