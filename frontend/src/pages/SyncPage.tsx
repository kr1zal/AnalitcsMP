/**
 * Страница синхронизации данных
 */
import { useState } from 'react';
import { syncApi } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../lib/utils';

export const SyncPage = () => {
  const [syncing, setSyncing] = useState<string | null>(null);

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: () => syncApi.getLogs(20),
    refetchInterval: 5000, // Обновляем каждые 5 секунд
  });

  const handleSync = async (type: string, label: string) => {
    setSyncing(type);
    try {
      switch (type) {
        case 'all':
          await syncApi.syncAll(30, false);
          break;
        case 'products':
          await syncApi.syncProducts();
          break;
        case 'sales':
          await syncApi.syncSales(30);
          break;
        case 'stocks':
          await syncApi.syncStocks();
          break;
        case 'costs':
          await syncApi.syncCosts(30);
          break;
        case 'ads':
          await syncApi.syncAds(30);
          break;
      }
      toast.success(`${label} завершена успешно!`);
      refetch();
    } catch (error) {
      toast.error(`Ошибка синхронизации: ${(error as Error).message}`);
    } finally {
      setSyncing(null);
    }
  };

  const syncButtons = [
    { type: 'all', label: 'Полная синхронизация', description: 'Обновить все данные (WB + Ozon)', color: 'indigo' },
    { type: 'products', label: 'Товары', description: 'Обновить список товаров', color: 'blue' },
    { type: 'sales', label: 'Продажи', description: 'Обновить данные продаж за 30 дней', color: 'green' },
    { type: 'stocks', label: 'Остатки', description: 'Обновить остатки на складах', color: 'purple' },
    { type: 'costs', label: 'Удержания', description: 'Обновить удержания МП за 30 дней', color: 'orange' },
    { type: 'ads', label: 'Реклама', description: 'Обновить рекламные расходы (WB Ads + Ozon Performance)', color: 'red' },
  ];

  const logs = logsData?.logs || [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Заголовок */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Синхронизация данных</h2>
        <p className="text-sm text-gray-600 mt-1">
          Обновление данных с Wildberries и Ozon
        </p>
      </div>

      {/* Кнопки синхронизации */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {syncButtons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => handleSync(btn.type, btn.label)}
            disabled={syncing !== null}
            className={`
              relative p-6 rounded-lg border-2 transition-all text-left
              ${syncing === btn.type ? 'border-' + btn.color + '-500 bg-' + btn.color + '-50' : 'border-gray-200 hover:border-' + btn.color + '-300 bg-white'}
              ${syncing !== null && syncing !== btn.type ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {btn.label}
                </h3>
                <p className="text-sm text-gray-600">
                  {btn.description}
                </p>
              </div>
              <RefreshCw
                className={`w-6 h-6 text-${btn.color}-600 ${
                  syncing === btn.type ? 'animate-spin' : ''
                }`}
              />
            </div>
          </button>
        ))}
      </div>

      {/* История синхронизации */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">История синхронизации</h3>
        </div>

        {isLoading ? (
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
