/**
 * Страница для печати / PDF экспорта
 * Открывается Playwright'ом для генерации красивого PDF
 *
 * Структура (4 страницы):
 * 1. Executive Summary — KPI с Δ%, карточки OZON/WB, структура расходов
 * 2. Продажи по дням — таблица динамики продаж
 * 3. Unit-экономика — прибыльность товаров
 * 4. Реклама — метрики и таблица по дням
 */
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import { formatCurrency, formatPercent, formatNumber, formatDate } from '../lib/utils';
import { eachDayOfInterval, parseISO, format } from 'date-fns';
import type {
  CostsTreeResponse,
  UnitEconomicsItem,
  StockItem,
  SalesChartDataPoint,
  AdCostsChartDataPoint,
} from '../types';

/**
 * Заполняет пропущенные даты нулями.
 * API возвращает только дни с данными, а нам нужен полный диапазон.
 */
function fillMissingSalesDates(
  data: SalesChartDataPoint[],
  dateFrom: string,
  dateTo: string
): SalesChartDataPoint[] {
  if (!dateFrom || !dateTo) return data;

  try {
    const startDate = parseISO(dateFrom);
    const endDate = parseISO(dateTo);
    const allDates = eachDayOfInterval({ start: startDate, end: endDate });

    // Создаём map существующих данных
    const dataMap = new Map(data.map((d) => [d.date, d]));

    // Генерируем полный диапазон
    return allDates.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return (
        dataMap.get(dateStr) ?? {
          date: dateStr,
          orders: 0,
          sales: 0,
          revenue: 0,
          avg_check: 0,
        }
      );
    });
  } catch {
    return data;
  }
}

/**
 * Заполняет пропущенные даты для рекламы.
 */
function fillMissingAdDates(
  data: AdCostsChartDataPoint[],
  dateFrom: string,
  dateTo: string
): AdCostsChartDataPoint[] {
  if (!dateFrom || !dateTo) return data;

  try {
    const startDate = parseISO(dateFrom);
    const endDate = parseISO(dateTo);
    const allDates = eachDayOfInterval({ start: startDate, end: endDate });

    const dataMap = new Map(data.map((d) => [d.date, d]));

    return allDates.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return (
        dataMap.get(dateStr) ?? {
          date: dateStr,
          ad_cost: 0,
          revenue: 0,
          drr: 0,
          impressions: 0,
          clicks: 0,
          orders: 0,
        }
      );
    });
  } catch {
    return data;
  }
}

export function PrintPage() {
  const [searchParams] = useSearchParams();

  // Если Playwright передал JWT через URL — используем его для API запросов
  const tokenFromUrl = searchParams.get('token');
  if (tokenFromUrl) {
    window.__PDF_TOKEN = tokenFromUrl;
  }

  const dateFrom = searchParams.get('from') || '';
  const dateTo = searchParams.get('to') || '';
  const marketplace = (searchParams.get('marketplace') || 'all') as 'all' | 'ozon' | 'wb';

  // Загружаем данные с предыдущим периодом для Δ%
  const { data: summaryWithPrev, isLoading: summaryLoading } = useQuery({
    queryKey: ['print-summary-prev', dateFrom, dateTo, marketplace],
    queryFn: () =>
      dashboardApi.getSummaryWithPrev({ date_from: dateFrom, date_to: dateTo, marketplace }),
    enabled: !!dateFrom && !!dateTo,
  });

  const { data: ozonTree, isLoading: ozonLoading } = useQuery({
    queryKey: ['print-costs-tree-ozon', dateFrom, dateTo],
    queryFn: () =>
      dashboardApi.getCostsTree({
        date_from: dateFrom,
        date_to: dateTo,
        marketplace: 'ozon',
        include_children: false,
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
        include_children: false,
      }),
    enabled: !!dateFrom && !!dateTo && (marketplace === 'all' || marketplace === 'wb'),
  });

  const { data: salesChart, isLoading: salesLoading } = useQuery({
    queryKey: ['print-sales-chart', dateFrom, dateTo, marketplace],
    queryFn: () =>
      dashboardApi.getSalesChart({ date_from: dateFrom, date_to: dateTo, marketplace }),
    enabled: !!dateFrom && !!dateTo,
  });

  const { data: unitEconomics, isLoading: ueLoading } = useQuery({
    queryKey: ['print-unit-economics', dateFrom, dateTo, marketplace],
    queryFn: () =>
      dashboardApi.getUnitEconomics({ date_from: dateFrom, date_to: dateTo, marketplace }),
    enabled: !!dateFrom && !!dateTo,
  });

  const { data: stocks, isLoading: stocksLoading } = useQuery({
    queryKey: ['print-stocks', marketplace],
    queryFn: () => dashboardApi.getStocks(
      marketplace === 'all' ? undefined : marketplace,
      60000 // 60 сек таймаут для PDF
    ),
    enabled: !!dateFrom && !!dateTo,
  });

  const { data: adCosts, isLoading: adsLoading } = useQuery({
    queryKey: ['print-ad-costs', dateFrom, dateTo, marketplace],
    queryFn: () =>
      dashboardApi.getAdCosts(
        { date_from: dateFrom, date_to: dateTo, marketplace },
        60000 // 60 сек таймаут для PDF
      ),
    enabled: !!dateFrom && !!dateTo,
  });

  const isLoading = summaryLoading || ozonLoading || wbLoading || salesLoading || ueLoading || stocksLoading || adsLoading;
  const periodStr = `${formatDate(dateFrom)} — ${formatDate(dateTo)}`;

  // Данные из costs-tree
  const ozonSales = ozonTree?.tree.find((c) => c.name === 'Продажи')?.amount ?? 0;
  const wbSalesBase = wbTree?.tree.find((c) => c.name === 'Продажи')?.amount ?? 0;
  // WB: СПП = все положительные суммы кроме "Продажи" (как на основном дашборде WbAccrualsCard)
  // Включает "Возмещения" + "Прочие удержания/выплаты" (положительные)
  const wbCredits = wbTree?.tree
    .filter((c) => c.name !== 'Продажи' && c.amount > 0)
    .reduce((sum, c) => sum + c.amount, 0) ?? 0;
  const wbSales = wbSalesBase + wbCredits;
  const totalRevenue = ozonSales + wbSales;

  // Удержания (все отрицательные суммы кроме "Продажи")
  const ozonDeductions = ozonTree?.tree
    .filter((c) => c.name !== 'Продажи')
    .reduce((sum, c) => sum + Math.abs(c.amount), 0) ?? 0;
  const wbDeductions = wbTree?.tree
    .filter((c) => c.name !== 'Продажи' && c.amount < 0)
    .reduce((sum, c) => sum + Math.abs(c.amount), 0) ?? 0;

  // Выкупы: берём из unit-economics (сумма sales_count по товарам) или salesChart
  const salesFromUE = unitEconomics?.products?.reduce((sum, p) => sum + p.metrics.sales_count, 0) ?? 0;
  const salesFromChart = salesChart?.data?.reduce((sum, d) => sum + d.sales, 0) ?? 0;
  const currentSales = salesFromUE > 0 ? salesFromUE : salesFromChart;
  const prevSales = summaryWithPrev?.previous_period?.sales ?? 0;

  // Закупка: берём из unit-economics (сумма purchase_costs по товарам)
  const purchaseFromUE = unitEconomics?.products?.reduce((sum, p) => sum + p.metrics.purchase_costs, 0) ?? 0;
  const purchaseCosts = purchaseFromUE > 0 ? purchaseFromUE : (summaryWithPrev?.summary?.purchase_costs_total ?? 0);

  // Прибыль = К перечислению - Закупка - Реклама (как в основном дашборде)
  const totalPayout = (ozonTree?.total_accrued ?? 0) + (wbTree?.total_accrued ?? 0);
  const adCost = adCosts?.totals?.ad_cost ?? 0;
  const calculatedProfit = totalPayout - purchaseCosts - adCost;

  // Средний чек: выручка / выкупы
  const avgCheck = currentSales > 0 ? totalRevenue / currentSales : 0;

  // Δ% к предыдущему периоду
  const prevRevenue = summaryWithPrev?.previous_period?.revenue ?? 0;
  const revenueChange = prevRevenue > 0
    ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
    : 0;

  const salesChange = prevSales > 0
    ? ((currentSales - prevSales) / prevSales) * 100
    : 0;

  // Сортировка товаров по прибыли
  const sortedProducts = [...(unitEconomics?.products ?? [])].sort(
    (a, b) => b.metrics.net_profit - a.metrics.net_profit
  );

  // Агрегированные остатки по товарам
  const stocksSummary = aggregateStocks(stocks?.stocks ?? []);

  // Заполняем пропущенные даты нулями
  const filledSalesData = fillMissingSalesDates(
    salesChart?.data ?? [],
    dateFrom,
    dateTo
  );
  const filledAdData = fillMissingAdDates(adCosts?.data ?? [], dateFrom, dateTo);

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
      {/* ============ PAGE 1: Executive Summary ============ */}
      <div className="p-8 page-break-after">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 pb-4 border-b-2 border-indigo-500">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Отчёт по маркетплейсам
            </h1>
            <p className="text-lg text-gray-500 mt-1">{periodStr}</p>
          </div>
          <div className="flex items-center gap-4">
            {(marketplace === 'all' || marketplace === 'ozon') && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500" />
                <span className="text-sm font-medium text-gray-600">OZON</span>
              </div>
            )}
            {(marketplace === 'all' || marketplace === 'wb') && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-500" />
                <span className="text-sm font-medium text-gray-600">Wildberries</span>
              </div>
            )}
          </div>
        </header>

        {/* 4 главных KPI с Δ% */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Выручка"
            value={formatCurrency(totalRevenue)}
            change={revenueChange}
            color="blue"
          />
          <KpiCard
            label="Прибыль"
            value={formatCurrency(calculatedProfit)}
            sublabel="оценка"
            color="green"
          />
          <KpiCard
            label="Выкупы"
            value={formatNumber(currentSales)}
            change={salesChange}
            color="indigo"
          />
          <KpiCard
            label="Средний чек"
            value={formatCurrency(avgCheck)}
            color="purple"
          />
        </div>

        {/* OZON / WB компактные карточки */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {(marketplace === 'all' || marketplace === 'ozon') && ozonTree && (
            <CompactMarketplaceCard
              title="OZON"
              color="blue"
              sales={ozonSales}
              accrued={ozonTree.total_accrued}
              deductions={ozonDeductions}
            />
          )}
          {(marketplace === 'all' || marketplace === 'wb') && wbTree && (
            <CompactMarketplaceCard
              title="Wildberries"
              color="purple"
              sales={wbSales}
              accrued={wbTree.total_accrued}
              deductions={wbDeductions}
            />
          )}
        </div>

        {/* Структура расходов */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Структура расходов</h2>
          <ExpenseBreakdown
            ozonTree={ozonTree}
            wbTree={wbTree}
            marketplace={marketplace}
          />
        </div>

        <PageFooter page={1} total={4} />
      </div>

      {/* ============ PAGE 2: Продажи по дням ============ */}
      <div className="p-8 page-break-after">
        <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Продажи по дням</h1>
            <p className="text-gray-500">{periodStr}</p>
          </div>
        </header>

        {/* Итоги периода */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <SummaryBox
            label="Заказы"
            value={formatNumber(salesChart?.data.reduce((s, d) => s + d.orders, 0) ?? 0)}
            color="blue"
          />
          <SummaryBox
            label="Выкупы"
            value={formatNumber(salesChart?.data.reduce((s, d) => s + d.sales, 0) ?? 0)}
            color="green"
          />
          <SummaryBox
            label="Выручка"
            value={formatCurrency(salesChart?.data.reduce((s, d) => s + d.revenue, 0) ?? 0)}
            color="indigo"
          />
          <SummaryBox
            label="Ср. чек"
            value={formatCurrency(avgCheck)}
            color="purple"
          />
          <SummaryBox
            label="% выкупа"
            value={formatPercent(
              (salesChart?.data.reduce((s, d) => s + d.orders, 0) ?? 0) > 0
                ? ((salesChart?.data.reduce((s, d) => s + d.sales, 0) ?? 0) /
                    (salesChart?.data.reduce((s, d) => s + d.orders, 0) ?? 1)) *
                    100
                : 0
            )}
            color="orange"
          />
        </div>

        {/* Таблица продаж по дням (до 31 дня = полный месяц) */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Дата</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Заказы</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Выкупы</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Выручка</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Ср. чек</th>
              </tr>
            </thead>
            <tbody>
              {filledSalesData.slice(0, 31).map((day, i) => (
                <SalesRow key={day.date} data={day} index={i} />
              ))}
            </tbody>
          </table>
          {filledSalesData.length > 31 && (
            <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50 border-t">
              + ещё {filledSalesData.length - 31} дней
            </div>
          )}
        </div>

        <PageFooter page={2} total={4} />
      </div>

      {/* ============ PAGE 3: Unit-экономика + Остатки ============ */}
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
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Выкупы</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Выручка</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Удержания</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Закупка</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Прибыль</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">На ед.</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((item, i) => (
                <UnitEconomicsRow key={item.product.id} item={item} index={i} />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td className="px-4 py-3 text-gray-900">Итого</td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {formatNumber(sortedProducts.reduce((s, i) => s + i.metrics.sales_count, 0))}
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {formatCurrency(sortedProducts.reduce((s, i) => s + i.metrics.revenue, 0))}
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {formatCurrency(sortedProducts.reduce((s, i) => s + i.metrics.mp_costs, 0))}
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {formatCurrency(sortedProducts.reduce((s, i) => s + i.metrics.purchase_costs, 0))}
                </td>
                <td className="px-4 py-3 text-right text-green-700">
                  {formatCurrency(sortedProducts.reduce((s, i) => s + i.metrics.net_profit, 0))}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">—</td>
                <td className="px-4 py-3 text-right text-gray-700">—</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Остатки на складах */}
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Остатки на складах</h3>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-50 to-teal-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Товар</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">OZON</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">WB</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Всего</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Статус</th>
              </tr>
            </thead>
            <tbody>
              {stocksSummary.map((item, i) => (
                <StockRow key={item.barcode} item={item} index={i} />
              ))}
            </tbody>
          </table>
        </div>

        <PageFooter page={3} total={4} />
      </div>

      {/* ============ PAGE 4: Реклама ============ */}
      <div className="p-8">
        <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Рекламные расходы</h1>
            <p className="text-gray-500">{periodStr}</p>
          </div>
        </header>

        {/* Метрики рекламы */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          <SummaryBox
            label="Расход"
            value={formatCurrency(adCosts?.totals.ad_cost ?? 0)}
            color="red"
          />
          <SummaryBox
            label="ДРР"
            value={formatPercent(adCosts?.totals.drr ?? 0)}
            color="orange"
          />
          <SummaryBox
            label="Показы"
            value={formatNumber(adCosts?.totals.impressions ?? 0)}
            color="blue"
          />
          <SummaryBox
            label="Клики"
            value={formatNumber(adCosts?.totals.clicks ?? 0)}
            color="indigo"
          />
          <SummaryBox
            label="CTR"
            value={formatPercent(
              adCosts?.totals.impressions
                ? (adCosts.totals.clicks / adCosts.totals.impressions) * 100
                : 0
            )}
            color="purple"
          />
          <SummaryBox
            label="Заказы"
            value={formatNumber(adCosts?.totals.orders ?? 0)}
            color="green"
          />
        </div>

        {/* Таблица по дням (до 31 дня = полный месяц) */}
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
                <th className="px-4 py-3 text-right font-semibold text-gray-700">CTR</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Заказы</th>
              </tr>
            </thead>
            <tbody>
              {filledAdData.slice(0, 31).map((day, i) => (
                <AdRow key={day.date} data={day} index={i} />
              ))}
            </tbody>
          </table>
          {filledAdData.length > 31 && (
            <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50 border-t">
              + ещё {filledAdData.length - 31} дней
            </div>
          )}
        </div>

        <PageFooter page={4} total={4} />
      </div>
    </div>
  );
}

// ==================== Helper Components ====================

function KpiCard({
  label,
  value,
  change,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  change?: number;
  sublabel?: string;
  color: 'blue' | 'green' | 'indigo' | 'purple';
}) {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    green: 'from-green-50 to-emerald-100 border-green-200',
    indigo: 'from-indigo-50 to-indigo-100 border-indigo-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200',
  };

  const hasChange = change !== undefined && change !== 0;
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className={`rounded-xl border p-4 bg-gradient-to-br ${colorClasses[color]}`}>
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sublabel && (
        <div className="text-xs text-gray-500 mt-1">{sublabel}</div>
      )}
      {hasChange && (
        <div className={`text-sm font-medium mt-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '↑' : '↓'} {formatPercent(Math.abs(change!))} к пред. периоду
        </div>
      )}
    </div>
  );
}

function SummaryBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'red' | 'orange' | 'blue' | 'indigo' | 'green' | 'purple';
}) {
  const colorClasses = {
    red: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200',
    orange: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200',
    blue: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200',
    indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200',
    green: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200',
    purple: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200',
  };

  return (
    <div className={`rounded-xl border p-3 ${colorClasses[color]}`}>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-600 mt-1">{label}</div>
    </div>
  );
}

function CompactMarketplaceCard({
  title,
  color,
  sales,
  accrued,
  deductions,
}: {
  title: string;
  color: 'blue' | 'purple';
  sales: number;
  accrued: number;
  deductions: number;
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
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-5`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-3 h-3 rounded-full ${c.accent}`} />
        <h2 className={`text-xl font-bold ${c.title}`}>{title}</h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(sales)}
          </div>
          <div className="text-sm text-gray-500">Продажи</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(deductions)}
          </div>
          <div className="text-sm text-gray-500">Удержания</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(accrued)}
          </div>
          <div className="text-sm text-gray-500">Начислено</div>
        </div>
      </div>
    </div>
  );
}

function ExpenseBreakdown({
  ozonTree,
  wbTree,
  marketplace,
}: {
  ozonTree?: CostsTreeResponse | null;
  wbTree?: CostsTreeResponse | null;
  marketplace: 'all' | 'ozon' | 'wb';
}) {
  const categories: { name: string; ozon: number; wb: number }[] = [];

  const ozonItems = ozonTree?.tree.filter((c) => c.name !== 'Продажи') ?? [];
  const wbItems = wbTree?.tree.filter((c) => c.name !== 'Продажи') ?? [];

  const allNames = new Set([
    ...ozonItems.map((c) => c.name),
    ...wbItems.map((c) => c.name),
  ]);

  allNames.forEach((name) => {
    const ozonVal = ozonItems.find((c) => c.name === name)?.amount ?? 0;
    const wbVal = wbItems.find((c) => c.name === name)?.amount ?? 0;
    categories.push({ name, ozon: Math.abs(ozonVal), wb: Math.abs(wbVal) });
  });

  categories.sort((a, b) => (b.ozon + b.wb) - (a.ozon + a.wb));

  const total = categories.reduce((s, c) => s + c.ozon + c.wb, 0);

  return (
    <div className="space-y-3">
      {categories.slice(0, 6).map((cat) => {
        const catTotal = cat.ozon + cat.wb;
        const percent = total > 0 ? (catTotal / total) * 100 : 0;
        const ozonPercent = catTotal > 0 ? (cat.ozon / catTotal) * 100 : 0;

        return (
          <div key={cat.name} className="flex items-center gap-4">
            <div className="w-32 text-sm text-gray-700 truncate">{cat.name}</div>
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden flex">
                {marketplace !== 'wb' && cat.ozon > 0 && (
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${ozonPercent}%` }}
                  />
                )}
                {marketplace !== 'ozon' && cat.wb > 0 && (
                  <div
                    className="h-full bg-purple-500"
                    style={{ width: `${100 - ozonPercent}%` }}
                  />
                )}
              </div>
            </div>
            <div className="w-20 text-right text-sm font-medium text-gray-900">
              {formatCurrency(catTotal)}
            </div>
            <div className="w-12 text-right text-sm text-gray-500">
              {formatPercent(percent)}
            </div>
          </div>
        );
      })}
      {categories.length > 6 && (
        <div className="text-sm text-gray-500 pt-2">
          + ещё {categories.length - 6} категорий
        </div>
      )}
    </div>
  );
}

function SalesRow({ data, index }: { data: SalesChartDataPoint; index: number }) {
  return (
    <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-4 py-2.5 text-gray-900 font-medium">
        {formatDate(data.date)}
      </td>
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatNumber(data.orders)}
      </td>
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatNumber(data.sales)}
      </td>
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatCurrency(data.revenue)}
      </td>
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatCurrency(data.avg_check)}
      </td>
    </tr>
  );
}

function UnitEconomicsRow({ item, index }: { item: UnitEconomicsItem; index: number }) {
  const margin =
    item.metrics.revenue > 0
      ? (item.metrics.net_profit / item.metrics.revenue) * 100
      : 0;

  return (
    <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-4 py-3 text-gray-900 font-medium truncate max-w-[180px]">
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

function AdRow({ data, index }: { data: AdCostsChartDataPoint; index: number }) {
  const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;

  return (
    <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-4 py-2.5 text-gray-900 font-medium">
        {formatDate(data.date)}
      </td>
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatCurrency(data.ad_cost)}
      </td>
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatCurrency(data.revenue)}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span
          className={
            data.drr > 20
              ? 'text-red-600'
              : data.drr > 10
              ? 'text-orange-600'
              : 'text-green-600'
          }
        >
          {formatPercent(data.drr)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatNumber(data.impressions)}
      </td>
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatNumber(data.clicks)}
      </td>
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatPercent(ctr)}
      </td>
      <td className="px-4 py-2.5 text-right text-gray-700">
        {formatNumber(data.orders)}
      </td>
    </tr>
  );
}

interface StockSummaryItem {
  name: string;
  barcode: string;
  ozon: number;
  wb: number;
  total: number;
  status: 'ok' | 'low' | 'oos';
}

function aggregateStocks(stocks: StockItem[]): StockSummaryItem[] {
  return stocks.map((s) => {
    const ozon = s.warehouses
      .filter((w) => w.marketplace === 'ozon')
      .reduce((sum, w) => sum + w.quantity, 0);
    const wb = s.warehouses
      .filter((w) => w.marketplace === 'wb')
      .reduce((sum, w) => sum + w.quantity, 0);
    const total = ozon + wb;

    let status: 'ok' | 'low' | 'oos' = 'ok';
    if (total === 0) status = 'oos';
    else if (total < 10) status = 'low';

    return {
      name: s.product_name,
      barcode: s.barcode,
      ozon,
      wb,
      total,
      status,
    };
  });
}

function StockRow({ item, index }: { item: StockSummaryItem; index: number }) {
  const statusStyles = {
    ok: 'bg-green-100 text-green-800',
    low: 'bg-yellow-100 text-yellow-800',
    oos: 'bg-red-100 text-red-800',
  };

  const statusLabels = {
    ok: 'OK',
    low: 'Мало',
    oos: 'Нет',
  };

  return (
    <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-4 py-3 text-gray-900 font-medium truncate max-w-[200px]">
        {item.name}
      </td>
      <td className="px-4 py-3 text-center text-gray-700">
        {item.ozon > 0 ? formatNumber(item.ozon) : '—'}
      </td>
      <td className="px-4 py-3 text-center text-gray-700">
        {item.wb > 0 ? formatNumber(item.wb) : '—'}
      </td>
      <td className="px-4 py-3 text-center font-semibold text-gray-900">
        {formatNumber(item.total)}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[item.status]}`}>
          {statusLabels[item.status]}
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
