/**
 * Панель фильтров для дашборда
 * Период: 7/30/90 + произвольные даты через DateRangePicker
 * Маркетплейс: Все / WB / Ozon
 * Адаптивный: компактный вид на мобильных
 */
import { useFiltersStore } from '../../store/useFiltersStore';
import { cn, getDateRangeFromPreset, getMaxAvailableDateYmd, normalizeDateRangeYmd } from '../../lib/utils';
import { DateRangePicker } from './DateRangePicker';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { DateRangePreset, Marketplace } from '../../types';

export const FilterPanel = () => {
  const isMobile = useIsMobile();
  const { datePreset, marketplace, customDateFrom, customDateTo, setDatePreset, setMarketplace, setCustomDates } = useFiltersStore();
  // Максимальная дата: после 10:00 МСК = сегодня, до 10:00 = вчера
  const maxAvailableDate = getMaxAvailableDateYmd();
  const effectiveRange = getDateRangeFromPreset(datePreset, customDateFrom, customDateTo, maxAvailableDate);

  const datePresets: { value: DateRangePreset; label: string }[] = [
    { value: '7d', label: '7д' },
    { value: '30d', label: '30д' },
    { value: '90d', label: '90д' },
  ];

  const marketplaces: { value: Marketplace; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'wb', label: 'WB' },
    { value: 'ozon', label: 'Ozon' },
  ];

  // Handler for DateRangePicker
  const handleDateRangeChange = (from: string, to: string) => {
    const normalized = normalizeDateRangeYmd(from, to, { max: maxAvailableDate });
    setCustomDates(normalized.from, normalized.to);
  };

  // Mobile layout: 2 строки
  if (isMobile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4 sm:mb-5 lg:mb-6">
        {/* Первая строка: период */}
        <div className="flex items-center gap-1.5 mb-2.5">
          {datePresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setDatePreset(preset.value)}
              className={cn(
                'h-8 px-3 text-sm font-medium rounded-lg transition-all active:scale-95',
                datePreset === preset.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Вторая строка: календарь + маркетплейс */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <DateRangePicker
              from={effectiveRange.from}
              to={effectiveRange.to}
              maxDate={maxAvailableDate}
              onChange={handleDateRangeChange}
              isActive={datePreset === 'custom'}
            />
          </div>

          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value as Marketplace)}
            className="h-9 px-2.5 text-sm font-medium border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          >
            {marketplaces.map((mp) => (
              <option key={mp.value} value={mp.value}>
                {mp.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // Desktop layout: одна строка
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 mb-4 sm:mb-5 lg:mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Период - кнопки */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Период:</span>
          <div className="flex gap-1.5">
            {datePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={cn(
                  'h-9 px-3.5 text-sm font-medium rounded-lg transition-all',
                  datePreset === preset.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Разделитель */}
        <div className="h-8 w-px bg-gray-200" />

        {/* DateRangePicker */}
        <DateRangePicker
          from={effectiveRange.from}
          to={effectiveRange.to}
          maxDate={maxAvailableDate}
          onChange={handleDateRangeChange}
          isActive={datePreset === 'custom'}
        />

        {/* Разделитель */}
        <div className="h-8 w-px bg-gray-200" />

        {/* Маркетплейс */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">МП:</span>
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value as Marketplace)}
            className="h-9 px-3 text-sm font-medium border border-gray-300 rounded-lg bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          >
            {marketplaces.map((mp) => (
              <option key={mp.value} value={mp.value}>
                {mp.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
