/**
 * Панель фильтров для дашборда
 * Период: 7/30/90 + произвольные даты
 * Маркетплейс: Все / WB / Ozon
 */
import { RefreshCw } from 'lucide-react';
import { useFiltersStore } from '../../store/useFiltersStore';
import { cn, getDateRangeFromPreset, getYesterdayYmd, normalizeDateRangeYmd } from '../../lib/utils';
import type { DateRangePreset, Marketplace } from '../../types';

interface FilterPanelProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const FilterPanel = ({ onRefresh, isRefreshing = false }: FilterPanelProps) => {
  const { datePreset, marketplace, customDateFrom, customDateTo, setDatePreset, setMarketplace, setCustomDates } = useFiltersStore();
  const effectiveRange = getDateRangeFromPreset(datePreset, customDateFrom, customDateTo);
  const yesterdayMax = getYesterdayYmd();

  const fromValue = datePreset === 'custom' ? (customDateFrom || '') : effectiveRange.from;
  const toValue = datePreset === 'custom' ? (customDateTo || '') : effectiveRange.to;

  const datePresets: { value: DateRangePreset; label: string }[] = [
    { value: '7d', label: '7 дней' },
    { value: '30d', label: '30 дней' },
    { value: '90d', label: '90 дней' },
  ];

  const marketplaces: { value: Marketplace; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'wb', label: 'WB' },
    { value: 'ozon', label: 'Ozon' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Период - кнопки */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Период:</span>
          <div className="flex gap-2">
            {datePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={cn(
                  'h-9 px-3 text-sm font-medium rounded-md transition-colors',
                  datePreset === preset.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Разделитель */}
        <div className="h-7 w-px bg-gray-200" />

        {/* Date Picker от/до */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromValue}
            max={yesterdayMax}
            onChange={(e) => {
              const nextFrom = e.target.value;
              if (!nextFrom) return;
              const baseTo = toValue || nextFrom;
              const normalized = normalizeDateRangeYmd(nextFrom, baseTo, { max: yesterdayMax });
              setCustomDates(normalized.from, normalized.to);
            }}
            className={cn(
              'h-9 px-3 text-sm border rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
              datePreset === 'custom' ? 'border-indigo-400' : 'border-gray-300'
            )}
          />
          <span className="text-sm text-gray-500">—</span>
          <input
            type="date"
            value={toValue}
            max={yesterdayMax}
            onChange={(e) => {
              const nextTo = e.target.value;
              if (!nextTo) return;
              const baseFrom = fromValue || nextTo;
              const normalized = normalizeDateRangeYmd(baseFrom, nextTo, { max: yesterdayMax });
              setCustomDates(normalized.from, normalized.to);
            }}
            className={cn(
              'h-9 px-3 text-sm border rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
              datePreset === 'custom' ? 'border-indigo-400' : 'border-gray-300'
            )}
          />
        </div>

        {/* Разделитель */}
        <div className="h-7 w-px bg-gray-200" />

        {/* Маркетплейс */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Маркетплейс:</span>
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value as Marketplace)}
            className="h-9 px-3 text-sm font-medium border border-gray-300 rounded-md bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {marketplaces.map((mp) => (
              <option key={mp.value} value={mp.value}>
                {mp.label}
              </option>
            ))}
          </select>
        </div>

        {/* Кнопка обновления */}
        {onRefresh && (
          <>
            <div className="h-7 w-px bg-gray-200" />
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={cn(
                'h-9 flex items-center gap-2 px-3 text-sm font-medium rounded-md transition-colors',
                isRefreshing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              )}
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              {isRefreshing ? 'Обновление...' : 'Обновить'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
