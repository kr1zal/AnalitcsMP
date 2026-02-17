/**
 * Enterprise SummaryCard — карточка метрики дашборда
 *
 * Дизайн:
 * ┌─────────────────────────────────┐
 * │ [icon]  Title           ? badge │
 * │                                 │
 * │  19 502 ₽                       │
 * │  245 шт · выкуп 81%            │
 * │                                 │
 * │  ком. 4 200, лог. 3 100        │
 * └─────────────────────────────────┘
 *
 * - Цветной icon с bg-circle
 * - Крупное основное значение
 * - Опциональное вторичное значение (secondaryValue)
 * - Change badge (+12% / -5%) в правом верхнем углу
 * - Warning badge (⚠️) при наличии
 */
import { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { HelpCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn, formatNumber, formatPercent } from '../../lib/utils';

// ── Цветовые схемы для иконок ──
export type CardAccent =
  | 'indigo'   // дефолт
  | 'emerald'  // положительные метрики (выкупы, прибыль)
  | 'amber'    // предупреждения (себестоимость)
  | 'red'      // отрицательные (убыток)
  | 'sky'      // нейтральные (перечисления)
  | 'violet'   // реклама
  | 'slate';   // расходы

const accentStyles: Record<CardAccent, { bg: string; text: string; ring: string }> = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  ring: 'ring-indigo-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-100' },
  red:     { bg: 'bg-red-50',     text: 'text-red-600',     ring: 'ring-red-100' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-600',     ring: 'ring-sky-100' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-100' },
  slate:   { bg: 'bg-gray-100',   text: 'text-gray-600',    ring: 'ring-gray-200' },
};

interface SummaryCardProps {
  title: string;
  mobileTitle?: string;
  value: number | string;
  /** Формат основного значения */
  format?: 'currency' | 'number' | 'percent';
  /** Вторичное значение — отображается под основным (средний размер) */
  secondaryValue?: string;
  /** Мелкий описательный текст внизу карточки */
  subtitle?: string;
  /** Tooltip (?) */
  tooltip?: string;
  tooltipAlign?: 'left' | 'right';
  /** Иконка Lucide */
  icon?: LucideIcon;
  /** Цветовая схема иконки */
  accent?: CardAccent;
  /** Change badge: % изменения к предыдущему периоду */
  change?: number;
  isPositive?: boolean;
  /** Состояние загрузки */
  loading?: boolean;
  /** Предупреждение (amber badge) */
  warning?: string;
  /** Кастомный контент вместо стандартного значения */
  children?: ReactNode;
}

// ── Adaptive font size ──
const getFontSizeClass = (numDigits: number): string => {
  // 4-col grid → карточки ~25% ширины → ~220px доступно для чисел
  if (numDigits <= 5) return 'text-2xl sm:text-3xl';   // До 99 999
  if (numDigits <= 7) return 'text-xl sm:text-2xl';    // До 9 999 999
  if (numDigits <= 9) return 'text-lg sm:text-xl';     // До 999 999 999
  return 'text-base sm:text-lg';                        // 10+ цифр
};

// ── Currency renderer (рубли крупно, копейки мелко) ──
const CurrencyValue = ({ value }: { value: number }) => {
  const isNegative = value < 0;
  const absVal = Math.abs(value);
  const rubles = Math.floor(absVal);
  const kopecks = Math.round((absVal - rubles) * 100);
  const rublesFormatted = rubles.toLocaleString('ru-RU');
  const numDigits = rubles.toString().length;
  const mainSize = getFontSizeClass(numDigits);

  return (
    <span className={cn('font-bold tabular-nums leading-tight', mainSize)}>
      {isNegative && <span className="text-red-600">−</span>}
      <span className={isNegative ? 'text-red-600' : 'text-gray-900'}>
        {rublesFormatted}
      </span>
      {kopecks > 0 && (
        <span className="text-xs text-gray-400">,{kopecks.toString().padStart(2, '0')}</span>
      )}
      <span className="text-xs text-gray-400 ml-0.5">₽</span>
    </span>
  );
};

// ── Change badge component ──
const ChangeBadge = ({ change, isPositive }: { change: number; isPositive?: boolean }) => {
  const positive = isPositive ?? change >= 0;
  const color = positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50';
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <span className={cn('hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap', color)}>
      <Icon className="w-3 h-3" />
      {change > 0 ? '+' : ''}{formatPercent(Math.abs(change))}
    </span>
  );
};

// ── Main Component ──
export const SummaryCard = ({
  title,
  mobileTitle,
  value,
  format = 'number',
  secondaryValue,
  subtitle,
  tooltip,
  tooltipAlign = 'left',
  icon: Icon,
  accent = 'indigo',
  change,
  isPositive,
  loading = false,
  warning,
  children,
}: SummaryCardProps) => {
  const colors = accentStyles[accent];

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <div className="animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gray-100 rounded-xl" />
            <div className="h-3.5 bg-gray-100 rounded w-16" />
          </div>
          <div className="h-8 bg-gray-100 rounded w-3/4 mb-2" />
          <div className="h-3.5 bg-gray-50 rounded w-1/2" />
        </div>
      </div>
    );
  }

  // ── Format value ──
  const renderValue = () => {
    if (children) return children;

    if (typeof value === 'string') {
      return <span className="text-2xl sm:text-3xl font-bold text-gray-900">{value}</span>;
    }

    switch (format) {
      case 'currency':
        return <CurrencyValue value={value} />;
      case 'percent':
        return (
          <span className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
            {formatPercent(value)}
          </span>
        );
      default:
        return (
          <span className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
            {formatNumber(value)}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 transition-shadow hover:shadow-md">
      {/* ── Header: icon + title + tooltip + change badge ── */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          {Icon && (
            <div className={cn('flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl ring-1', colors.bg, colors.ring)}>
              <Icon className={cn('w-4 h-4 sm:w-[18px] sm:h-[18px]', colors.text)} />
            </div>
          )}
          {mobileTitle ? (
            <>
              <span className="sm:hidden text-xs font-medium text-gray-500 truncate">{mobileTitle}</span>
              <span className="hidden sm:inline text-xs sm:text-sm font-medium text-gray-500 truncate">{title}</span>
            </>
          ) : (
            <span className="text-xs sm:text-sm font-medium text-gray-500 truncate">{title}</span>
          )}
          {tooltip && (
            <div className="hidden sm:block group relative flex-shrink-0">
              <HelpCircle className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help transition-colors" />
              <div
                className={cn(
                  'invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity',
                  'absolute z-50 top-6 w-56 sm:w-72 p-3 bg-gray-900 text-white text-[11px] sm:text-xs rounded-xl shadow-2xl leading-relaxed whitespace-pre-line',
                  tooltipAlign === 'right'
                    ? 'right-0 left-auto'
                    : 'left-0 right-auto'
                )}
              >
                {tooltip}
                <div
                  className={cn(
                    'absolute -top-1 w-2 h-2 bg-gray-900 rotate-45',
                    tooltipAlign === 'right' ? 'right-3' : 'left-3'
                  )}
                />
              </div>
            </div>
          )}
        </div>
        {/* Right side: change badge or warning */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {warning && (
            <div className="group relative">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle className="w-3 h-3" />
              </div>
              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute z-50 top-full right-0 mt-1.5 w-52 p-2.5 bg-gray-900 text-white text-[11px] rounded-xl shadow-xl whitespace-normal leading-relaxed">
                {warning}
                <span className="absolute -top-1 right-3 w-2 h-2 bg-gray-900 rotate-45" />
              </div>
            </div>
          )}
          {change !== undefined && <ChangeBadge change={change} isPositive={isPositive} />}
        </div>
      </div>

      {/* ── Value ── */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-1 overflow-hidden">
          {renderValue()}
        </div>
        {secondaryValue && (
          <p className="text-sm sm:text-base font-medium text-gray-500 mt-0.5 tabular-nums truncate">
            {secondaryValue}
          </p>
        )}
        {subtitle && (
          <p className="text-[11px] sm:text-xs text-gray-400 mt-1.5 truncate leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
