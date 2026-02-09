/**
 * Страница синхронизации данных (Phase 4)
 * - Статус-панель с информацией о последнем и следующем sync
 * - Кнопка "Обновить сейчас" с дневным лимитом по тарифу
 * - История синхронизации (таблица логов)
 */
import { syncApi } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { useSyncStatus, useManualSync } from '../hooks/useSync';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { RefreshCw, CheckCircle, XCircle, Clock, Calendar, Zap, Lock } from 'lucide-react';
import { formatDate } from '../lib/utils';

/**
 * Форматирует "N минут назад" в человекочитаемый вид
 */
function formatTimeAgo(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return 'нет данных';
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}ч назад`;
  const days = Math.floor(hours / 24);
  return `${days}д назад`;
}

/**
 * Форматирует ISO дату в МСК время (HH:mm)
 */
function formatMskTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '—';
  try {
    const date = new Date(isoStr);
    // Добавляем 3 часа для МСК
    const msk = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return msk.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export const SyncPage = () => {
  const { data: syncStatus, isLoading: statusLoading } = useSyncStatus();
  const manualSync = useManualSync();

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: () => syncApi.getLogs(20),
    refetchInterval: 5000,
  });

  const logs = logsData?.logs || [];

  const canManualSync = syncStatus
    ? syncStatus.manual_sync_limit > 0 && syncStatus.manual_syncs_remaining > 0 && !syncStatus.is_syncing
    : false;

  const isFreePlan = syncStatus?.plan === 'free';

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Заголовок */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Синхронизация данных</h2>
        <p className="text-sm text-gray-600 mt-1">
          Автоматическое обновление данных с маркетплейсов
        </p>
      </div>

      {/* Статус-панель */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        {statusLoading ? (
          <LoadingSpinner text="Загрузка статуса..." />
        ) : syncStatus ? (
          <div className="space-y-4">
            {/* Тариф и интервал */}
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-indigo-500" />
              <span className="text-gray-600">Тариф:</span>
              <span className="font-semibold text-gray-900">{syncStatus.plan_name}</span>
              {syncStatus.sync_interval_hours ? (
                <span className="text-gray-500">
                  — обновление каждые {syncStatus.sync_interval_hours}ч
                </span>
              ) : (
                <span className="text-gray-500">— 2 раза в день</span>
              )}
            </div>

            {/* Последнее и следующее обновление */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500 uppercase font-medium">Последнее обновление</div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">
                    {syncStatus.last_sync_at
                      ? `${formatMskTime(syncStatus.last_sync_at)} (${formatTimeAgo(syncStatus.last_sync_ago_minutes)})`
                      : 'Ещё не было'
                    }
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500 uppercase font-medium">Следующее обновление</div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">
                    {syncStatus.next_sync_at
                      ? formatMskTime(syncStatus.next_sync_at)
                      : '—'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Индикатор текущей синхронизации */}
            {syncStatus.is_syncing && (
              <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                <span className="text-sm font-medium text-indigo-700">
                  Синхронизация выполняется...
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Не удалось загрузить статус</p>
        )}
      </div>

      {/* Ручное обновление */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ручное обновление</h3>

        {isFreePlan && syncStatus?.manual_sync_limit === 0 ? (
          /* Free-план: кнопка заблокирована */
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <Lock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">
                Ручное обновление доступно на тарифе Pro
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                На бесплатном тарифе данные обновляются автоматически 2 раза в день
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button
              onClick={() => manualSync.mutate()}
              disabled={!canManualSync || manualSync.isPending}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
                ${canManualSync && !manualSync.isPending
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <RefreshCw className={`w-4 h-4 ${manualSync.isPending ? 'animate-spin' : ''}`} />
              {manualSync.isPending ? 'Обновление...' : 'Обновить сейчас'}
            </button>

            <div className="text-sm text-gray-600">
              {syncStatus && syncStatus.manual_syncs_remaining > 0 ? (
                <span>
                  Осталось обновлений:{' '}
                  <span className="font-semibold text-gray-900">
                    {syncStatus.manual_syncs_remaining}
                  </span>
                  {' из '}
                  <span className="font-semibold text-gray-900">
                    {syncStatus.manual_sync_limit}
                  </span>
                  {' сегодня'}
                </span>
              ) : syncStatus && syncStatus.manual_sync_limit > 0 ? (
                <span className="text-amber-600">
                  Лимит исчерпан. Следующее обновление:{' '}
                  <span className="font-semibold">
                    {formatMskTime(syncStatus.next_sync_at)}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* История синхронизации */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">История синхронизации</h3>
        </div>

        {logsLoading ? (
          <LoadingSpinner text="Загрузка логов..." />
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p>Нет записей о синхронизации</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Тип
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Площадка
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Записей
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Время
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ошибка
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {log.status === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {log.sync_type}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {log.marketplace.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {log.records_count}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatDate(log.finished_at, 'dd.MM.yyyy HH:mm')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600">
                      {log.error_message || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
