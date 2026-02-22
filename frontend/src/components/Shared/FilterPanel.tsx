/**
 * Панель фильтров для дашборда
 * Период: 7/30/90 + произвольные даты через DateRangePicker
 * Маркетплейс: Все / WB / Ozon
 * Экспорт: Excel / PDF
 * Адаптивный: компактный вид на мобильных
 */
import { useFiltersStore } from '../../store/useFiltersStore';
import { useDashboardLayoutStore } from '../../store/useDashboardLayoutStore';
import { cn, getDateRangeFromPreset, getMaxAvailableDateYmd, normalizeDateRangeYmd } from '../../lib/utils';
import { DateRangePicker } from './DateRangePicker';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useFulfillmentInfo } from '../../hooks/useDashboard';
import { useFilterUrlSync } from '../../hooks/useFilterUrlSync';
import { FileSpreadsheet, FileText, Loader2, Settings2, Lock, LockOpen } from 'lucide-react';
import type { DateRangePreset, FulfillmentType, Marketplace } from '../../types';
import type { ExportType } from '../../hooks/useExport';

interface FilterPanelProps {
  /** Callback для экспорта в Excel */
  onExportExcel?: () => void;
  /** Callback для экспорта в PDF */
  onExportPdf?: () => void;
  /** Callback для открытия настроек виджетов */
  onWidgetSettings?: () => void;
  /** Идёт ли экспорт */
  isExporting?: boolean;
  /** Тип текущего экспорта */
  exportType?: ExportType;
}

export const FilterPanel = ({
  onExportExcel,
  onExportPdf,
  onWidgetSettings,
  isExporting = false,
  exportType = null,
}: FilterPanelProps) => {
  const isMobile = useIsMobile();
  const locked = useDashboardLayoutStore((s) => s.locked);
  const toggleLocked = useDashboardLayoutStore((s) => s.toggleLocked);
  useFilterUrlSync();
  const { datePreset, marketplace, fulfillmentType, customDateFrom, customDateTo, setDatePreset, setMarketplace, setFulfillmentType, setCustomDates } = useFiltersStore();
  const { data: fulfillmentInfo } = useFulfillmentInfo();
  const hasFbsData = fulfillmentInfo?.has_fbs_data ?? false;
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

  const fulfillmentOptions: { value: FulfillmentType; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'FBO', label: 'FBO' },
    { value: 'FBS', label: 'FBS' },
  ];

  // Handler for DateRangePicker
  const handleDateRangeChange = (from: string, to: string) => {
    const normalized = normalizeDateRangeYmd(from, to, { max: maxAvailableDate });
    setCustomDates(normalized.from, normalized.to);
  };

  // Mobile layout: 2 строки (Variant B — semantic grouping)
  // Row 1: фильтры (период + МП + FBO/FBS) — "какие данные показать"
  // Row 2: действия (календарь + экспорт + замочек + настройки) — "что с ними сделать"
  if (isMobile) {
    return (
      <div className="sticky top-0 z-30 bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4 sm:mb-5 lg:mb-6">
        {/* Row 1: Фильтры — период (left) + МП select + FBO/FBS pills (right) */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            {datePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={cn(
                  'h-8 px-2.5 text-sm font-medium rounded-lg transition-all active:scale-95',
                  datePreset === preset.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value as Marketplace)}
              className="h-7 px-1 text-xs font-medium border border-gray-300 rounded-md bg-white text-gray-700 shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {marketplaces.map((mp) => (
                <option key={mp.value} value={mp.value}>
                  {mp.label}
                </option>
              ))}
            </select>

            <div className="flex gap-px bg-gray-100 rounded-lg p-0.5">
              {fulfillmentOptions.map((ft) => {
                const disabled = ft.value === 'FBS' && !hasFbsData;
                return (
                  <button
                    key={ft.value}
                    onClick={() => !disabled && setFulfillmentType(ft.value)}
                    disabled={disabled}
                    title={disabled ? 'Нет FBS-данных' : undefined}
                    className={cn(
                      'h-7 px-2 text-xs font-medium rounded-md transition-all',
                      disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : fulfillmentType === ft.value
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-gray-500'
                    )}
                  >
                    {ft.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Действия — календарь (flex-1) + action icons */}
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0">
            <DateRangePicker
              from={effectiveRange.from}
              to={effectiveRange.to}
              maxDate={maxAvailableDate}
              onChange={handleDateRangeChange}
              isActive={datePreset === 'custom'}
            />
          </div>

          {/* Action icon group — export, lock, settings */}
          <div className="flex items-center gap-0.5 shrink-0">
            {onExportExcel && (
              <button
                onClick={onExportExcel}
                disabled={isExporting}
                aria-label="Экспорт в Excel"
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-lg transition-all active:scale-95',
                  isExporting && exportType === 'excel'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'text-emerald-600 hover:bg-emerald-50'
                )}
              >
                {isExporting && exportType === 'excel' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {onExportPdf && (
              <button
                onClick={onExportPdf}
                disabled={isExporting}
                aria-label="Экспорт в PDF"
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-lg transition-all active:scale-95',
                  isExporting && exportType === 'pdf'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'text-rose-600 hover:bg-rose-50'
                )}
              >
                {isExporting && exportType === 'pdf' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {onWidgetSettings && (
              <>
                <button
                  onClick={toggleLocked}
                  aria-label={locked ? 'Разблокировать карточки' : 'Зафиксировать карточки'}
                  aria-pressed={locked}
                  className={cn(
                    'flex items-center justify-center h-8 w-8 rounded-lg transition-all active:scale-95',
                    locked
                      ? 'text-indigo-600 bg-indigo-50'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {locked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={onWidgetSettings}
                  aria-label="Настройки виджетов"
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all active:scale-95"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout: одна строка
  return (
    <div className="sticky top-16 z-30 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 mb-4 sm:mb-5 lg:mb-6">
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

        {/* FBO/FBS pills */}
        <div className="h-8 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Тип:</span>
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {fulfillmentOptions.map((ft) => {
              const disabled = ft.value === 'FBS' && !hasFbsData;
              return (
                <button
                  key={ft.value}
                  onClick={() => !disabled && setFulfillmentType(ft.value)}
                  disabled={disabled}
                  title={disabled ? 'Нет FBS-данных' : undefined}
                  className={cn(
                    'h-8 px-3 text-sm font-medium rounded-md transition-all',
                    disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : fulfillmentType === ft.value
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {ft.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Разделитель + Кнопки экспорта */}
        {(onExportExcel || onExportPdf) && (
          <>
            <div className="h-8 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              {onExportExcel && (
                <button
                  onClick={onExportExcel}
                  disabled={isExporting}
                  title="Экспорт в Excel"
                  className={cn(
                    'flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg transition-all',
                    isExporting && exportType === 'excel'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  )}
                >
                  {isExporting && exportType === 'excel' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  <span>Excel</span>
                </button>
              )}
              {onExportPdf && (
                <button
                  onClick={onExportPdf}
                  disabled={isExporting}
                  title="Экспорт в PDF"
                  className={cn(
                    'flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg transition-all',
                    isExporting && exportType === 'pdf'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  )}
                >
                  {isExporting && exportType === 'pdf' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  <span>PDF</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Замочек + настройки виджетов */}
        {onWidgetSettings && (
          <>
            <div className="h-8 w-px bg-gray-200" />
            <button
              onClick={toggleLocked}
              title={locked ? 'Разблокировать карточки' : 'Зафиксировать карточки'}
              aria-label={locked ? 'Разблокировать карточки' : 'Зафиксировать карточки'}
              className={cn(
                'flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg transition-colors',
                locked
                  ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              )}
            >
              {locked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
            </button>
            <button
              onClick={onWidgetSettings}
              title="Настройки виджетов"
              aria-label="Настройки виджетов"
              className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              <span>Виджеты</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
