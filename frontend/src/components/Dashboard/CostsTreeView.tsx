/**
 * Дерево удержаний Ozon (1-в-1 как в ЛК Ozon)
 * Визуал: вертикальные линии-коннекторы, % под суммой, collapsible
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCostsTree } from '../../hooks/useDashboard';
import { formatCurrency } from '../../lib/utils';
import type { DashboardFilters, CostsTreeItem, CostsTreeChild } from '../../types';

interface CostsTreeViewProps {
  filters: DashboardFilters;
  marketplace: 'ozon' | 'wb';
  /**
   * Опционально: показывать % у подкатегорий (листов).
   * % считается как доля от "Продажи" (percent_base_sales), как в ЛК Ozon.
   * По умолчанию выключено, чтобы не расходиться визуально с ЛК.
   */
  showLeafPercents?: boolean;
}

function normalizePolicyLabel(label: string): string {
  // Backward-compat: ранее бекенд писал "Витамины (14%)" / "Прочее (20%)".
  // Ставка НЕ является данными Ozon, поэтому в UI скрываем её из имени.
  return String(label || '').replace(/\s*\(\s*\d+(?:[.,]\d+)?\s*%\s*\)\s*$/, '');
}

function pct1(partAbs: number, totalAbs: number): number | null {
  if (totalAbs <= 0) return null;
  const v = (partAbs / totalAbs) * 100;
  return Math.round(v * 10) / 10;
}

/** Подкатегория (лист дерева) */
const TreeLeaf = ({
  item,
  isLast,
  percent,
}: {
  item: CostsTreeChild;
  isLast: boolean;
  percent: number | null;
}) => {
  const amount = item.amount;

  return (
    <div className="flex items-stretch">
      {/* Линия-коннектор */}
      <div className="relative w-8 flex-shrink-0 ml-6">
        {/* Вертикальная линия (не рисуем ниже последнего элемента) */}
        <div
          className={`absolute left-3 top-0 w-px bg-gray-200 ${
            isLast ? 'h-4' : 'h-full'
          }`}
        />
        {/* Горизонтальная линия */}
        <div className="absolute left-3 top-4 w-4 h-px bg-gray-200" />
      </div>

      {/* Содержимое */}
      <div className="flex-1 flex items-center justify-between py-2 min-w-0">
        <span className="text-sm text-gray-700">{normalizePolicyLabel(item.name)}</span>
        <div className="flex flex-col items-end flex-shrink-0 ml-4">
          <span className="text-sm tabular-nums text-gray-900">{formatAmount(amount)}</span>
          {percent !== null && (
            <span className="text-xs text-gray-400" title="Доля от 'Продажи' (как в ЛК)">
              {percent} %
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

type LeafPercentsCfg = { enabled: boolean; denom: number };

/** Категория (раскрывающийся узел дерева) */
const TreeCategory = ({
  item,
  isLast,
  defaultExpanded = true,
  leafPercents,
}: {
  item: CostsTreeItem;
  isLast: boolean;
  defaultExpanded?: boolean;
  leafPercents?: LeafPercentsCfg;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = item.children.length > 0;
  const amount = item.amount;
  const percent = item.percent;

  return (
    <div className="relative">
      {/* Линия-коннектор от родителя */}
      <div className="absolute left-3 top-0 w-px bg-gray-200 h-5" />
      {!isLast && (
        <div className="absolute left-3 top-5 w-px bg-gray-200 h-full" />
      )}

      {/* Заголовок категории */}
      <div
        className="flex items-center justify-between py-2 cursor-pointer group"
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1 min-w-0">
          {hasChildren ? (
            <span className="text-gray-400 w-6 h-6 flex items-center justify-center flex-shrink-0 group-hover:text-gray-600">
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          ) : (
            <span className="w-6 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-gray-900">
            {item.name}
          </span>
        </div>

        {/* Сумма + процент */}
        <div className="flex flex-col items-end flex-shrink-0 ml-4">
          <span className="text-sm font-medium tabular-nums text-gray-900">
            {formatAmount(amount)}
          </span>
          {percent !== null && percent !== undefined && (
            <span className="text-xs text-gray-400">{percent} %</span>
          )}
        </div>
      </div>

      {/* Дочерние элементы */}
      {expanded && hasChildren && (
        <div className="relative">
          {item.children.map((child, idx) => (
            // % для листьев считаем от "Продажи" (как в ЛК), опционально.
            <TreeLeaf
              key={child.name}
              item={child}
              isLast={idx === item.children.length - 1}
              percent={
                leafPercents?.enabled && leafPercents.denom > 0 && item.name !== 'Продажи'
                  ? pct1(Math.abs(child.amount), leafPercents.denom)
                  : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

/** Форматирование суммы в стиле Ozon (без знака +, пробелы разделяют тысячи) */
function formatAmount(amount: number): string {
  // Используем formatCurrency но убираем знак + для положительных
  const formatted = formatCurrency(Math.abs(amount));
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

export const CostsTreeView = ({ filters, marketplace, showLeafPercents = false }: CostsTreeViewProps) => {
  const { data, isLoading, error } = useCostsTree({
    ...filters,
    marketplace,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-100 rounded w-1/3" />
          <div className="space-y-3 ml-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 bg-gray-50 rounded w-2/3" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-2" style={{ color: '#005BFF' }}>OZON</h3>
        <p className="text-sm text-gray-400">Не удалось загрузить данные</p>
      </div>
    );
  }

  if (!data?.tree?.length) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-2" style={{ color: '#005BFF' }}>OZON</h3>
        <p className="text-sm text-gray-400">Нет данных за период</p>
      </div>
    );
  }

  const { total_accrued, tree } = data;

  const percentBaseSales =
    typeof data.percent_base_sales === 'number'
      ? Math.abs(data.percent_base_sales)
      : Math.abs(tree.find((t) => t.name === 'Продажи')?.amount ?? 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Заголовок маркетплейса */}
      <h3 className="text-lg font-bold mb-4" style={{ color: '#005BFF' }}>OZON</h3>

      {/* "Начислено за период" */}
      <div className="flex items-baseline justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-900">
            Начислено
          </span>
          <span className="text-xs text-gray-400">за период</span>
        </div>
        <span className="text-sm font-semibold tabular-nums text-gray-900">
          {formatAmount(total_accrued)}
        </span>
      </div>

      {/* Дерево категорий */}
      <div className="space-y-0">
        {tree.map((item, idx) => (
          <TreeCategory
            key={item.name}
            item={item}
            isLast={idx === tree.length - 1}
            defaultExpanded={true}
            leafPercents={{ enabled: showLeafPercents, denom: percentBaseSales }}
          />
        ))}
      </div>
    </div>
  );
};
