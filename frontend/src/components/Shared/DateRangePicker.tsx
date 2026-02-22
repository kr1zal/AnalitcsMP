/**
 * DateRangePicker — компактный компонент выбора диапазона дат
 * Использует react-day-picker v9 с popover и русской локализацией
 * Адаптивный: 1 месяц на мобилах, 2 месяца на десктопе
 *
 * Улучшения v3 (30.01.2026):
 * - Исправлен баг синхронизации года между месяцами (убран dropdown)
 * - Компактный размер: ячейки 32px desktop / 34px mobile
 * - Минимальные отступы для экономии места
 * - Пресеты в одну строку
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { format, parse, subYears, subDays, startOfMonth, startOfYear } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useMediaQuery';

import 'react-day-picker/style.css';

interface DateRangePickerProps {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  onChange: (from: string, to: string) => void;
  isActive?: boolean; // Выделение когда выбран custom режим
}

// Пресеты быстрого выбора
interface QuickPreset {
  label: string;
  getRange: (today: Date) => { from: Date; to: Date };
}

const quickPresets: QuickPreset[] = [
  { label: 'Сегодня', getRange: (today) => ({ from: today, to: today }) },
  { label: 'Вчера', getRange: (today) => ({ from: subDays(today, 1), to: subDays(today, 1) }) },
  { label: '7д', getRange: (today) => ({ from: subDays(today, 6), to: today }) },
  { label: '30д', getRange: (today) => ({ from: subDays(today, 29), to: today }) },
  { label: 'Месяц', getRange: (today) => ({ from: startOfMonth(today), to: today }) },
];

export const DateRangePicker = ({
  from,
  to,
  maxDate,
  onChange,
  isActive = false,
}: DateRangePickerProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [localRange, setLocalRange] = useState<DateRange | undefined>(() => {
    const fromDate = from ? parse(from, 'yyyy-MM-dd', new Date()) : undefined;
    const toDate = to ? parse(to, 'yyyy-MM-dd', new Date()) : undefined;
    return fromDate && toDate ? { from: fromDate, to: toDate } : undefined;
  });

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Вычисляем maxDateObj один раз
  const maxDateObj = useMemo(
    () => (maxDate ? parse(maxDate, 'yyyy-MM-dd', new Date()) : new Date()),
    [maxDate]
  );

  const startMonth = useMemo(() => startOfYear(subYears(new Date(), 2)), []);
  const endMonth = maxDateObj;

  // Sync localRange when props change
  useEffect(() => {
    const fromDate = from ? parse(from, 'yyyy-MM-dd', new Date()) : undefined;
    const toDate = to ? parse(to, 'yyyy-MM-dd', new Date()) : undefined;
    setLocalRange(fromDate && toDate ? { from: fromDate, to: toDate } : undefined);
  }, [from, to]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleSelect = (range: DateRange | undefined) => {
    setLocalRange(range);
  };

  // Применить выбранный диапазон
  const handleApply = useCallback(() => {
    if (localRange?.from && localRange?.to) {
      const fromStr = format(localRange.from, 'yyyy-MM-dd');
      const toStr = format(localRange.to, 'yyyy-MM-dd');
      onChange(fromStr, toStr);
    }
    setIsOpen(false);
  }, [localRange, onChange]);

  // Применить пресет
  const handlePreset = useCallback(
    (preset: QuickPreset) => {
      const today = maxDateObj;
      const range = preset.getRange(today);
      const clampedTo = range.to > maxDateObj ? maxDateObj : range.to;
      const clampedFrom = range.from > maxDateObj ? maxDateObj : range.from;
      setLocalRange({ from: clampedFrom, to: clampedTo });
    },
    [maxDateObj]
  );

  // Disable dates after maxDate
  const disabledMatcher = useCallback(
    (date: Date) => date > maxDateObj,
    [maxDateObj]
  );

  // Проверка, выбран ли полный диапазон
  const isRangeComplete = Boolean(localRange?.from && localRange?.to);

  // Format display text — компактный формат
  const displayText = useMemo(() => {
    if (!localRange?.from || !localRange?.to) return 'Период';
    const fromYear = localRange.from.getFullYear();
    const toYear = localRange.to.getFullYear();
    const currentYear = new Date().getFullYear();

    if (fromYear === toYear && fromYear === currentYear) {
      return `${format(localRange.from, 'd MMM', { locale: ru })} – ${format(localRange.to, 'd MMM', { locale: ru })}`;
    }
    return `${format(localRange.from, 'd.MM.yy')} – ${format(localRange.to, 'd.MM.yy')}`;
  }, [localRange]);

  // Подсказка в footer
  const footerHint = useMemo(() => {
    if (!localRange?.from) return 'Выберите начало';
    if (!localRange?.to) return 'Выберите конец';
    const days = Math.ceil((localRange.to.getTime() - localRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`;
  }, [localRange]);

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Выбрать период"
        aria-expanded={isOpen}
        className={cn(
          'h-8 sm:h-9 px-2.5 sm:px-3 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm border rounded-lg bg-white transition-all duration-150',
          'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'active:scale-[0.98]',
          isActive ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-gray-300 text-gray-700',
          isOpen && 'ring-2 ring-indigo-500 border-transparent'
        )}
      >
        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
        <span className="whitespace-nowrap">{displayText}</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <>
          {/* Overlay backdrop */}
          <div
            className={cn(
              'fixed inset-0 z-40',
              isMobile ? 'bg-black/30 backdrop-blur-sm' : 'bg-transparent'
            )}
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label="Выбор периода"
            className={cn(
              'bg-white rounded-xl shadow-2xl border border-gray-200 z-50',
              'animate-in fade-in-0 zoom-in-95 duration-150',
              isMobile
                ? 'fixed inset-x-4 top-[15vh] bottom-auto max-h-[70vh] overflow-y-auto'
                : 'absolute mt-2 left-0'
            )}
          >
            {/* Header + Presets — объединённая строка */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
              <div className="flex flex-wrap gap-1">
                {quickPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePreset(preset)}
                    className={cn(
                      'px-2 py-0.5 text-[11px] font-medium rounded transition-all',
                      'hover:bg-indigo-100 hover:text-indigo-700',
                      'bg-white border border-gray-200 text-gray-600'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                aria-label="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Calendar — компактный */}
            <div className="p-2 sm:p-3 flex justify-center">
              <DayPicker
                mode="range"
                selected={localRange}
                onSelect={handleSelect}
                locale={ru}
                disabled={disabledMatcher}
                numberOfMonths={isMobile ? 1 : 2}
                showOutsideDays={false}
                fixedWeeks={false}
                weekStartsOn={1}
                captionLayout="label"
                startMonth={startMonth}
                endMonth={endMonth}
                classNames={{
                  root: 'rdp-compact',
                  months: cn('flex', isMobile ? 'flex-col gap-2' : 'gap-4'),
                  month: 'space-y-1',
                  month_caption: 'flex justify-center items-center h-7 mb-0.5',
                  caption_label: 'text-xs font-semibold text-gray-800 capitalize',
                  nav: 'flex items-center justify-between absolute inset-x-0 top-0 px-1',
                  button_previous: cn(
                    'w-7 h-7 flex items-center justify-center',
                    'rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900',
                    'transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
                  ),
                  button_next: cn(
                    'w-7 h-7 flex items-center justify-center',
                    'rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900',
                    'transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
                  ),
                  chevron: 'w-4 h-4',
                  weekdays: 'flex',
                  weekday: 'text-gray-400 w-8 h-6 font-medium text-[10px] flex items-center justify-center uppercase',
                  week: 'flex',
                  day: 'text-center text-xs p-0 relative',
                  day_button: cn(
                    'w-8 h-8 text-xs font-normal transition-all duration-75',
                    'hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-inset',
                    'flex items-center justify-center rounded'
                  ),
                  selected: 'bg-indigo-600 text-white hover:bg-indigo-600',
                  today: 'font-bold text-indigo-600',
                  outside: 'text-gray-300 opacity-50',
                  disabled: 'text-gray-300 cursor-not-allowed hover:bg-transparent opacity-40',
                  range_middle: 'bg-indigo-50 text-indigo-900 rounded-none hover:bg-indigo-100',
                  range_start: 'bg-indigo-600 text-white rounded-l rounded-r-none hover:bg-indigo-700',
                  range_end: 'bg-indigo-600 text-white rounded-r rounded-l-none hover:bg-indigo-700',
                }}
              />
            </div>

            {/* Footer — компактный */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
              <span className="text-[11px] text-gray-500">{footerHint}</span>
              <button
                type="button"
                onClick={handleApply}
                disabled={!isRangeComplete}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                  isRangeComplete
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                OK
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
