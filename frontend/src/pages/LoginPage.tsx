import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { BarChart3, Eye, EyeOff, ArrowLeft, Mail, CheckCircle } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot';

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const siteUrl = window.location.origin;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${siteUrl}/`,
          },
        });
        if (error) throw error;
        setEmailSent(true);
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}/reset-password`,
        });
        if (error) throw error;
        setEmailSent(true);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Синхронно обновляем auth store ДО навигации, иначе RootLayout
        // увидит user=null и покажет лендинг вместо дашборда (race condition).
        if (data.session) {
          useAuthStore.getState().setAuth(data.session.user, data.session);
        }
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      const msg = err.message || 'Ошибка авторизации';
      if (msg.includes('Invalid login credentials')) {
        setError('Неверный email или пароль');
      } else if (msg.includes('User already registered')) {
        setError('Пользователь с таким email уже зарегистрирован');
      } else if (msg.includes('Password should be at least')) {
        setError('Пароль должен содержать минимум 6 символов');
      } else if (msg.includes('Unable to validate email')) {
        setError('Некорректный email');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setEmailSent(false);
  };

  // Экран "Письмо отправлено"
  if (emailSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center mb-8">
            <BarChart3 className="w-10 h-10 text-indigo-600" />
            <span className="ml-3 text-2xl font-bold text-gray-900">RevioMP</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <Mail className="w-7 h-7 text-indigo-600" />
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {mode === 'signup' ? 'Подтвердите email' : 'Проверьте почту'}
            </h2>

            <p className="text-sm text-gray-500 mb-1">
              Мы отправили письмо на
            </p>
            <p className="text-sm font-medium text-gray-900 mb-4">
              {email}
            </p>

            {mode === 'signup' ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-left bg-indigo-50 rounded-lg p-3">
                  <CheckCircle className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-indigo-700">
                    Перейдите по ссылке в письме, чтобы активировать аккаунт. После этого вы получите бесплатный доступ к аналитике.
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  Не нашли письмо? Проверьте папку «Спам»
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Перейдите по ссылке в письме, чтобы задать новый пароль.
                </p>
                <p className="text-xs text-gray-400">
                  Ссылка действительна 24 часа. Не нашли письмо? Проверьте «Спам».
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Вернуться ко входу
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <BarChart3 className="w-10 h-10 text-indigo-600" />
          <span className="ml-3 text-2xl font-bold text-gray-900">RevioMP</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1 text-center">
            {mode === 'login' && 'Вход в аккаунт'}
            {mode === 'signup' && 'Регистрация'}
            {mode === 'forgot' && 'Восстановление пароля'}
          </h2>

          {mode === 'forgot' && (
            <p className="text-xs text-gray-500 text-center mb-4">
              Укажите email, и мы отправим ссылку для сброса пароля
            </p>
          )}

          {mode !== 'forgot' && <div className="mb-6" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Пароль
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Забыли пароль?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Минимум 6 символов"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? 'Загрузка...'
                : mode === 'login'
                  ? 'Войти'
                  : mode === 'signup'
                    ? 'Зарегистрироваться'
                    : 'Отправить ссылку'}
            </button>
          </form>

          <div className="mt-4 text-center space-y-2">
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Нет аккаунта? Зарегистрироваться
              </button>
            )}
            {mode === 'signup' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Уже есть аккаунт? Войти
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Вернуться ко входу
              </button>
            )}
          </div>
        </div>

        {/* Legal links */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Регистрируясь, вы соглашаетесь с{' '}
            <Link to="/legal" className="text-indigo-500 hover:text-indigo-700 underline">
              условиями использования
            </Link>
            {' '}и{' '}
            <Link to="/policy" className="text-indigo-500 hover:text-indigo-700 underline">
              политикой конфиденциальности
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
