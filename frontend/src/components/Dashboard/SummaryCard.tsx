/**
 * Карточка сводной метрики
 */
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { cn, formatCurrency, formatNumber, formatPercent } from '../../lib/utils';

interface SummaryCardProps {
  title: string;
  value: number | string;
  subtitle?: string; // дополнительный текст под значением (мелким шрифтом)
  tooltip?: string; // подсказка при наведении на иконку (?)
  tooltipAlign?: 'left' | 'right'; // позиция tooltip: left = слева от иконки, right = справа (для правых колонок)
  change?: number; // процент изменения
  isPositive?: boolean;
  icon?: LucideIcon;
  format?: 'currency' | 'number' | 'percent';
  loading?: boolean;
}

export const SummaryCard = ({
  title,
  value,
  subtitle,
  tooltip,
  tooltipAlign = 'left',
  change,
  isPositive = true,
  icon: Icon,
  format = 'number',
  loading = false,
}: SummaryCardProps) => {
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'currency':
        return formatCurrency(val);
      case 'percent':
        return formatPercent(val);
      case 'number':
      default:
        return formatNumber(val);
    }
  };

  // Определяем размер шрифта на основе длины числа
  // Расчет доступной ширины:
  // - При 7 колонках: ~122px (162px карточка - 40px padding) - САМЫЙ УЗКИЙ СЛУЧАЙ
  // - При 5 колонках: ~194px (234px карточка - 40px padding)
  // - При 3 колонках: ~280px (320px карточка - 40px padding)
  // 
  // Ширина символов (tabular-nums, bold):
  // - text-3xl (30px): ~18-20px на цифру → поместится ~6 цифр в 122px
  // - text-2xl (24px): ~14-16px на цифру → поместится ~8 цифр в 122px
  // - text-xl (20px): ~12-13px на цифру → поместится ~9-10 цифр в 122px
  // - text-lg (18px): ~10-11px на цифру → поместится ~11-12 цифр в 122px
  // 
  // Примеры (с учетом пробелов, запятой, копеек, символа ₽):
  // - 4 119,76₽ (4 цифры + пробел + 3 цифры = 7 цифр): ~140px при text-2xl → помещается
  // - 12 345,67₽ (5+3=8 цифр): ~150px при text-2xl → помещается в 194px
  // - 123 456,78₽ (6+3=9 цифр): ~160px при text-xl → помещается в 194px
  // - 1 234 567,89₽ (7+3=10 цифр): ~170px при text-xl → помещается в 194px
  // - 123 456 789,12₽ (9+3=12 цифр): ~180px при text-lg → помещается в 194px
  const getFontSizeClass = (numDigits: number): string => {
    // Консервативный подход: ориентируемся на самый узкий случай (7 колонок = 122px)
    // Визуально поджимаем на первой странице, чтобы карточки были спокойнее и единообразнее
    if (numDigits <= 4) return 'text-2xl';      // До 9 999
    if (numDigits <= 7) return 'text-xl';       // До 9 999 999
    if (numDigits <= 9) return 'text-lg';       // До 999 999 999
    return 'text-base';                         // 10+ цифр
  };

  // Разбиваем валюту на части для стилизации (рубли, копейки, символ)
  const renderCurrencyValue = (val: number | string) => {
    if (typeof val === 'string') {
      // Если строка, пытаемся распарсить
      const numVal = parseFloat(val.replace(/[^\d.,-]/g, '').replace(',', '.'));
      if (!isNaN(numVal)) {
        val = numVal;
      } else {
        return <span className="text-2xl">{val}</span>;
      }
    }
    
    if (format === 'currency') {
      const isNegative = val < 0;
      const absVal = Math.abs(val);
      
      // Разбиваем число на рубли и копейки
      const rubles = Math.floor(absVal);
      const kopecks = Math.round((absVal - rubles) * 100);
      
      // Форматируем рубли с пробелами тысяч
      const rublesFormatted = rubles.toLocaleString('ru-RU');
      
      // Считаем количество цифр (без пробелов и знаков)
      const numDigits = rubles.toString().length;
      const mainSize = getFontSizeClass(numDigits);
      
      // Размер для копеек и символа: пропорционально основному, но меньше
      // text-2xl (24px) → text-xs (12px)
      // text-xl/text-lg/text-base → text-xs (12px)
      const smallSize = 'text-xs';
      
      return (
        <>
          {isNegative && <span className={mainSize}>-</span>}
          <span className={mainSize}>{rublesFormatted}</span>
          {kopecks > 0 && (
            <>
              <span className={smallSize}>,</span>
              <span className={smallSize}>{kopecks.toString().padStart(2, '0')}</span>
            </>
          )}
          <span className={`${smallSize} ml-0.5`}>₽</span>
        </>
      );
    }
    
    // Для не-валюты просто возвращаем строку
    return <span className="text-2xl">{formatValue(val)}</span>;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-5">
        <div className="animate-pulse">
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2 mb-3 sm:mb-4"></div>
          <div className="h-6 sm:h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-5">
      {/* Заголовок */}
      <div className="flex items-start justify-between mb-1 gap-1 sm:gap-2">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-[10px] sm:text-xs font-semibold text-gray-500 whitespace-nowrap truncate flex-1 min-w-0">
            {title}
          </span>
          {tooltip && (
            <div className="group relative flex-shrink-0">
              <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 cursor-help" />
              {/* Tooltip - позиция зависит от tooltipAlign (left/right) */}
              <div
                className={cn(
                  'invisible group-hover:visible absolute z-50 top-5 w-44 sm:w-64 p-2 sm:p-3 bg-gray-900 text-white text-[10px] sm:text-xs rounded-lg shadow-2xl leading-relaxed whitespace-pre-line',
                  tooltipAlign === 'right'
                    ? 'right-0 left-auto'
                    : 'left-0 right-auto sm:left-0'
                )}
              >
                {tooltip}
                <div
                  className={cn(
                    'absolute -top-1 w-2 h-2 bg-gray-900 rotate-45',
                    tooltipAlign === 'right' ? 'right-2' : 'left-2'
                  )}
                />
              </div>
            </div>
          )}
        </div>
        {Icon && <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-gray-500 flex-shrink-0 mt-0.5 hidden sm:block" />}
      </div>

      {/* Значение */}
      <div className="overflow-hidden min-w-0">
        <p className="font-bold text-gray-900 tabular-nums leading-tight flex items-baseline whitespace-nowrap min-w-0">
          {format === 'currency' ? renderCurrencyValue(value) : (
            <span className="text-xl sm:text-2xl">{formatValue(value)}</span>
          )}
        </p>
        {subtitle && (
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 break-words truncate">{subtitle}</p>
        )}
      </div>

      {/* Тренд */}
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? (
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
          ) : (
            <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
          )}
          <span
            className={cn(
              'text-xs sm:text-sm font-medium',
              isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {change > 0 ? '+' : ''}
            {formatPercent(Math.abs(change))}
          </span>
          <span className="text-xs sm:text-sm text-gray-500 ml-1 hidden sm:inline">за период</span>
        </div>
      )}
    </div>
  );
};
