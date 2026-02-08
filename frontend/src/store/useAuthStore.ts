import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  setAuth: (user: User | null, session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  setAuth: (user, session) => set({ user, session, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));
