/**
 * Главная страница дашборда (по референсу first_page)
 *
 * Структура:
 * 1. Фильтры (период 7/30/90 + даты от/до, маркетплейс)
 * 2. Карточки метрик (5 основных + 2 дополнительных при пресетах)
 * 3. MarketplaceBreakdown (OZON / WB)
 * 4. Боковые фильтры + Графики (Заказы с табами, Средний чек, ДРР)
 * 5. Таблица остатков
 *
 * Логика карточек:
 * - При пресете (7d/30d/90d): 7 карточек (5 основных + Prior Period + YoY)
 * - При custom датах: 5 основных карточек (Заказы, Прибыль, ДРР, Продвижение, Op. Costs)
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { DollarSign, ShoppingCart, TrendingUp, Percent, Megaphone, BarChart3, Receipt } from 'lucide-react';
import { SummaryCard } from '../components/Dashboard/SummaryCard';
import { MarketplaceBreakdown } from '../components/Dashboard/MarketplaceBreakdown';
import { StocksTable } from '../components/Dashboard/StocksTable';
import { FilterPanel } from '../components/Shared/FilterPanel';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import {
  useDashboardSummary,
  useSalesChart,
  useStocks,
  useAdCosts,
  useProducts,
  useCostsTree,
  useUnitEconomics,
} from '../hooks/useDashboard';
import { useFiltersStore } from '../store/useFiltersStore';
import { fillDailySeriesYmd, formatCurrency, getDateRangeFromPreset } from '../lib/utils';
import type { CostsTreeResponse, Marketplace } from '../types';

// Lazy-load charts to keep initial bundle small (recharts is heavy).
const SalesChart = lazy(() =>
  import('../components/Dashboard/SalesChart').then((m) => ({ default: m.SalesChart }))
);
const AvgCheckChart = lazy(() =>
  import('../components/Dashboard/AvgCheckChart').then((m) => ({ default: m.AvgCheckChart }))
);
const DrrChart = lazy(() =>
  import('../components/Dashboard/DrrChart').then((m) => ({ default: m.DrrChart }))
);

function getSalesTotalFromCostsTree(data?: CostsTreeResponse | null): number | null {
  const tree = data?.tree ?? [];
  const salesItem = tree.find((t) => t.name === 'Продажи');
  if (!salesItem) return null;
  return salesItem.amount;
}

function getDeductionsAbsFromCostsTree(data?: CostsTreeResponse | null, marketplace?: Marketplace): number | null {
  const tree = data?.tree ?? [];
  if (!tree.length) return null;

  // В WB дереве есть положительные начисления (возмещения). "Удержания" = только отрицательные.
  const isWb = marketplace === 'wb';
  const sum = tree
    .filter((t) => t.name !== 'Продажи')
    .reduce((acc, t) => acc + (isWb ? (t.amount < 0 ? t.amount : 0) : t.amount), 0);
  return Math.abs(sum);
}

function shortCostLabel(name: string): string {
  if (name === 'Вознаграждение Ozon') return 'ком.';
  if (name === 'Услуги доставки') return 'лог.';
  if (name === 'Услуги агентов') return 'агент.';
  if (name === 'Услуги FBO') return 'FBO';
  if (name === 'Продвижение и реклама') return 'промо';

  if (name === 'Вознаграждение Вайлдберриз (ВВ)') return 'ком.';
  if (name === 'Эквайринг/Комиссии за организацию платежей') return 'экв.';
  if (name === 'Услуги по доставке товара покупателю') return 'лог.';
  if (name === 'Стоимость хранения') return 'хран.';
  if (name === 'Общая сумма штрафов') return 'штр.';

  return name;
}

function buildCostsSubtitleFromTree(data?: CostsTreeResponse | null, marketplace?: Marketplace): string | undefined {
  const tree = data?.tree ?? [];
  if (!tree.length) return undefined;

  const isWb = marketplace === 'wb';
  const costItems = tree.filter((t) => t.name !== 'Продажи');
  const filtered = isWb ? costItems.filter((t) => t.amount < 0) : costItems;
  const top = [...filtered].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 3);
  if (!top.length) return undefined;

  return top.map((t) => `${shortCostLabel(t.name)} ${formatCurrency(Math.abs(t.amount))}`).join(', ');
}

function describeRequestUrl(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const baseURL = err.config?.baseURL ?? '';
  const url = err.config?.url ?? '';
  if (!baseURL && !url) return null;
  // избегаем двойных слешей
  return `${String(baseURL).replace(/\/+$/, '')}/${String(url).replace(/^\/+/, '')}`;
}

export const DashboardPage = () => {
  const { datePreset, marketplace, customDateFrom, customDateTo } = useFiltersStore();
  const dateRange = getDateRangeFromPreset(datePreset, customDateFrom, customDateTo);

  // Фильтр товаров (боковая панель)
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>(undefined);
  const [sidebarMarketplace, setSidebarMarketplace] = useState<Marketplace>('all');

  // ОПТИМИЗАЦИЯ: visibility gating убран, т.к. RPC запросы теперь быстрые
  // и нет смысла откладывать загрузку графиков/остатков

  const filters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace,
  };

  // Фильтры для графиков (используют боковой фильтр маркетплейса)
  const chartFilters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace: sidebarMarketplace, // Используем боковой фильтр для графиков
    product_id: selectedProduct,
  };

  // Показывать ли карточки сравнения периодов
  const showPeriodComparison = datePreset !== 'custom';

  // ==================== ЗАГРУЗКА ДАННЫХ ====================
  // TODO: Включить оптимизацию после создания RPC get_costs_tree в Supabase
  // Сейчас используем стандартную логику (отдельные запросы)

  // Основной summary
  const { data: summaryData, isLoading: summaryLoading, error, refetch: refetchSummary } = useDashboardSummary(filters);

  // Флаг загрузки
  const isSummaryLoading = summaryLoading;

  // Costs-tree для Ozon и WB (отдельные запросы)
  const { data: ozonCostsTreeData, isLoading: ozonCostsTreeLoading } = useCostsTree(
    { ...filters, marketplace: 'ozon', include_children: true },
    { enabled: marketplace === 'ozon' || marketplace === 'all' }
  );
  const { data: wbCostsTreeData, isLoading: wbCostsTreeLoading } = useCostsTree(
    { ...filters, marketplace: 'wb', include_children: true },
    { enabled: marketplace === 'wb' || marketplace === 'all' }
  );

  // Для marketplace=all нужен отдельный ozon summary (для вычитания из общей выручки)
  const { data: ozonSummaryData } = useDashboardSummary(
    { ...filters, marketplace: 'ozon' },
    { enabled: marketplace === 'all' }
  );

  // Закупка: считаем по unit-economics (purchase_costs = purchase_price * qty).
  // ОПТИМИЗАЦИЯ: purchase_costs_total теперь приходит из RPC get_dashboard_summary
  const hasPurchaseCostsInSummary = typeof summaryData?.summary?.purchase_costs_total === 'number';
  const { data: unitEconomicsData } = useUnitEconomics(filters, {
    // Если summary уже содержит purchase_costs_total — unit-economics не нужен
    enabled: Boolean(summaryData) && !hasPurchaseCostsInSummary,
  });

  // Графики и остатки загружаются сразу (RPC оптимизированы)
  const chartsEnabled = true;
  const stocksEnabled = true;

  const { data: chartData, isLoading: chartLoading, refetch: refetchChart } = useSalesChart(chartFilters, {
    enabled: chartsEnabled,
  });

  const { data: adCostsData, isLoading: adCostsLoading, refetch: refetchAdCosts } = useAdCosts(chartFilters, {
    enabled: chartsEnabled,
  });

  const { data: stocksData, isLoading: stocksLoading, refetch: refetchStocks } = useStocks(marketplace, {
    enabled: stocksEnabled,
  });

  // Товары для бокового фильтра (используем sidebarMarketplace)
  const { data: productsData } = useProducts(sidebarMarketplace);
  const sidebarProducts = useMemo(() => {
    // Системный WB_ACCOUNT — это не товар; убираем из пользовательского списка.
    return (productsData?.products ?? []).filter((p) => p.barcode !== 'WB_ACCOUNT');
  }, [productsData]);

  useEffect(() => {
    // Защита: если WB_ACCOUNT был выбран ранее и потом скрыт — сбрасываем фильтр, чтобы не было "невидимой фильтрации".
    const isSelectedSystem =
      !!selectedProduct && !!productsData?.products?.some((p) => p.id === selectedProduct && p.barcode === 'WB_ACCOUNT');
    if (isSelectedSystem) setSelectedProduct(undefined);
  }, [selectedProduct, productsData]);

  // Обработчик обновления данных
  const handleRefresh = () => {
    refetchSummary();
    // Важно: disabled queries всё равно можно рефетчить вручную — но это даёт "лавину".
    // Поэтому рефетчим только то, что уже включено/видимо.
    if (chartsEnabled) {
      refetchChart();
      refetchAdCosts();
    }
    if (stocksEnabled) {
      refetchStocks();
    }
  };

  // IMPORTANT: hooks must run before any early returns.
  const salesChartSeries = useMemo(() => {
    const raw = chartData?.data ?? [];
    if (!raw.length) return raw as any[];

    // Последний реально присутствующий день в данных (YYYY-MM-DD).
    // После него "нули" чаще означают задержку/неполноту, поэтому для конца периода рисуем gap (null), но дни на оси оставляем.
    const lastActual = raw.reduce<string>((max, p) => (p.date > max ? p.date : max), raw[0].date);

    return fillDailySeriesYmd(
      { from: dateRange.from, to: dateRange.to },
      raw,
      (date) => ({
        date,
        orders: 0,
        sales: 0,
        revenue: 0,
        avg_check: 0,
        __plotNull: date > lastActual, // только хвост после последней фактической даты
      }) as any
    ).map((p: any) => ({
      ...p,
      __plotNull: Boolean(p.__plotNull),
      ordersPlot: p.__plotNull ? null : (p.orders ?? 0),
      salesPlot: p.__plotNull ? null : (p.sales ?? 0),
      revenuePlot: p.__plotNull ? null : (p.revenue ?? 0),
    }));
  }, [chartData?.data, dateRange.from, dateRange.to]);

  const adCostsSeriesFull = useMemo(() => {
    const raw = adCostsData?.data ?? [];
    if (!raw.length) return raw as any[];
    return fillDailySeriesYmd(
      { from: dateRange.from, to: dateRange.to },
      raw as any[],
      (date) => ({ date, ad_cost: 0, revenue: 0, drr: 0, impressions: 0, clicks: 0, orders: 0 } as any)
    );
  }, [adCostsData?.data, dateRange.from, dateRange.to]);

  if (isSummaryLoading && !summaryData) {
    return <LoadingSpinner text="Загрузка данных..." />;
  }

  if (error) {
    const requestUrl = describeRequestUrl(error);
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Ошибка загрузки данных: {(error as Error).message}</p>
          {requestUrl && (
            <p className="text-sm text-red-700 mt-2 break-all">
              Запрос: {requestUrl}
              {typeof status === 'number' ? ` (HTTP ${status})` : ''}
            </p>
          )}
          <p className="text-sm text-red-600 mt-2">
            Проверьте: backend запущен, `VITE_API_URL` корректен, CORS не блокирует запрос.
          </p>
        </div>
      </div>
    );
  }

  // Данные из summary (оптимизация отключена, используем стандартный запрос)
  const summary = summaryData?.summary;
  const previousPeriod = summaryData?.previous_period;
  const revenueChange = previousPeriod?.revenue_change_percent || 0;

  // TODO: включить когда RPC get_costs_tree будет создан в Supabase
  // const adjustedRevenue = summaryWithPrevData?.adjusted_revenue;

  const purchaseCostsForTile =
    (typeof summary?.purchase_costs_total === 'number' ? summary.purchase_costs_total : null) ??
    (unitEconomicsData?.products?.reduce((acc, p) => acc + (p.metrics.purchase_costs || 0), 0) ?? 0);

  const payoutForTile = (() => {
    if (marketplace === 'ozon') return ozonCostsTreeData?.total_accrued ?? null;
    if (marketplace === 'wb') return wbCostsTreeData?.total_accrued ?? null;
    if (marketplace === 'all') {
      const oz = ozonCostsTreeData?.total_accrued ?? null;
      const wb = wbCostsTreeData?.total_accrued ?? null;
      if (oz === null || wb === null) return null;
      return oz + wb;
    }
    return null;
  })();

  const revenueForTile = (() => {
    if (!summary) return 0;

    // marketplace=ozon: полностью берём из costs-tree (истина как в ЛК).
    if (marketplace === 'ozon') {
      const ozonTruth = getSalesTotalFromCostsTree(ozonCostsTreeData);
      return ozonTruth ?? summary.revenue;
    }

    // marketplace=all: заменяем только Ozon-часть на costs-tree.
    if (marketplace === 'all') {
      const ozonSalesFromSummary = ozonSummaryData?.summary?.revenue ?? 0;
      const ozonTruth = getSalesTotalFromCostsTree(ozonCostsTreeData) ?? ozonSalesFromSummary;
      return summary.revenue - ozonSalesFromSummary + ozonTruth;
    }

    // marketplace=wb (и любые будущие): оставляем как есть (mp_sales).
    return summary.revenue;
  })();

  const prevRevenueForTile = previousPeriod?.revenue ?? 0;

  const revenueChangeForTile = (() => {
    if (!showPeriodComparison) return revenueChange;
    if (!prevRevenueForTile) return 0;
    return Math.round(((revenueForTile - prevRevenueForTile) / prevRevenueForTile) * 1000) / 10;
  })();

  const adCostForTile = summary?.ad_cost ?? 0;
  const drrForTile = revenueForTile > 0 ? Math.round((adCostForTile / revenueForTile) * 1000) / 10 : 0;

  const mpDeductionsForTile = (() => {
    if (marketplace === 'ozon') return getDeductionsAbsFromCostsTree(ozonCostsTreeData, 'ozon') ?? summary?.total_costs ?? 0;
    if (marketplace === 'wb') return getDeductionsAbsFromCostsTree(wbCostsTreeData, 'wb') ?? summary?.total_costs ?? 0;
    if (marketplace === 'all') {
      const oz = getDeductionsAbsFromCostsTree(ozonCostsTreeData, 'ozon');
      const wb = getDeductionsAbsFromCostsTree(wbCostsTreeData, 'wb');
      if (oz === null || wb === null) return summary?.total_costs ?? 0;
      return oz + wb;
    }
    return summary?.total_costs ?? 0;
  })();

  const mpDeductionsSubtitle = (() => {
    if (marketplace === 'ozon') return buildCostsSubtitleFromTree(ozonCostsTreeData, 'ozon');
    if (marketplace === 'wb') return buildCostsSubtitleFromTree(wbCostsTreeData, 'wb');
    if (marketplace === 'all') {
      const oz = buildCostsSubtitleFromTree(ozonCostsTreeData, 'ozon');
      const wb = buildCostsSubtitleFromTree(wbCostsTreeData, 'wb');
      if (!oz && !wb) return undefined;
      if (oz && wb) return `oz: ${oz}, wb: ${wb}`;
      return oz ? `oz: ${oz}` : `wb: ${wb}`;
    }
    return undefined;
  })();

  const netProfitForTile = (() => {
    if (!summary) return 0;

    // Истина по начислениям:
    // - Ozon: total_accrued = "Начислено за период" (Продажи + расходы)
    // - WB: total_accrued = "К перечислению за период"
    // Прибыль в нашей модели: payout - закупка - реклама.
    const ad = summary.ad_cost ?? 0;

    // Fallback: если по какой-то причине нет дерева — используем backend summary (лучше чем 0).
    if (payoutForTile === null) {
      return summary.net_profit;
    }

    return payoutForTile - purchaseCostsForTile - ad;
  })();

  // Количество колонок зависит от наличия карточек сравнения
  const gridCols = showPeriodComparison ? 'lg:grid-cols-8' : 'lg:grid-cols-6';

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
      {/* 1. Фильтры */}
      <FilterPanel onRefresh={handleRefresh} isRefreshing={isSummaryLoading || (chartsEnabled ? chartLoading : false)} />

      {/* 2. Карточки метрик */}
      <div className={`grid grid-cols-2 md:grid-cols-3 ${gridCols} gap-2 mb-8`}>
        {/* Всегда видимые карточки (6 шт) */}
        <SummaryCard
          title="Продажи"
          value={revenueForTile}
          format="currency"
          subtitle={`${summary?.sales || 0} выкупов`}
          tooltip={[
            'Продажи (как в ЛК начислений)',
            "WB: денежная выручка из фин.отчёта (mp_sales.revenue).",
            "Ozon: 'Продажи' из costs-tree = Выручка + Баллы + Партнёры.",
            ozonCostsTreeData?.warnings?.length ? `⚠ ${ozonCostsTreeData.warnings[0]}` : '',
            ozonCostsTreeData?.source ? `source: ${ozonCostsTreeData.source}` : '',
          ]
            .filter(Boolean)
            .join('\n')}
          icon={ShoppingCart}
          loading={isSummaryLoading}
        />
        <SummaryCard
          title="Прибыль"
          value={netProfitForTile}
          format="currency"
          subtitle={revenueForTile ? `${((netProfitForTile / revenueForTile) * 100).toFixed(1)}%` : '0%'}
          tooltip={
            summary
              ? [
                  `Прибыль (оценка)`,
                  `Формула: прибыль = payout − закупка − реклама`,
                  `payout (costs-tree.total_accrued): ${payoutForTile === null ? '—' : formatCurrency(payoutForTile)}`,
                  `закупка (unit-economics.purchase_costs): ${formatCurrency(purchaseCostsForTile)}`,
                  `реклама (summary.ad_cost): ${formatCurrency(summary.ad_cost ?? 0)}`,
                  `итог: ${formatCurrency(netProfitForTile)}`,
                ].join('\n')
              : undefined
          }
          icon={DollarSign}
          loading={isSummaryLoading}
        />
        <SummaryCard
          title="ДРР"
          value={drrForTile}
          format="percent"
          tooltip={[
            'ДРР',
            'Формула: Ads API / Продажи * 100%.',
            'Важно: не включает "Бонусы продавца" из удержаний МП.',
          ].join('\n')}
          icon={Percent}
          loading={isSummaryLoading}
        />
        <SummaryCard
          title="Реклама"
          value={adCostForTile}
          format="currency"
          tooltip={[
            'Реклама (Ads API)',
            'WB: расходы из WB Ads.',
            'Ozon: расходы из Ozon Performance (если синхронизировано).',
            'Не равно "Продвижение и реклама / Бонусы продавца" в удержаниях.',
          ].join('\n')}
          icon={Megaphone}
          loading={isSummaryLoading}
        />
        <SummaryCard
          title="Расх. МП"
          value={mpDeductionsForTile}
          format="currency"
          subtitle={mpDeductionsSubtitle}
          tooltip={[
            'Расходы МП = Удержания МП',
            'Берётся из costs-tree (как в карточках OZON/WB).',
            'Должно совпадать с "Удержания" в блоке начислений за тот же период.',
          ].join('\n')}
          icon={Receipt}
          loading={isSummaryLoading}
        />
        <SummaryCard
          title="К перечисл."
          value={payoutForTile ?? 0}
          format="currency"
          tooltip={[
            'К перечислению / Начислено',
            "Ozon: 'Начислено за период' (costs-tree.total_accrued).",
            "WB: 'К перечислению за период' (costs-tree.total_accrued).",
          ].join('\n')}
          icon={BarChart3}
          loading={isSummaryLoading}
        />

        {/* Карточки сравнения периодов - только при пресетах 7/30/90 */}
        {showPeriodComparison && (
          <>
            <SummaryCard
              title="Пред. пер."
              value={prevRevenueForTile}
              format="currency"
              subtitle={`${previousPeriod?.orders || 0} заказов`}
              tooltip="Продажи за предыдущий период той же длительности."
              icon={BarChart3}
              loading={isSummaryLoading}
            />
            <SummaryCard
              title="Δ к пред."
              value={`${revenueChangeForTile > 0 ? '+' : ''}${revenueChangeForTile}%`}
              icon={TrendingUp}
              isPositive={revenueChangeForTile >= 0}
              tooltip="Изменение продаж относительно предыдущего периода (а не YoY)."
              loading={isSummaryLoading}
            />
          </>
        )}
      </div>

      {/* 3. MarketplaceBreakdown (OZON / WB) */}
      {/* ОПТИМИЗАЦИЯ: передаём данные costs-tree через props, чтобы избежать дублирования запросов */}
      <MarketplaceBreakdown
        filters={filters}
        ozonCostsTree={ozonCostsTreeData}
        ozonCostsTreeLoading={ozonCostsTreeLoading}
        wbCostsTree={wbCostsTreeData}
        wbCostsTreeLoading={wbCostsTreeLoading}
      />

      {/* 4. Графики с боковыми фильтрами */}
      <div className="flex flex-row gap-3 lg:gap-4 mb-6 lg:mb-8">
        {/* Боковая панель фильтров - всегда слева (как на десктопе) */}
        <div className="w-28 sm:w-32 lg:w-36 flex-shrink-0 space-y-2 sm:space-y-3">
          {/* Фильтр маркетплейса */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 sm:p-3">
            <h4 className="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase mb-1.5 sm:mb-2">МП</h4>
            <div className="space-y-1 sm:space-y-1.5">
              {(['all', 'wb', 'ozon'] as Marketplace[]).map((mp) => (
                <label key={mp} className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sidebar-mp"
                    checked={sidebarMarketplace === mp}
                    onChange={() => setSidebarMarketplace(mp)}
                    className="w-3 h-3 text-indigo-600"
                  />
                  <span className="text-[11px] sm:text-xs text-gray-700">
                    {mp === 'all' ? 'все' : mp === 'wb' ? 'WB' : 'OZON'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Фильтр товаров */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 sm:p-3">
            <h4 className="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase mb-1.5 sm:mb-2">Товары</h4>
            <div className="space-y-1 sm:space-y-1.5 max-h-32 sm:max-h-48 overflow-y-auto">
              <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sidebar-product"
                  checked={!selectedProduct}
                  onChange={() => setSelectedProduct(undefined)}
                  className="w-3 h-3 text-indigo-600"
                />
                <span className="text-[11px] sm:text-xs text-gray-700">все</span>
              </label>
              {sidebarProducts.map((product, idx) => (
                <label key={product.id} className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sidebar-product"
                    checked={selectedProduct === product.id}
                    onChange={() => setSelectedProduct(product.id)}
                    className="w-3 h-3 text-indigo-600"
                  />
                  <span className="text-[11px] sm:text-xs text-gray-700 truncate" title={product.name}>
                    {idx + 1}. {product.name.slice(0, 8)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Графики */}
        <div className="flex-1 min-w-0 space-y-4 lg:space-y-6">
          <Suspense
            fallback={
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <div className="animate-pulse">
                      <div className="h-5 bg-gray-200 rounded w-1/4 mb-6" />
                      <div className="h-48 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            {/* График заказов с табами */}
            <SalesChart data={salesChartSeries as any} isLoading={!chartsEnabled || chartLoading} />

            {/* График Средний чек */}
            <AvgCheckChart data={salesChartSeries as any} isLoading={!chartsEnabled || chartLoading} />

            {/* График ДРР */}
            <DrrChart data={adCostsSeriesFull as any} isLoading={!chartsEnabled || adCostsLoading} />
          </Suspense>
        </div>
      </div>

      {/* 5. Таблица остатков */}
      <div className="mb-8">
        <StocksTable
          stocks={stocksData?.stocks || []}
          isLoading={!stocksEnabled || stocksLoading}
        />
      </div>
    </div>
  );
};
