import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Инициализирует auth: читает текущую сессию + слушает изменения.
 * Вызывать один раз в корне приложения (App.tsx).
 */
export function useAuth() {
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    // Получить текущую сессию при старте
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(session?.user ?? null, session);
    });

    // Слушать изменения (login/logout/token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session?.user ?? null, session);
    });

    return () => subscription.unsubscribe();
  }, [setAuth]);
}
