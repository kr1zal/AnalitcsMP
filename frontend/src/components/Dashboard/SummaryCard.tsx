/**
 * SummaryCard v2-refined — enterprise-минималистичная карточка метрики
 *
 * Дизайн:
 * ┌─────────────────────────────────┐
 * │ Label                   ? Δ+12% │
 * │ 19 502 ₽                        │
 * │ 245 шт · выкуп 81%             │
 * └─────────────────────────────────┘
 *
 * - Белый фон, gray-200 border, без иконок/градиентов
 * - Число — главный акцент (26px semibold)
 * - Hover: border darkens + shadow + text darkens
 * - Change badge: pill с rounded-[4px], emerald/red
 */
import { type ReactNode, useState, useRef, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { HelpCircle, AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';
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

/** @deprecated v2-refined: icons removed. Kept for backward compatibility */
export const accentStyles: Record<CardAccent, { bg: string; text: string; ring: string }> = {
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
  /** Слот для AxisBadge (inline, не absolute) */
  axisBadge?: ReactNode;
  /** Компактный режим — только title + value, без деталей */
  compact?: boolean;
  /** Единица измерения для number-формата (шт, дн.) */
  unit?: string;
}

// ── Adaptive font size (v2-refined: 26px base) ──
const getFontSizeClass = (numDigits: number, isCompact?: boolean): string => {
  if (isCompact) {
    if (numDigits <= 7) return 'text-[20px]';
    if (numDigits <= 9) return 'text-[18px]';
    return 'text-[16px]';
  }
  if (numDigits <= 7) return 'text-[26px]';
  if (numDigits <= 9) return 'text-[22px]';
  return 'text-[18px]';
};

// ── Currency renderer (рубли крупно, копейки мелко) ──
const CurrencyValue = ({ value, sizeOverride, compact }: { value: number; sizeOverride?: string; compact?: boolean }) => {
  const isNegative = value < 0;
  const absVal = Math.abs(value);
  const rubles = Math.floor(absVal);
  const kopecks = Math.round((absVal - rubles) * 100);
  const rublesFormatted = rubles.toLocaleString('ru-RU');
  const numDigits = rubles.toString().length;
  const mainSize = sizeOverride ?? getFontSizeClass(numDigits, compact);

  return (
    <span className={cn('font-semibold tabular-nums leading-[1.15] tracking-tight', mainSize)}>
      {isNegative && <span className="text-red-600">{'\u2212'}</span>}
      <span className={isNegative ? 'text-red-600' : 'text-gray-900'}>
        {rublesFormatted}
      </span>
      {kopecks > 0 && (
        <span className="text-sm text-gray-400 font-normal">,{kopecks.toString().padStart(2, '0')}</span>
      )}
      <span className="text-sm text-gray-400 font-normal ml-0.5">{'\u20BD'}</span>
    </span>
  );
};

// ── Change badge component (v2: pill with Unicode arrows) ──
const ChangeBadge = ({ change, isPositive }: { change: number; isPositive?: boolean }) => {
  if (change === 0) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-gray-400 bg-gray-50 whitespace-nowrap">0%</span>;
  }
  const positive = isPositive ?? change >= 0;
  const color = positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50';
  const arrow = positive ? '\u2191' : '\u2193';

  return (
    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap', color)}>
      {arrow} {change > 0 ? '+' : ''}{formatPercent(Math.abs(change))}
    </span>
  );
};

// ── Tooltip: desktop hover, mobile tap (Portal) ──
const CardTooltip = ({ text, align = 'left' }: { text: string; align?: 'left' | 'right' }) => {
  const [open, setOpen] = useState(false);
  const iconRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (iconRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  const handleTap = () => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const tooltipW = 240;
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    if (left < 8) left = 8;
    if (left + tooltipW > window.innerWidth - 8) left = window.innerWidth - 8 - tooltipW;
    setPos({ top: rect.bottom + 6, left });
    setOpen((v) => !v);
  };

  return (
    <>
      {/* Mobile: tap toggle */}
      <button
        ref={iconRef}
        onClick={handleTap}
        className="sm:hidden flex-shrink-0 p-2.5 -m-2.5"
        aria-label="Подсказка"
      >
        <HelpCircle className="w-3.5 h-3.5 text-gray-300 active:text-gray-500" />
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          className="fixed z-[9999] w-60 p-3 bg-gray-900 text-white text-[11px] rounded-xl shadow-2xl leading-relaxed whitespace-pre-line animate-in fade-in duration-150"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </div>,
        document.body,
      )}
      {/* Desktop: hover */}
      <div className="hidden sm:block group/tip relative flex-shrink-0">
        <HelpCircle className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help transition-colors" />
        <div
          className={cn(
            'invisible group-hover/tip:visible opacity-0 group-hover/tip:opacity-100 transition-opacity',
            'absolute z-50 top-6 w-56 sm:w-72 p-3 bg-gray-900 text-white text-[11px] sm:text-xs rounded-xl shadow-2xl leading-relaxed whitespace-pre-line',
            align === 'right' ? 'right-0 left-auto' : 'left-0 right-auto',
          )}
        >
          {text}
          <div className={cn('absolute -top-1 w-2 h-2 bg-gray-900 rotate-45', align === 'right' ? 'right-3' : 'left-3')} />
        </div>
      </div>
    </>
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
  icon: _icon,
  accent: _accent = 'indigo',
  change,
  isPositive,
  loading = false,
  warning,
  children,
  axisBadge,
  compact = false,
  unit,
}: SummaryCardProps) => {
  // ── Loading skeleton (v2-refined) ──
  if (loading) {
    return (
      <div className={cn(
        'bg-white rounded-lg border border-gray-200 h-full',
        compact ? 'p-2.5 sm:p-3' : 'p-4 min-h-[120px]',
      )}>
        <div className="animate-pulse flex flex-col gap-1">
          {compact ? (
            <>
              <div className="h-3 bg-gray-100 rounded w-14" />
              <div className="h-5 bg-gray-100 rounded w-3/4 mt-1" />
            </>
          ) : (
            <>
              <div className="h-3.5 bg-gray-100 rounded w-20" />
              <div className="h-7 bg-gray-100 rounded w-3/4 mt-1" />
              <div className="h-3 bg-gray-50 rounded w-1/2 mt-1" />
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Format value (v2-refined: 26px/semibold/tabular-nums) ──
  const valueBase = compact
    ? 'font-semibold text-gray-900 tabular-nums leading-[1.15] tracking-tight text-[20px]'
    : 'font-semibold text-gray-900 tabular-nums leading-[1.15] tracking-tight text-[26px]';

  const renderValue = () => {
    if (children) return children;

    if (typeof value === 'string') {
      return <span className={valueBase}>{value}</span>;
    }

    const isNeg = value < 0;

    switch (format) {
      case 'currency':
        return <CurrencyValue value={value} compact={compact} />;
      case 'percent':
        return (
          <span className={cn(valueBase, isNeg && 'text-red-600')}>
            {formatPercent(value)}
          </span>
        );
      default:
        return (
          <span className={cn(valueBase, isNeg && 'text-red-600')}>
            {formatNumber(value)}
          </span>
        );
    }
  };

  // ── Compact layout: title + value + unit + axisBadge ──
  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-2.5 sm:p-3 transition-all duration-150 hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] h-full flex flex-col justify-between group">
        <span className="text-[11px] font-medium text-gray-500 group-hover:text-gray-700 transition-colors duration-150 truncate leading-none">
          {mobileTitle ?? title}
        </span>
        <div className="flex items-baseline gap-1 overflow-hidden mt-1">
          {renderValue()}
          {unit && format === 'number' && (
            <span className="text-sm text-gray-400 font-normal ml-0.5 flex-shrink-0">{unit}</span>
          )}
        </div>
        {axisBadge && (
          <div className="flex justify-end mt-1">
            {axisBadge}
          </div>
        )}
      </div>
    );
  }

  // ── Full layout (v2-refined) ──
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 transition-all duration-150 hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] h-full min-h-[120px] flex flex-col gap-1 group">
      {/* ── Header: label + tooltip + warning + change badge ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {mobileTitle ? (
            <>
              <span className="sm:hidden text-[12px] font-medium text-gray-500 group-hover:text-gray-700 transition-colors duration-150 truncate">{mobileTitle}</span>
              <span className="hidden sm:inline text-[13px] font-medium text-gray-500 group-hover:text-gray-700 transition-colors duration-150 truncate">{title}</span>
            </>
          ) : (
            <span className="text-[13px] font-medium text-gray-500 group-hover:text-gray-700 transition-colors duration-150 truncate">{title}</span>
          )}
          {tooltip && (
            <CardTooltip text={tooltip} align={tooltipAlign} />
          )}
        </div>
        {/* Right side: warning + change badge */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {warning && (
            <div className="group/warn relative">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle className="w-3 h-3" />
              </div>
              <div className="invisible group-hover/warn:visible opacity-0 group-hover/warn:opacity-100 transition-opacity absolute z-50 top-full right-0 mt-1.5 w-52 p-2.5 bg-gray-900 text-white text-[11px] rounded-xl shadow-xl whitespace-normal leading-relaxed">
                {warning}
                <span className="absolute -top-1 right-3 w-2 h-2 bg-gray-900 rotate-45" />
              </div>
            </div>
          )}
          {change !== undefined && <ChangeBadge change={change} isPositive={isPositive} />}
        </div>
      </div>

      {/* ── Value ── */}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="flex items-baseline gap-1 overflow-hidden">
          {renderValue()}
          {unit && format === 'number' && (
            <span className="text-sm text-gray-400 font-normal ml-0.5">{unit}</span>
          )}
        </div>
        {secondaryValue && (
          <p className="text-xs text-gray-400 group-hover:text-gray-500 transition-colors duration-150 mt-0.5 tabular-nums truncate">
            {secondaryValue}
          </p>
        )}
        {subtitle && (
          <p className="text-[11px] text-gray-400 mt-1 truncate leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* ── Axis badge (inline, часть flow) ── */}
      {axisBadge && (
        <div className="flex justify-end mt-0.5">
          {axisBadge}
        </div>
      )}
    </div>
  );
};
