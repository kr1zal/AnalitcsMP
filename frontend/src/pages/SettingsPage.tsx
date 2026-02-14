import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, XCircle, AlertCircle, Loader2, Info, ArrowRight, Database, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { useTokensStatus, useValidateTokens, useSaveTokens, useSaveAndSync } from '../hooks/useTokens';
import { syncApi, accountApi } from '../services/api';
import { SubscriptionCard } from '../components/Settings/SubscriptionCard';

// ─── Подсказки где взять токены ───

const HINTS = {
  wb: {
    title: 'Где взять токен WB?',
    steps: [
      'Откройте seller.wildberries.ru',
      'Профиль → Настройки → Доступ к API',
      'Создайте новый ключ (права: Контент, Аналитика, Статистика, Продвижение)',
      'Скопируйте ключ — он показывается только один раз',
    ],
  },
  ozon: {
    title: 'Где взять ключи Ozon Seller?',
    steps: [
      'Откройте seller.ozon.ru',
      'Настройки → API ключи',
      'Создайте ключ типа «Admin» или с нужными правами',
      'Скопируйте Client-Id и Api-Key',
    ],
  },
  ozonPerf: {
    title: 'Где взять ключи Ozon Performance?',
    steps: [
      'Откройте performance.ozon.ru',
      'Приложения → Создать приложение',
      'Скопируйте Client ID и Client Secret',
    ],
  },
};

// ─── Компонент подсказки ───

function HintBlock({ hint }: { hint: { title: string; steps: string[] } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
        {hint.title}
      </button>
      {open && (
        <ol className="mt-1.5 ml-5 list-decimal text-xs text-gray-500 space-y-0.5">
          {hint.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── Компонент секретного поля ───

function SecretInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Бейдж статуса ───

function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3.5 h-3.5" /> Подключен
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      Не указан
    </span>
  );
}

// ─── Анимированный прогресс-бар ───

function SyncProgressBar({ startedAt }: { startedAt: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      // Логарифмическая кривая: быстро до ~60%, потом замедляется, макс 92%
      const p = Math.min(92, 15 * Math.log(elapsed / 10 + 1) + elapsed * 0.15);
      setProgress(Math.max(0, p));
    }, 500);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ─── Экран синхронизации ───

function SyncingScreen({ startedAt }: { startedAt: number }) {
  const [dots, setDots] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Пересчёт таймера каждую секунду
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="mb-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-indigo-100 rounded-2xl flex items-center justify-center">
          <Database className="w-8 h-8 text-indigo-600 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Загружаем ваши данные{dots}
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Собираем продажи, заказы, издержки и рекламу<br />
          с Wildberries и Ozon за последние 30 дней.
        </p>
      </div>

      <div className="mb-4">
        <SyncProgressBar startedAt={startedAt} />
      </div>

      <p className="text-xs text-gray-400">
        Прошло: {minutes > 0 ? `${minutes} мин ` : ''}{String(seconds).padStart(2, '0')} сек
      </p>

      <p className="mt-8 text-xs text-gray-400">
        Не закрывайте страницу — мы сообщим, когда всё будет готово
      </p>
    </div>
  );
}

// ─── Экран "Готово" ───

function SyncDoneScreen({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="mb-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-2xl flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Данные готовы!
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Мы загрузили ваши данные с маркетплейсов.<br />
          Дашборд, юнит-экономика и отчёты уже доступны.
        </p>
      </div>

      <button
        onClick={onNavigate}
        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
      >
        Перейти к отчётам
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Основная страница ───

type SyncPhase = 'form' | 'syncing' | 'done';

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isOnboarding = (location.state as any)?.onboarding === true;

  // Фаза: форма → синхронизация → готово
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('form');
  const [syncStartedAt, setSyncStartedAt] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Обработка возврата из ЮКассы (?payment=success / ?payment=fail)
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast.success('Оплата прошла! Тариф Pro активируется в течение минуты.');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      setSearchParams({}, { replace: true });
    } else if (paymentStatus === 'fail') {
      toast.error('Оплата не прошла. Попробуйте ещё раз.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: status, isLoading: statusLoading } = useTokensStatus();

  const validateMut = useValidateTokens();
  const saveMut = useSaveTokens();
  const saveAndSyncMut = useSaveAndSync();

  // Форма
  const [wbToken, setWbToken] = useState('');
  const [ozonClientId, setOzonClientId] = useState('');
  const [ozonApiKey, setOzonApiKey] = useState('');
  const [ozonPerfClientId, setOzonPerfClientId] = useState('');
  const [ozonPerfSecret, setOzonPerfSecret] = useState('');

  // Результаты валидации
  const [validation, setValidation] = useState<Record<string, { valid: boolean; error?: string }>>({});

  // Очищаем валидацию при изменении полей
  useEffect(() => setValidation({}), [wbToken, ozonClientId, ozonApiKey, ozonPerfClientId, ozonPerfSecret]);

  const hasAnyInput = !!(wbToken || ozonClientId || ozonApiKey || ozonPerfClientId || ozonPerfSecret);

  // ── Поллинг sync status ──
  const checkSyncStatus = useCallback(async () => {
    try {
      const syncStatus = await syncApi.getStatus();
      if (!syncStatus.is_syncing) {
        setSyncPhase('done');
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        queryClient.invalidateQueries({ queryKey: ['tokens'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['sync'] });
      }
    } catch {
      // Ошибка поллинга — продолжаем пробовать
    }
  }, [queryClient]);

  useEffect(() => {
    if (syncPhase === 'syncing') {
      // Первая проверка через 5 сек, потом каждые 5 сек
      const timeout = setTimeout(() => {
        checkSyncStatus();
        pollRef.current = setInterval(checkSyncStatus, 5000);
      }, 5000);
      return () => {
        clearTimeout(timeout);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }
  }, [syncPhase, checkSyncStatus]);

  // ── Проверка при загрузке — если sync уже идёт (F5 во время синхронизации) ──
  useEffect(() => {
    let cancelled = false;
    async function checkInitialSync() {
      try {
        const syncStatus = await syncApi.getStatus();
        if (!cancelled && syncStatus.is_syncing) {
          setSyncPhase('syncing');
          setSyncStartedAt(Date.now());
        }
      } catch {
        // ignore
      }
    }
    checkInitialSync();
    return () => { cancelled = true; };
  }, []);

  // ── Валидация ──
  const handleValidate = async (section: 'wb' | 'ozon' | 'ozonPerf') => {
    const input =
      section === 'wb'
        ? { wb_api_token: wbToken }
        : section === 'ozon'
          ? { ozon_client_id: ozonClientId, ozon_api_key: ozonApiKey }
          : { ozon_perf_client_id: ozonPerfClientId, ozon_perf_secret: ozonPerfSecret };

    try {
      const res = await validateMut.mutateAsync(input);
      const key = section === 'ozon' ? 'ozon_seller' : section === 'ozonPerf' ? 'ozon_perf' : 'wb';
      const r = res.results[key];
      setValidation((prev) => ({ ...prev, [section]: r || { valid: false, error: 'Нет ответа' } }));
      if (r?.valid) toast.success(`${section === 'wb' ? 'WB' : section === 'ozon' ? 'Ozon Seller' : 'Ozon Performance'} — токен валиден`);
      else toast.error(r?.error || 'Токен невалиден');
    } catch {
      toast.error('Ошибка проверки');
    }
  };

  // ── Сохранить ──
  const handleSave = async () => {
    try {
      await saveMut.mutateAsync({
        wb_api_token: wbToken || undefined,
        ozon_client_id: ozonClientId || undefined,
        ozon_api_key: ozonApiKey || undefined,
        ozon_perf_client_id: ozonPerfClientId || undefined,
        ozon_perf_secret: ozonPerfSecret || undefined,
      });
      toast.success('Токены сохранены');
    } catch {
      toast.error('Ошибка сохранения');
    }
  };

  // ── Сохранить + Синхронизировать ──
  const handleSaveAndSync = async () => {
    const tid = toast.loading('Сохраняю токены...');
    try {
      await saveAndSyncMut.mutateAsync({
        wb_api_token: wbToken || undefined,
        ozon_client_id: ozonClientId || undefined,
        ozon_api_key: ozonApiKey || undefined,
        ozon_perf_client_id: ozonPerfClientId || undefined,
        ozon_perf_secret: ozonPerfSecret || undefined,
      });
      toast.dismiss(tid);
      setSyncStartedAt(Date.now());
      setSyncPhase('syncing');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка сохранения', { id: tid });
    }
  };

  // ── Выход ──
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isBusy = saveMut.isPending || saveAndSyncMut.isPending || validateMut.isPending;

  // ── Рендер секции валидации ──
  const renderValidation = (section: string) => {
    const v = validation[section];
    if (!v) return null;
    return v.valid ? (
      <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
        <CheckCircle className="w-3.5 h-3.5" /> Токен валиден
      </div>
    ) : (
      <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
        <XCircle className="w-3.5 h-3.5" /> {v.error || 'Невалидный токен'}
      </div>
    );
  };

  // ── Фаза: Синхронизация ──
  if (syncPhase === 'syncing') {
    return <SyncingScreen startedAt={syncStartedAt} />;
  }

  // ── Фаза: Готово ──
  if (syncPhase === 'done') {
    return <SyncDoneScreen onNavigate={() => navigate('/', { replace: true })} />;
  }

  // ── Фаза: Форма ──
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Настройки</h1>

      {/* Onboarding banner */}
      {(isOnboarding || (!status?.has_wb && !status?.has_ozon_seller)) && (
        <div className="mb-6 flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-800">
            <p className="font-medium">Для начала работы введите API-токены</p>
            <p className="mt-1 text-indigo-600">
              Укажите токены маркетплейсов, проверьте их и нажмите «Сохранить и синхронизировать».
            </p>
          </div>
        </div>
      )}

      {/* Профиль */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Профиль</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-red-600 hover:text-red-800 transition-colors"
          >
            Выйти
          </button>
        </div>
      </div>

      {/* Тариф */}
      <div id="subscription" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Тариф</h2>
        <SubscriptionCard />
      </div>

      {/* WB */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Wildberries</h2>
          <StatusBadge connected={!!status?.has_wb} />
        </div>
        <div className="space-y-3">
          <SecretInput
            id="wb-token"
            label="API Token"
            value={wbToken}
            onChange={setWbToken}
            placeholder="eyJhbGciOi..."
          />
          {renderValidation('wb')}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleValidate('wb')}
              disabled={!wbToken || isBusy}
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {validateMut.isPending ? 'Проверяю...' : 'Проверить'}
            </button>
          </div>
          <HintBlock hint={HINTS.wb} />
        </div>
      </div>

      {/* Ozon Seller */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Ozon Seller</h2>
          <StatusBadge connected={!!status?.has_ozon_seller} />
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="ozon-cid" className="block text-sm font-medium text-gray-700 mb-1">
              Client ID
            </label>
            <input
              id="ozon-cid"
              type="text"
              value={ozonClientId}
              onChange={(e) => setOzonClientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="123456"
            />
          </div>
          <SecretInput
            id="ozon-key"
            label="API Key"
            value={ozonApiKey}
            onChange={setOzonApiKey}
            placeholder="5c1f44c2-63fd-..."
          />
          {renderValidation('ozon')}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleValidate('ozon')}
              disabled={!ozonClientId || !ozonApiKey || isBusy}
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {validateMut.isPending ? 'Проверяю...' : 'Проверить'}
            </button>
          </div>
          <HintBlock hint={HINTS.ozon} />
        </div>
      </div>

      {/* Ozon Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Ozon Performance</h2>
          <StatusBadge connected={!!status?.has_ozon_perf} />
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="ozon-perf-cid" className="block text-sm font-medium text-gray-700 mb-1">
              Client ID
            </label>
            <input
              id="ozon-perf-cid"
              type="text"
              value={ozonPerfClientId}
              onChange={(e) => setOzonPerfClientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="32445177-..."
            />
          </div>
          <SecretInput
            id="ozon-perf-secret"
            label="Client Secret"
            value={ozonPerfSecret}
            onChange={setOzonPerfSecret}
            placeholder="zOa0Kx2-Ef90..."
          />
          {renderValidation('ozonPerf')}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleValidate('ozonPerf')}
              disabled={!ozonPerfClientId || !ozonPerfSecret || isBusy}
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {validateMut.isPending ? 'Проверяю...' : 'Проверить'}
            </button>
          </div>
          <HintBlock hint={HINTS.ozonPerf} />
        </div>
      </div>

      {/* Кнопки */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleSave}
          disabled={!hasAnyInput || isBusy}
          className="flex-1 py-2.5 bg-white text-indigo-600 text-sm font-medium border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saveMut.isPending ? 'Сохраняю...' : 'Сохранить'}
        </button>
        <button
          onClick={handleSaveAndSync}
          disabled={!hasAnyInput || isBusy}
          className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {saveAndSyncMut.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Сохраняю...
            </>
          ) : (
            'Сохранить и синхронизировать'
          )}
        </button>
      </div>

      {/* Danger Zone — удаление аккаунта */}
      <DeleteAccountSection onDeleted={handleLogout} />
    </div>
  );
}

// ─── Секция удаления аккаунта ───

function DeleteAccountSection({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const canDelete = confirmText === 'УДАЛИТЬ';

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError('');
    try {
      await accountApi.deleteAccount();
      toast.success('Аккаунт удалён. Все данные стёрты.');
      onDeleted();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Ошибка удаления аккаунта');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-8 border border-red-200 rounded-xl p-5 bg-red-50/50">
      <div className="flex items-center gap-2 mb-2">
        <Trash2 className="w-4 h-4 text-red-600" />
        <h2 className="text-sm font-semibold text-red-900">Удаление аккаунта</h2>
      </div>
      <p className="text-xs text-red-700 mb-3">
        Все ваши данные, токены, подписка и история синхронизации будут удалены безвозвратно.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 text-xs font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
        >
          Удалить аккаунт
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border border-red-200 rounded-lg p-3">
            <p className="text-xs text-gray-700 mb-2">
              Для подтверждения введите <span className="font-mono font-bold text-red-600">УДАЛИТЬ</span>
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="УДАЛИТЬ"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmText(''); setError(''); }}
              className="flex-1 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="flex-1 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Удаляю...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" /> Удалить навсегда
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
