/**
 * Страница для печати / PDF экспорта
 * Открывается Playwright'ом для генерации красивого PDF
 */
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import { formatCurrency, formatPercent, formatNumber, formatDate } from '../lib/utils';
import type {
  CostsTreeResponse,
  UnitEconomicsItem,
} from '../types';

export function PrintPage() {
  const [searchParams] = useSearchParams();

  const dateFrom = searchParams.get('from') || '';
  const dateTo = searchParams.get('to') || '';
  const marketplace = (searchParams.get('marketplace') || 'all') as 'all' | 'ozon' | 'wb';

  // Загружаем данные
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['print-summary', dateFrom, dateTo, marketplace],
    queryFn: () =>
      dashboardApi.getSummary({ date_from: dateFrom, date_to: dateTo, marketplace }),
    enabled: !!dateFrom && !!dateTo,
  });

  const { data: ozonTree, isLoading: ozonLoading } = useQuery({
    queryKey: ['print-costs-tree-ozon', dateFrom, dateTo],
    queryFn: () =>
      dashboardApi.getCostsTree({
        date_from: dateFrom,
        date_to: dateTo,
        marketplace: 'ozon',
        include_children: true,
      }),
    enabled: !!dateFrom && !!dateTo && (marketplace === 'all' || marketplace === 'ozon'),
  });

  const { data: wbTree, isLoading: wbLoading } = useQuery({
    queryKey: ['print-costs-tree-wb', dateFrom, dateTo],
    queryFn: () =>
      dashboardApi.getCostsTree({
        date_from: dateFrom,
        date_to: dateTo,
        marketplace: 'wb',
        include_children: true,
      }),
    enabled: !!dateFrom && !!dateTo && (marketplace === 'all' || marketplace === 'wb'),
  });

  const { data: unitEconomics, isLoading: ueLoading } = useQuery({
    queryKey: ['print-unit-economics', dateFrom, dateTo, marketplace],
    queryFn: () =>
      dashboardApi.getUnitEconomics({ date_from: dateFrom, date_to: dateTo, marketplace }),
    enabled: !!dateFrom && !!dateTo,
  });

  const { data: adCosts, isLoading: adsLoading } = useQuery({
    queryKey: ['print-ad-costs', dateFrom, dateTo, marketplace],
    queryFn: () =>
      dashboardApi.getAdCosts({ date_from: dateFrom, date_to: dateTo, marketplace }),
    enabled: !!dateFrom && !!dateTo,
  });

  const isLoading = summaryLoading || ozonLoading || wbLoading || ueLoading || adsLoading;
  const periodStr = `${formatDate(dateFrom)} — ${formatDate(dateTo)}`;

  // Данные из costs-tree
  const ozonSales = ozonTree?.tree.find((c) => c.name === 'Продажи')?.amount ?? 0;
  const wbSales = wbTree?.tree.find((c) => c.name === 'Продажи')?.amount ?? 0;
  const totalRevenue = ozonSales + wbSales;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Загрузка данных...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-white text-gray-900 print:bg-white"
      data-pdf-ready="true"
    >
      {/* ============ PAGE 1: Dashboard ============ */}
      <div className="p-8 page-break-after">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 pb-4 border-b-2 border-indigo-500">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Аналитика маркетплейсов
            </h1>
            <p className="text-lg text-gray-500 mt-1">{periodStr}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500" />
              <span className="text-sm font-medium text-gray-600">OZON</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-500" />
              <span className="text-sm font-medium text-gray-600">Wildberries</span>
            </div>
          </div>
        </header>

        {/* Карточки маркетплейсов */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* OZON */}
          {(marketplace === 'all' || marketplace === 'ozon') && ozonTree && (
            <MarketplaceCard
              title="OZON"
              color="blue"
              data={ozonTree}
              sales={ozonSales}
            />
          )}

          {/* WB */}
          {(marketplace === 'all' || marketplace === 'wb') && wbTree && (
            <MarketplaceCard
              title="Wildberries"
              color="purple"
              data={wbTree}
              sales={wbSales}
            />
          )}
        </div>

        {/* Общие показатели */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Общие показатели</h2>
          <div className="grid grid-cols-6 gap-4">
            <MetricBox label="Выручка" value={formatCurrency(totalRevenue)} />
            <MetricBox label="Заказы" value={formatNumber(summary?.summary.orders ?? 0)} />
            <MetricBox label="Выкупы" value={formatNumber(summary?.summary.sales ?? 0)} />
            <MetricBox label="Возвраты" value={formatNumber(summary?.summary.returns ?? 0)} />
            <MetricBox label="Средний чек" value={formatCurrency(summary?.summary.avg_check ?? 0)} />
            <MetricBox label="Прибыль" value={formatCurrency(summary?.summary.net_profit ?? 0)} highlight />
          </div>
        </div>

        {/* Footer страницы */}
        <PageFooter page={1} total={3} />
      </div>

      {/* ============ PAGE 2: Unit Economics ============ */}
      <div className="p-8 page-break-after">
        <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Unit-экономика</h1>
            <p className="text-gray-500">{periodStr}</p>
          </div>
        </header>

        {/* Таблица товаров */}
        <div className="rounded-xl border border-gray-200 overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Товар</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Продажи</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Выручка</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Удержания</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Закупка</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Прибыль</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">На ед.</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {unitEconomics?.products.map((item, i) => (
                <UnitEconomicsRow key={item.product.id} item={item} index={i} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Итоги */}
        {unitEconomics?.products && unitEconomics.products.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard
              label="Всего продаж"
              value={formatNumber(
                unitEconomics.products.reduce((s, i) => s + i.metrics.sales_count, 0)
              )}
              color="blue"
            />
            <SummaryCard
              label="Общая выручка"
              value={formatCurrency(
                unitEconomics.products.reduce((s, i) => s + i.metrics.revenue, 0)
              )}
              color="green"
            />
            <SummaryCard
              label="Удержания МП"
              value={formatCurrency(
                unitEconomics.products.reduce((s, i) => s + i.metrics.mp_costs, 0)
              )}
              color="orange"
            />
            <SummaryCard
              label="Прибыль"
              value={formatCurrency(
                unitEconomics.products.reduce((s, i) => s + i.metrics.net_profit, 0)
              )}
              color="indigo"
            />
          </div>
        )}

        <PageFooter page={2} total={3} />
      </div>

      {/* ============ PAGE 3: Реклама ============ */}
      <div className="p-8">
        <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Рекламные расходы</h1>
            <p className="text-gray-500">{periodStr}</p>
          </div>
        </header>

        {/* Метрики рекламы */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <SummaryCard
            label="Расход"
            value={formatCurrency(adCosts?.totals.ad_cost ?? 0)}
            color="red"
          />
          <SummaryCard
            label="ДРР"
            value={formatPercent(adCosts?.totals.drr ?? 0)}
            color="orange"
          />
          <SummaryCard
            label="Показы"
            value={formatNumber(adCosts?.totals.impressions ?? 0)}
            color="blue"
          />
          <SummaryCard
            label="Клики"
            value={formatNumber(adCosts?.totals.clicks ?? 0)}
            color="indigo"
          />
          <SummaryCard
            label="Заказы"
            value={formatNumber(adCosts?.totals.orders ?? 0)}
            color="green"
          />
        </div>

        {/* Таблица по дням */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-red-50 to-orange-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Дата</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Расход</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Выручка</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ДРР</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Показы</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Клики</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Заказы</th>
              </tr>
            </thead>
            <tbody>
              {adCosts?.data.slice(0, 20).map((day, i) => (
                <tr key={day.date} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2.5 text-gray-900 font-medium">
                    {formatDate(day.date)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {formatCurrency(day.ad_cost)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {formatCurrency(day.revenue)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={
                        day.drr > 20
                          ? 'text-red-600'
                          : day.drr > 10
                          ? 'text-orange-600'
                          : 'text-green-600'
                      }
                    >
                      {formatPercent(day.drr)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {formatNumber(day.impressions)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {formatNumber(day.clicks)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {formatNumber(day.orders)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {adCosts?.data && adCosts.data.length > 20 && (
            <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50 border-t">
              + ещё {adCosts.data.length - 20} дней
            </div>
          )}
        </div>

        <PageFooter page={3} total={3} />
      </div>
    </div>
  );
}

// ==================== Helper Components ====================

function MarketplaceCard({
  title,
  color,
  data,
  sales,
}: {
  title: string;
  color: 'blue' | 'purple';
  data: CostsTreeResponse;
  sales: number;
}) {
  const colorClasses = {
    blue: {
      border: 'border-blue-200',
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
      title: 'text-blue-700',
      accent: 'bg-blue-500',
    },
    purple: {
      border: 'border-purple-200',
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
      title: 'text-purple-700',
      accent: 'bg-purple-500',
    },
  };

  const c = colorClasses[color];

  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-6`}>
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-3 h-3 rounded-full ${c.accent}`} />
        <h2 className={`text-xl font-bold ${c.title}`}>{title}</h2>
      </div>

      <div className="space-y-4">
        {/* Главные метрики */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(sales)}
            </div>
            <div className="text-sm text-gray-500">Продажи</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(data.total_accrued)}
            </div>
            <div className="text-sm text-gray-500">Начислено</div>
          </div>
        </div>

        {/* Детализация */}
        <div className="pt-4 border-t border-gray-200/50 space-y-2">
          {data.tree
            .filter((c) => c.name !== 'Продажи')
            .slice(0, 5)
            .map((category) => (
              <div key={category.name} className="flex justify-between text-sm">
                <span className="text-gray-600">{category.name}</span>
                <span className="font-medium text-gray-800">
                  {formatCurrency(category.amount)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`text-center p-4 rounded-xl ${
        highlight
          ? 'bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200'
          : 'bg-white border border-gray-100'
      }`}
    >
      <div
        className={`text-2xl font-bold ${highlight ? 'text-green-700' : 'text-gray-900'}`}
      >
        {value}
      </div>
      <div className={`text-sm mt-1 ${highlight ? 'text-green-600' : 'text-gray-500'}`}>
        {label}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'red' | 'orange' | 'blue' | 'indigo' | 'green';
}) {
  const colorClasses = {
    red: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 text-red-700',
    orange: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 text-orange-700',
    blue: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 text-blue-700',
    indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700',
    green: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 text-green-700',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80 mt-1">{label}</div>
    </div>
  );
}

function UnitEconomicsRow({ item, index }: { item: UnitEconomicsItem; index: number }) {
  const margin =
    item.metrics.revenue > 0
      ? (item.metrics.net_profit / item.metrics.revenue) * 100
      : 0;

  return (
    <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-4 py-3 text-gray-900 font-medium truncate max-w-[200px]">
        {item.product.name}
      </td>
      <td className="px-4 py-3 text-right text-gray-700">
        {formatNumber(item.metrics.sales_count)}
      </td>
      <td className="px-4 py-3 text-right text-gray-700">
        {formatCurrency(item.metrics.revenue)}
      </td>
      <td className="px-4 py-3 text-right text-gray-700">
        {formatCurrency(item.metrics.mp_costs)}
      </td>
      <td className="px-4 py-3 text-right text-gray-700">
        {formatCurrency(item.metrics.purchase_costs)}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-gray-900">
        {formatCurrency(item.metrics.net_profit)}
      </td>
      <td className="px-4 py-3 text-right text-gray-700">
        {formatCurrency(item.metrics.unit_profit)}
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className={`font-medium ${
            margin >= 20
              ? 'text-green-600'
              : margin >= 10
              ? 'text-yellow-600'
              : 'text-red-600'
          }`}
        >
          {formatPercent(margin)}
        </span>
      </td>
    </tr>
  );
}

function PageFooter({ page, total }: { page: number; total: number }) {
  const now = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <footer className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-500">
      <span>Сгенерировано: {now}</span>
      <span>analitics.bixirun.ru</span>
      <span>
        Страница {page} из {total}
      </span>
    </footer>
  );
}
