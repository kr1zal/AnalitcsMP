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
    // Получить текущую сессию при старте.
    // Если токен протух — refreshSession его обновит.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Проверяем: если access_token скоро протухнет (< 60с), обновляем
        const expiresAt = session.expires_at ?? 0;
        const nowSec = Math.floor(Date.now() / 1000);
        if (expiresAt - nowSec < 60) {
          const { data } = await supabase.auth.refreshSession();
          setAuth(data.session?.user ?? null, data.session);
        } else {
          setAuth(session.user, session);
        }
      } else {
        setAuth(null, null);
      }
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
