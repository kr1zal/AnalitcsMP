/**
 * Утилиты для форматирования и вспомогательных функций
 */
import { format, subDays } from 'date-fns';
import type { DateRangePreset } from '../types';

/**
 * Сегодняшний день в формате YYYY-MM-DD (локальная TZ)
 */
export const getTodayYmd = (): string => {
  return formatDateForAPI(new Date());
};

/**
 * Максимальная доступная дата для выбора в календаре.
 * Данные WB/Ozon за текущий день появляются после 10:00 МСК.
 * - До 10:00 МСК → max = вчера (T-1)
 * - После 10:00 МСК → max = сегодня (T-0)
 */
export const getMaxAvailableDateYmd = (): string => {
  const now = new Date();

  // Получаем текущий час в московском времени (UTC+3)
  // toLocaleString с timeZone даёт корректное время в МСК
  const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const moscowHour = moscowTime.getHours();

  // Если до 10:00 МСК — данные за сегодня ещё не доступны
  if (moscowHour < 10) {
    return formatDateForAPI(subDays(now, 1));
  }

  return formatDateForAPI(now);
};

/**
 * Нормализация диапазона дат в формате YYYY-MM-DD.
 * - опционально ограничивает диапазон сверху (max)
 * - гарантирует from <= to (если пользователь ввёл наоборот — меняем местами)
 *
 * Примечание: сравнение строк работает, т.к. формат фиксированный YYYY-MM-DD.
 */
export const normalizeDateRangeYmd = (
  from: string,
  to: string,
  opts?: { max?: string }
): { from: string; to: string } => {
  let f = from;
  let t = to;
  const max = opts?.max;

  if (max) {
    if (f > max) f = max;
    if (t > max) t = max;
  }

  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
};

/**
 * Форматирование валюты (рубли)
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Форматирование числа с разделителями тысяч
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('ru-RU').format(value);
};

/**
 * Форматирование процентов
 */
export const formatPercent = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Форматирование даты
 */
export const formatDate = (date: string | Date, formatStr: string = 'dd.MM.yyyy'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, formatStr);
};

/**
 * Форматирование даты для API (YYYY-MM-DD)
 */
export const formatDateForAPI = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

/**
 * Заполнить дневной ряд (YYYY-MM-DD) отсутствующими датами.
 * Возвращает массив по всем дням в диапазоне [from..to] включительно.
 *
 * Важно: backend часто возвращает только дни с активностью. Для UX "7/30/90 дней"
 * на графиках нам нужен непрерывный дневной ряд.
 */
export const fillDailySeriesYmd = <T extends { date: string }>(
  range: { from: string; to: string },
  data: T[],
  makeEmpty: (date: string) => T
): T[] => {
  const byDate = new Map<string, T>();
  for (const item of data) byDate.set(item.date, item);

  const start = new Date(`${range.from}T00:00:00`);
  const end = new Date(`${range.to}T00:00:00`);
  const cur = new Date(start);

  const out: T[] = [];
  while (cur.getTime() <= end.getTime()) {
    const ymd = formatDateForAPI(cur);
    out.push(byDate.get(ymd) ?? makeEmpty(ymd));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

/**
 * Получить диапазон дат по пресету
 * @param maxDate — максимальная дата (если не указана, используется getMaxAvailableDateYmd)
 */
export const getDateRangeFromPreset = (
  preset: DateRangePreset,
  customFrom?: string | null,
  customTo?: string | null,
  maxDate?: string
): { from: string; to: string } => {
  // Используем maxDate если передан, иначе вычисляем по логике 10:00 МСК
  const endDateStr = maxDate ?? getMaxAvailableDateYmd();

  if (preset === 'custom' && customFrom && customTo) {
    return normalizeDateRangeYmd(customFrom, customTo, { max: endDateStr });
  }

  switch (preset) {
    case '7d':
      return {
        from: formatDateForAPI(subDays(new Date(`${endDateStr}T00:00:00`), 6)),
        to: endDateStr,
      };
    case '30d':
      return {
        from: formatDateForAPI(subDays(new Date(`${endDateStr}T00:00:00`), 29)),
        to: endDateStr,
      };
    case '90d':
      return {
        from: formatDateForAPI(subDays(new Date(`${endDateStr}T00:00:00`), 89)),
        to: endDateStr,
      };
    default:
      return {
        from: formatDateForAPI(subDays(new Date(`${endDateStr}T00:00:00`), 29)),
        to: endDateStr,
      };
  }
};

/**
 * Расчёт процента изменения
 */
export const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Определение, положительное ли изменение (для разных метрик)
 */
export const isPositiveChange = (change: number, metricType: 'revenue' | 'costs' | 'returns'): boolean => {
  if (metricType === 'costs' || metricType === 'returns') {
    // Для расходов и возвратов, снижение - это хорошо
    return change < 0;
  }
  // Для выручки и продаж, рост - это хорошо
  return change > 0;
};

/**
 * Объединение классов (для Tailwind)
 */
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

/**
 * Получить цвет маркетплейса
 */
export const getMarketplaceColor = (marketplace: string): string => {
  switch (marketplace.toLowerCase()) {
    case 'wb':
      return '#8B3FFD'; // WB purple
    case 'ozon':
      return '#005BFF'; // Ozon blue
    default:
      return '#6B7280'; // Gray
  }
};

/**
 * Получить название маркетплейса
 */
export const getMarketplaceName = (marketplace: string): string => {
  switch (marketplace.toLowerCase()) {
    case 'wb':
      return 'Wildberries';
    case 'ozon':
      return 'Ozon';
    case 'all':
      return 'Все площадки';
    default:
      return marketplace;
  }
};

/**
 * Debounce функция
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Копирование в буфер обмена
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy:', error);
    return false;
  }
};
