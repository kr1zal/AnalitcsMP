/**
 * ConnectionsTab — API tokens + sync status + manual sync + sync logs.
 * Combines content from old SettingsPage (token form) and SyncPage (sync status/logs).
 */
import { useState, useEffect } from 'react';
import {
  CheckCircle, XCircle, AlertCircle, Loader2, Info,
  RefreshCw, Clock, Calendar, Zap, Lock, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useTokensStatus, useValidateTokens, useSaveTokens, useSaveAndSync } from '../../hooks/useTokens';
import { useSyncStatus, useManualSync } from '../../hooks/useSync';
import { syncApi } from '../../services/api';
import { formatDate } from '../../lib/utils';
import { SecretInput } from './SecretInput';
import { StatusBadge } from './StatusBadge';

// ─── Token hints ───

const HINTS = {
  wb: {
    title: 'Где взять токен WB?',
    steps: [
      'Откройте seller.wildberries.ru',
      'Профиль \u2192 Настройки \u2192 Доступ к API',
      'Создайте новый ключ (права: Контент, Аналитика, Статистика, Продвижение)',
      'Скопируйте ключ \u2014 он показывается только один раз',
    ],
  },
  ozon: {
    title: 'Где взять ключи Ozon Seller?',
    steps: [
      'Откройте seller.ozon.ru',
      'Настройки \u2192 API ключи',
      'Создайте ключ типа \u00abAdmin\u00bb или с нужными правами',
      'Скопируйте Client-Id и Api-Key',
    ],
  },
  ozonPerf: {
    title: 'Где взять ключи Ozon Performance?',
    steps: [
      'Откройте performance.ozon.ru',
      'Приложения \u2192 Создать приложение',
      'Скопируйте Client ID и Client Secret',
    ],
  },
};

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

// ─── Time formatting helpers (from SyncPage) ───

function formatTimeAgo(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return 'нет данных';
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}ч назад`;
  const days = Math.floor(hours / 24);
  return `${days}д назад`;
}

function formatMskTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '\u2014';
  try {
    const date = new Date(isoStr);
    const msk = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return msk.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '\u2014';
  }
}

// ─── Main component ───

interface ConnectionsTabProps {
  isOnboarding: boolean;
  onStartSync: (startedAt: number) => void;
}

export function ConnectionsTab({ isOnboarding, onStartSync }: ConnectionsTabProps) {
  const { data: status, isLoading: statusLoading } = useTokensStatus();
  const validateMut = useValidateTokens();
  const saveMut = useSaveTokens();
  const saveAndSyncMut = useSaveAndSync();

  // Sync status & logs
  const { data: syncStatus, isLoading: syncStatusLoading } = useSyncStatus();
  const manualSync = useManualSync();
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: () => syncApi.getLogs(20),
    refetchInterval: 5000,
  });
  const logs = logsData?.logs || [];

  // Token form state
  const [wbToken, setWbToken] = useState('');
  const [ozonClientId, setOzonClientId] = useState('');
  const [ozonApiKey, setOzonApiKey] = useState('');
  const [ozonPerfClientId, setOzonPerfClientId] = useState('');
  const [ozonPerfSecret, setOzonPerfSecret] = useState('');

  const [validation, setValidation] = useState<Record<string, { valid: boolean; error?: string }>>({});
  const [logsOpen, setLogsOpen] = useState(false);

  // Clear validation on field change
  useEffect(() => setValidation({}), [wbToken, ozonClientId, ozonApiKey, ozonPerfClientId, ozonPerfSecret]);

  const hasAnyInput = !!(wbToken || ozonClientId || ozonApiKey || ozonPerfClientId || ozonPerfSecret);
  const isBusy = saveMut.isPending || saveAndSyncMut.isPending || validateMut.isPending;

  const canManualSync = syncStatus
    ? syncStatus.manual_sync_limit > 0 && syncStatus.manual_syncs_remaining > 0 && !syncStatus.is_syncing
    : false;
  const isFreePlan = syncStatus?.plan === 'free';

  // ── Validate section ──
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
      if (r?.valid) toast.success(`${section === 'wb' ? 'WB' : section === 'ozon' ? 'Ozon Seller' : 'Ozon Performance'} \u2014 токен валиден`);
      else toast.error(r?.error || 'Токен невалиден');
    } catch {
      toast.error('Ошибка проверки');
    }
  };

  // ── Save tokens ──
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

  // ── Save + Sync ──
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
      onStartSync(Date.now());
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка сохранения', { id: tid });
    }
  };

  // ── Validation result renderer ──
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

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Onboarding banner */}
      {(isOnboarding || (!status?.has_wb && !status?.has_ozon_seller)) && (
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-800">
            <p className="font-medium">Для начала работы введите API-токены</p>
            <p className="mt-1 text-indigo-600">
              Укажите токены маркетплейсов, проверьте их и нажмите &laquo;Сохранить и синхронизировать&raquo;.
            </p>
          </div>
        </div>
      )}

      {/* ═══ Marketplace cards ═══ */}

      {/* WB */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Wildberries</h3>
          <StatusBadge connected={!!status?.has_wb} />
        </div>
        <div className="space-y-3">
          <SecretInput id="wb-token" label="API Token" value={wbToken} onChange={setWbToken} placeholder="eyJhbGciOi..." />
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Ozon Seller</h3>
          <StatusBadge connected={!!status?.has_ozon_seller} />
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="ozon-cid" className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              id="ozon-cid"
              type="text"
              value={ozonClientId}
              onChange={(e) => setOzonClientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="123456"
            />
          </div>
          <SecretInput id="ozon-key" label="API Key" value={ozonApiKey} onChange={setOzonApiKey} placeholder="5c1f44c2-63fd-..." />
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Ozon Performance</h3>
          <StatusBadge connected={!!status?.has_ozon_perf} />
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="ozon-perf-cid" className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              id="ozon-perf-cid"
              type="text"
              value={ozonPerfClientId}
              onChange={(e) => setOzonPerfClientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="32445177-..."
            />
          </div>
          <SecretInput id="ozon-perf-secret" label="Client Secret" value={ozonPerfSecret} onChange={setOzonPerfSecret} placeholder="zOa0Kx2-Ef90..." />
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

      {/* ═══ Save buttons ═══ */}
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
            <><Loader2 className="w-4 h-4 animate-spin" /> Сохраняю...</>
          ) : (
            'Сохранить и синхронизировать'
          )}
        </button>
      </div>

      {/* ═══ Sync status ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Статус синхронизации</h3>

        {syncStatusLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : syncStatus ? (
          <div className="space-y-4">
            {/* Plan & interval */}
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-indigo-500" />
              <span className="text-gray-600">Тариф:</span>
              <span className="font-semibold text-gray-900">{syncStatus.plan_name}</span>
              {syncStatus.sync_interval_hours ? (
                <span className="text-gray-500">— обновление каждые {syncStatus.sync_interval_hours}ч</span>
              ) : (
                <span className="text-gray-500">— 2 раза в день</span>
              )}
            </div>

            {/* Last / Next sync */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500 uppercase font-medium">Последнее</div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">
                    {syncStatus.last_sync_at
                      ? `${formatMskTime(syncStatus.last_sync_at)} (${formatTimeAgo(syncStatus.last_sync_ago_minutes)})`
                      : 'Ещё не было'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500 uppercase font-medium">Следующее</div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">
                    {syncStatus.next_sync_at ? formatMskTime(syncStatus.next_sync_at) : '\u2014'}
                  </div>
                </div>
              </div>
            </div>

            {/* Currently syncing indicator */}
            {syncStatus.is_syncing && (
              <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                <span className="text-sm font-medium text-indigo-700">Синхронизация выполняется...</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Не удалось загрузить статус</p>
        )}
      </div>

      {/* ═══ Manual sync ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Ручное обновление</h3>

        {isFreePlan && syncStatus?.manual_sync_limit === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <Lock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Ручное обновление доступно на тарифе Pro</p>
              <p className="text-xs text-gray-500 mt-0.5">На бесплатном тарифе данные обновляются автоматически 2 раза в день</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button
              onClick={() => manualSync.mutate()}
              disabled={!canManualSync || manualSync.isPending}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                canManualSync && !manualSync.isPending
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${manualSync.isPending ? 'animate-spin' : ''}`} />
              {manualSync.isPending ? 'Обновление...' : 'Обновить сейчас'}
            </button>
            <div className="text-sm text-gray-600">
              {syncStatus && syncStatus.manual_syncs_remaining > 0 ? (
                <span>
                  Осталось: <span className="font-semibold text-gray-900">{syncStatus.manual_syncs_remaining}</span>
                  {' из '}<span className="font-semibold text-gray-900">{syncStatus.manual_sync_limit}</span> сегодня
                </span>
              ) : syncStatus && syncStatus.manual_sync_limit > 0 ? (
                <span className="text-amber-600">
                  Лимит исчерпан. Следующее: <span className="font-semibold">{formatMskTime(syncStatus.next_sync_at)}</span>
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Sync logs (collapsible) ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setLogsOpen(!logsOpen)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <span>История синхронизации</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${logsOpen ? 'rotate-180' : ''}`} />
        </button>

        {logsOpen && (
          <div className="border-t border-gray-200">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">Нет записей о синхронизации</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">МП</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Записей</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Время</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Ошибка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {log.status === 'success'
                            ? <CheckCircle className="w-4 h-4 text-green-600" />
                            : <XCircle className="w-4 h-4 text-red-600" />
                          }
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{log.sync_type}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                            {log.marketplace.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900">{log.records_count}</td>
                        <td className="px-4 py-3 text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(log.finished_at, 'dd.MM.yyyy HH:mm')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-red-600 text-xs">{log.error_message || '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
