/**
 * CostsDonutChart — структура удержаний маркетплейса (donut/кольцо)
 * Показывает куда уходят деньги: комиссия, логистика, хранение, штрафы...
 * Данные из costs-tree (CostsTreeItem[])
 */
import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../lib/utils';
import type { CostsTreeItem, Marketplace } from '../../types';

interface CostsDonutChartProps {
  ozonTree?: CostsTreeItem[];
  wbTree?: CostsTreeItem[];
  marketplace: Marketplace;
  loading?: boolean;
}

/** Цвета для категорий расходов */
const CATEGORY_COLORS: Record<string, string> = {
  // OZON
  'Вознаграждение Ozon': '#ef4444',       // red-500
  'Услуги доставки': '#f97316',            // orange-500
  'Услуги агентов': '#a855f7',             // purple-500
  'Услуги FBO': '#3b82f6',                 // blue-500
  'Продвижение и реклама': '#eab308',      // yellow-500
  // WB
  'Вознаграждение Вайлдберриз (ВВ)': '#ef4444',
  'Эквайринг/Комиссии за организацию платежей': '#a855f7',
  'Услуги по доставке товара покупателю': '#f97316',
  'Стоимость хранения': '#06b6d4',         // cyan-500
  'Общая сумма штрафов': '#f43f5e',        // rose-500
};

const FALLBACK_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b',
];

function shortLabel(name: string): string {
  if (name === 'Вознаграждение Ozon') return 'Комиссия';
  if (name === 'Услуги доставки') return 'Логистика';
  if (name === 'Услуги агентов') return 'Агент';
  if (name === 'Услуги FBO') return 'FBO';
  if (name === 'Продвижение и реклама') return 'Промо';
  if (name === 'Вознаграждение Вайлдберриз (ВВ)') return 'Комиссия';
  if (name === 'Эквайринг/Комиссии за организацию платежей') return 'Эквайринг';
  if (name === 'Услуги по доставке товара покупателю') return 'Логистика';
  if (name === 'Стоимость хранения') return 'Хранение';
  if (name === 'Общая сумма штрафов') return 'Штрафы';
  return name.length > 12 ? name.slice(0, 11) + '…' : name;
}

interface DonutEntry {
  name: string;
  shortName: string;
  value: number;
  color: string;
  percent: number;
}

export const CostsDonutChart = ({ ozonTree, wbTree, marketplace, loading = false }: CostsDonutChartProps) => {
  const entries = useMemo(() => {
    // Merge categories by short label
    const map = new Map<string, { fullName: string; value: number }>();

    const processTree = (tree: CostsTreeItem[] | undefined, mp: Marketplace) => {
      if (!tree) return;
      for (const item of tree) {
        if (item.name === 'Продажи') continue;
        // WB: only negative items are deductions; positive = credits (СПП)
        if (mp === 'wb' && item.amount >= 0) continue;
        // OZON: all non-sales items are deductions (all negative)
        if (mp === 'ozon' && item.amount >= 0) continue;

        const label = shortLabel(item.name);
        const absVal = Math.abs(item.amount);
        const existing = map.get(label);
        if (existing) {
          existing.value += absVal;
        } else {
          map.set(label, { fullName: item.name, value: absVal });
        }
      }
    };

    if (marketplace === 'ozon' || marketplace === 'all') processTree(ozonTree, 'ozon');
    if (marketplace === 'wb' || marketplace === 'all') processTree(wbTree, 'wb');

    const items = Array.from(map.entries())
      .map(([shortName, { fullName, value }]) => ({ shortName, fullName, value }))
      .sort((a, b) => b.value - a.value);

    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0) return [];

    let colorIdx = 0;
    return items.map((item): DonutEntry => ({
      name: item.fullName,
      shortName: item.shortName,
      value: item.value,
      color: CATEGORY_COLORS[item.fullName] ?? FALLBACK_COLORS[colorIdx++ % FALLBACK_COLORS.length],
      percent: (item.value / total) * 100,
    }));
  }, [ozonTree, wbTree, marketplace]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
          <div className="flex items-center gap-3">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gray-100 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-3 bg-gray-100 rounded w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!entries.length) return null;

  const total = entries.reduce((s, e) => s + e.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as DonutEntry;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 sm:p-3 text-xs sm:text-sm">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
          <span className="font-semibold text-gray-900">{d.shortName}</span>
        </div>
        <p className="text-gray-700">
          <span className="font-medium">{formatCurrency(d.value)}</span>
          <span className="text-gray-400 ml-1">({d.percent.toFixed(1)}%)</span>
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
      <div className="flex items-baseline justify-between mb-2 sm:mb-3">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Структура расходов</h3>
        <span className="text-[10px] sm:text-xs text-gray-400 tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Donut */}
        <div className="flex-shrink-0" style={{ width: 110, height: 110 }}>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie
                data={entries}
                dataKey="value"
                nameKey="shortName"
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                strokeWidth={1}
                stroke="#fff"
              >
                {entries.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-0 space-y-1">
          {entries.map((entry) => (
            <div key={entry.shortName} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-[10px] sm:text-xs text-gray-600 truncate flex-1">
                {entry.shortName}
              </span>
              <span className="text-[10px] sm:text-xs text-gray-900 font-medium tabular-nums flex-shrink-0">
                {entry.percent.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
