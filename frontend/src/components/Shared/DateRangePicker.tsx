/**
 * DateRangePicker — компонент выбора диапазона дат
 * Использует react-day-picker v9 с popover, debounce и русской локализацией
 * Адаптивный: 1 месяц на мобилах, 2 месяца на десктопе
 * Исправлено: навигация месяцев, выделение дат, dropdown для года
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { format, parse, subYears, startOfYear } from 'date-fns';
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
  debounceMs?: number;
  isActive?: boolean; // Выделение когда выбран custom режим
}

export const DateRangePicker = ({
  from,
  to,
  maxDate,
  onChange,
  debounceMs = 300,
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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced onChange
  const debouncedOnChange = useCallback(
    (range: DateRange | undefined) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (range?.from && range?.to) {
        debounceTimerRef.current = setTimeout(() => {
          const fromStr = format(range.from!, 'yyyy-MM-dd');
          const toStr = format(range.to!, 'yyyy-MM-dd');
          onChange(fromStr, toStr);
        }, debounceMs);
      }
    },
    [onChange, debounceMs]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSelect = (range: DateRange | undefined) => {
    setLocalRange(range);
    debouncedOnChange(range);

    // Auto-close when both dates selected
    if (range?.from && range?.to) {
      setTimeout(() => setIsOpen(false), 200);
    }
  };

  const maxDateObj = maxDate ? parse(maxDate, 'yyyy-MM-dd', new Date()) : undefined;
  const startMonth = startOfYear(subYears(new Date(), 2)); // 2 года назад
  const endMonth = maxDateObj || new Date();

  // Disable dates after maxDate
  const disabledMatcher = maxDateObj
    ? (date: Date) => date > maxDateObj
    : undefined;

  // Format display text
  const displayText = localRange?.from && localRange?.to
    ? `${format(localRange.from, 'd MMM', { locale: ru })} — ${format(localRange.to, 'd MMM yyyy', { locale: ru })}`
    : 'Выберите даты';

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'h-9 px-3 flex items-center gap-2 text-sm border rounded-lg bg-white transition-all duration-150',
          'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'active:scale-[0.98]',
          isActive ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-gray-300 text-gray-700',
          isOpen && 'ring-2 ring-indigo-500 border-transparent'
        )}
      >
        <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span className="whitespace-nowrap">{displayText}</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <>
          {/* Mobile: overlay backdrop */}
          {isMobile && (
            <div
              className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
          )}

          <div
            ref={popoverRef}
            className={cn(
              'bg-white rounded-xl shadow-2xl border border-gray-200',
              'animate-in fade-in-0 zoom-in-95 duration-150',
              isMobile
                ? 'fixed inset-x-3 top-[8vh] bottom-auto z-50 max-h-[84vh] overflow-y-auto'
                : 'absolute z-50 mt-2 left-0'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl z-10">
              <span className="text-sm font-medium text-gray-900">Выберите период</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar */}
            <div className="p-4 flex justify-center">
              <DayPicker
                mode="range"
                selected={localRange}
                onSelect={handleSelect}
                locale={ru}
                disabled={disabledMatcher}
                numberOfMonths={isMobile ? 1 : 2}
                showOutsideDays
                fixedWeeks
                weekStartsOn={1}
                captionLayout="dropdown"
                startMonth={startMonth}
                endMonth={endMonth}
                classNames={{
                  root: 'rdp-custom',
                  months: cn('flex', isMobile ? 'flex-col gap-4' : 'gap-8'),
                  month: 'space-y-3',
                  month_caption: 'flex justify-center items-center h-10 mb-1',
                  caption_label: 'text-sm font-semibold text-gray-900',
                  dropdowns: 'flex items-center gap-2',
                  dropdown: 'appearance-none bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors',
                  nav: 'flex items-center gap-1',
                  button_previous: 'p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
                  button_next: 'p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
                  chevron: 'w-4 h-4',
                  weekdays: 'flex',
                  weekday: 'text-gray-500 w-10 h-10 font-medium text-xs flex items-center justify-center',
                  week: 'flex',
                  day: 'text-center text-sm p-0 relative',
                  day_button: cn(
                    'w-10 h-10 font-normal rounded-lg transition-all duration-150',
                    'hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
                    'flex items-center justify-center'
                  ),
                  selected: 'bg-indigo-600 text-white hover:bg-indigo-600 rounded-lg',
                  today: 'font-bold text-indigo-600',
                  outside: 'text-gray-300 opacity-50',
                  disabled: 'text-gray-300 cursor-not-allowed hover:bg-transparent opacity-40',
                  range_middle: 'bg-indigo-50 text-gray-900 rounded-none',
                  range_start: 'bg-indigo-600 text-white rounded-l-lg rounded-r-none',
                  range_end: 'bg-indigo-600 text-white rounded-r-lg rounded-l-none',
                }}
              />
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {localRange?.from && !localRange?.to
                    ? 'Выберите конечную дату'
                    : 'Кликните начальную, затем конечную дату'}
                </span>
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 active:scale-[0.98] transition-all"
                  >
                    Готово
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
