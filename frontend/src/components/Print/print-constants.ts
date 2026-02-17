/**
 * Константы для enterprise PDF-экспорта
 * Размеры, цвета, пороги пагинации
 */

// ==================== PAGINATION ====================

export const UE_ROWS_PER_PAGE = 12;
export const STOCKS_ROWS_PER_PAGE = 15;
export const ADS_ROWS_PER_PAGE = 20;
export const SALES_ROWS_PER_PAGE = 25;

// ==================== CHART DIMENSIONS ====================

/** Ширина графика (viewport 1200 - padding 64*2) */
export const CHART_WIDTH = 1050;
export const CHART_HEIGHT = 240;
export const CHART_HEIGHT_SMALL = 160;

export const CHART_MARGIN = { top: 20, right: 20, bottom: 30, left: 60 };

// ==================== COLORS ====================

export const COLORS = {
  // Primary
  indigo: '#6366f1',
  emerald: '#10b981',
  red: '#ef4444',
  sky: '#0ea5e9',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  orange: '#f97316',

  // MP
  ozon: '#005BFF',
  wb: '#8B3FFD',

  // Chart fills (semi-transparent)
  emeraldFill: 'rgba(16, 185, 129, 0.15)',
  indigoFill: 'rgba(99, 102, 241, 0.2)',
  skyFill: 'rgba(14, 165, 233, 0.15)',
  amberFill: 'rgba(245, 158, 11, 0.15)',
  redFill: 'rgba(239, 68, 68, 0.12)',

  // Donut palette
  donut: [
    '#ef4444', // red — commission
    '#f97316', // orange — logistics
    '#8b5cf6', // purple — agents
    '#3b82f6', // blue — FBO
    '#eab308', // yellow — promo
    '#06b6d4', // cyan — storage
    '#ec4899', // pink — penalties
    '#6366f1', // indigo — fallback
    '#14b8a6', // teal — fallback
    '#64748b', // slate — fallback
  ],

  // Status
  statusGreen: '#10b981',
  statusAmber: '#f59e0b',
  statusRed: '#ef4444',
  statusBlue: '#3b82f6',

  // Neutral
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',
} as const;

// ==================== THRESHOLDS ====================

export const DRR_THRESHOLDS = { high: 20, medium: 10 } as const;
export const MARGIN_THRESHOLDS = { good: 20, medium: 10 } as const;
export const STOCK_FORECAST_THRESHOLDS = { critical: 7, low: 14, medium: 30 } as const;
export const STOCK_STATUS_THRESHOLDS = { oos: 0, critical: 20, low: 100 } as const;

// ==================== UTILITIES ====================

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result.length === 0 ? [[]] : result;
}
