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
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ShoppingCart, ShoppingBag, TrendingUp, Megaphone, Banknote, Receipt, Package, AlertTriangle, X } from 'lucide-react';
import { useExport } from '../hooks/useExport';
import { useSubscription } from '../hooks/useSubscription';
import type { ExcelExportData } from '../lib/exportExcel';
import { SummaryCard } from '../components/Dashboard/SummaryCard';
import { MarketplaceBreakdown } from '../components/Dashboard/MarketplaceBreakdown';
import { StocksTable } from '../components/Dashboard/StocksTable';
import { ProfitWaterfall } from '../components/Dashboard/ProfitWaterfall';
import { TopProductsChart } from '../components/Dashboard/TopProductsChart';
import { CostsDonutChart } from '../components/Dashboard/CostsDonutChart';
import { StockForecastChart } from '../components/Dashboard/StockForecastChart';
import { StockHistoryChart } from '../components/Dashboard/StockHistoryChart';
import { PlanCompletionCard } from '../components/Dashboard/PlanCompletionCard';
import { FeatureGate } from '../components/Shared/FeatureGate';
import { FilterPanel } from '../components/Shared/FilterPanel';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import {
  useDashboardSummaryWithPrev,
  useSalesChart,
  useStocks,
  useAdCosts,
  useProducts,
  useCostsTree,
  useUnitEconomics,
} from '../hooks/useDashboard';
import { useFiltersStore } from '../store/useFiltersStore';
import { fillDailySeriesYmd, formatCurrency, formatNumber, getDateRangeFromPreset } from '../lib/utils';
import { useSalesPlanCompletion } from '../hooks/useSalesPlan';
import type { CostsTreeResponse, Marketplace, MpProfitData } from '../types';

// Lazy-load charts to keep initial bundle small (recharts is heavy).
const SalesChart = lazy(() =>
  import('../components/Dashboard/SalesChart').then((m) => ({ default: m.SalesChart }))
);
const ProfitChart = lazy(() =>
  import('../components/Dashboard/ProfitChart').then((m) => ({ default: m.ProfitChart }))
);
const DrrChart = lazy(() =>
  import('../components/Dashboard/DrrChart').then((m) => ({ default: m.DrrChart }))
);
const ConversionChart = lazy(() =>
  import('../components/Dashboard/ConversionChart').then((m) => ({ default: m.ConversionChart }))
);

/** Выручка = tree "Продажи" + positive credits (СПП, возмещения и т.д.) */
function getSalesTotalFromCostsTree(data?: CostsTreeResponse | null): number | null {
  const tree = data?.tree ?? [];
  const salesItem = tree.find((t) => t.name === 'Продажи');
  if (!salesItem) return null;
  // Credits: положительные items кроме "Продажи" (WB: СПП, возмещения)
  const credits = tree
    .filter((t) => t.name !== 'Продажи' && t.amount > 0)
    .reduce((acc, t) => acc + t.amount, 0);
  return salesItem.amount + credits;
}

/** Только credits (положительные items кроме "Продажи") — для тултипа */
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
  if (name === 'Вознаграждение Ozon') return 'Комиссия';
  if (name === 'Услуги доставки') return 'Доставка';
  if (name === 'Услуги агентов') return 'Агенты';
  if (name === 'Услуги FBO') return 'FBO';
  if (name === 'Продвижение и реклама') return 'Промо';

  if (name === 'Вознаграждение Вайлдберриз (ВВ)') return 'Комиссия';
  if (name === 'Эквайринг/Комиссии за организацию платежей') return 'Эквайринг';
  if (name === 'Услуги по доставке товара покупателю') return 'Доставка';
  if (name === 'Стоимость хранения') return 'Хранение';
  if (name === 'Общая сумма штрафов') return 'Штрафы';

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

  return top.map((t) => `${shortCostLabel(t.name)} ${formatNumber(Math.round(Math.abs(t.amount)))}`).join(' · ');
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

  // Export hook
  const { isExporting, exportType, exportExcel, exportPdf } = useExport();
  const { data: subscription } = useSubscription();

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
  // Основной summary
  const { data: summaryData, isLoading: summaryLoading, error } = useDashboardSummaryWithPrev(filters);

  // Флаг загрузки
  const isSummaryLoading = summaryLoading;

  // Costs-tree для Ozon и WB (отдельные параллельные запросы)
  // АРХИТЕКТУРНОЕ РЕШЕНИЕ: используем отдельные запросы вместо combined для:
  // - Progressive rendering (показываем данные по мере загрузки)
  // - Изоляции ошибок (если один МП упал — остальные работают)
  // - Масштабируемости (при добавлении 3+ маркетплейсов)
  // - Гибкого кэширования React Query
  const { data: ozonCostsTreeData, isLoading: ozonCostsTreeLoading } = useCostsTree(
    { ...filters, marketplace: 'ozon', include_children: true },
    { enabled: marketplace === 'ozon' || marketplace === 'all' }
  );
  const { data: wbCostsTreeData, isLoading: wbCostsTreeLoading } = useCostsTree(
    { ...filters, marketplace: 'wb', include_children: true },
    { enabled: marketplace === 'wb' || marketplace === 'all' }
  );

  // Закупка: считаем по unit-economics (purchase_costs = purchase_price * qty).
  // ОПТИМИЗАЦИЯ: purchase_costs_total теперь приходит из RPC get_dashboard_summary
  const { data: unitEconomicsData, isLoading: ueLoading } = useUnitEconomics(filters, {
    // Всегда загружаем: нужен для TopProductsChart + purchase fallback
    enabled: Boolean(summaryData),
  });

  // Графики и остатки загружаются сразу (RPC оптимизированы)
  const chartsEnabled = true;
  const stocksEnabled = true;

  const { data: chartData, isLoading: chartLoading } = useSalesChart(chartFilters, {
    enabled: chartsEnabled,
  });

  const { data: adCostsData, isLoading: adCostsLoading } = useAdCosts(chartFilters, {
    enabled: chartsEnabled,
  });

  const { data: stocksData, isLoading: stocksLoading } = useStocks(marketplace, {
    enabled: stocksEnabled,
  });

  // dateTo для графика остатков: всегда сегодня МСК (снимки пишутся в реальном времени)
  const stockHistoryDateTo = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });

  // План продаж — completion
  const { data: planCompletionData, isLoading: planCompletionLoading } = useSalesPlanCompletion(filters);

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

  // ── CC=0 notification ──
  const navigate = useNavigate();
  const [showCcModal, setShowCcModal] = useState(false);

  const productsWithZeroCc = useMemo(
    () => sidebarProducts.filter((p) => !p.purchase_price || p.purchase_price === 0),
    [sidebarProducts],
  );
  const hasZeroCc = productsWithZeroCc.length > 0;

  useEffect(() => {
    if (hasZeroCc && localStorage.getItem('cc-reminder-dismissed') !== 'true') {
      setShowCcModal(true);
    }
  }, [hasZeroCc]);

  const dismissCcModal = useCallback(() => {
    localStorage.setItem('cc-reminder-dismissed', 'true');
    setShowCcModal(false);
  }, []);

  const ccWarning = hasZeroCc
    ? `Без учёта себестоимости ${productsWithZeroCc.length} товаров. Заполните в настройках.`
    : undefined;

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

  // Данные из summary
  const summary = summaryData?.summary;
  const previousPeriod = summaryData?.previous_period;
  const revenueChange = previousPeriod?.revenue_change_percent || 0;

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

  // Флаг: costs-tree ещё грузится для текущего marketplace
  const isCostsTreeLoading = (() => {
    if (marketplace === 'ozon') return ozonCostsTreeLoading;
    if (marketplace === 'wb') return wbCostsTreeLoading;
    if (marketplace === 'all') return ozonCostsTreeLoading || wbCostsTreeLoading;
    return false;
  })();

  const revenueForTile = (() => {
    if (!summary) return 0;

    // marketplace=ozon: берём из costs-tree (истина как в ЛК)
    if (marketplace === 'ozon') {
      const ozonTruth = getSalesTotalFromCostsTree(ozonCostsTreeData);
      // Если costs-tree ещё грузится — не fallback, вернём 0 (покажем skeleton)
      if (ozonTruth === null) return isCostsTreeLoading ? 0 : summary.revenue;
      return ozonTruth;
    }

    // marketplace=wb: берём из costs-tree
    if (marketplace === 'wb') {
      const wbTruth = getSalesTotalFromCostsTree(wbCostsTreeData);
      if (wbTruth === null) return isCostsTreeLoading ? 0 : summary.revenue;
      return wbTruth;
    }

    // marketplace=all: сумма ozon + wb из costs-tree
    if (marketplace === 'all') {
      const ozonTruth = getSalesTotalFromCostsTree(ozonCostsTreeData);
      const wbTruth = getSalesTotalFromCostsTree(wbCostsTreeData);

      // Если оба есть — сумма
      if (ozonTruth !== null && wbTruth !== null) {
        return ozonTruth + wbTruth;
      }

      // Если один есть — берём что есть (другой может быть 0)
      if (ozonTruth !== null && !wbCostsTreeLoading) {
        return ozonTruth + (wbTruth ?? 0);
      }
      if (wbTruth !== null && !ozonCostsTreeLoading) {
        return (ozonTruth ?? 0) + wbTruth;
      }

      // Ещё грузится — вернём 0 для skeleton
      if (isCostsTreeLoading) return 0;

      // Fallback только если costs-tree полностью загрузился и пуст
      return summary.revenue;
    }

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
      const ozTotal = getDeductionsAbsFromCostsTree(ozonCostsTreeData, 'ozon');
      const wbTotal = getDeductionsAbsFromCostsTree(wbCostsTreeData, 'wb');
      if (ozTotal === null && wbTotal === null) return undefined;
      const parts: string[] = [];
      if (ozTotal !== null) parts.push(`Ozon ${formatNumber(Math.round(ozTotal))}`);
      if (wbTotal !== null) parts.push(`WB ${formatNumber(Math.round(wbTotal))}`);
      return parts.join(' · ');
    }
    return undefined;
  })();

  // Коэффициент коррекции: costs-tree ЧИСТЫЕ продажи / mp_sales (аналитика).
  // Credits (СПП) НЕ входят в ratio — они не от продаж, а компенсация от МП.
  // Ratio отражает долю проведённых заказов.
  const summaryRevenue = summary?.revenue ?? 0;
  const pureSalesForRatio = (() => {
    // Чистые "Продажи" без credits — для ratio
    const getSales = (d?: CostsTreeResponse | null) => {
      const salesItem = d?.tree?.find((t) => t.name === 'Продажи');
      return salesItem?.amount ?? 0;
    };
    if (marketplace === 'ozon') return getSales(ozonCostsTreeData);
    if (marketplace === 'wb') return getSales(wbCostsTreeData);
    return getSales(ozonCostsTreeData) + getSales(wbCostsTreeData);
  })();
  const costsTreeRatio =
    summaryRevenue > 0 && pureSalesForRatio > 0 && pureSalesForRatio < summaryRevenue
      ? pureSalesForRatio / summaryRevenue
      : 1;

  const adjustedPurchase = purchaseCostsForTile * costsTreeRatio;

  const netProfitForTile = (() => {
    if (!summary) return 0;

    const ad = summary.ad_cost ?? 0;

    // Fallback: если по какой-то причине нет дерева — используем backend summary.
    if (payoutForTile === null) {
      return summary.net_profit;
    }

    return payoutForTile - adjustedPurchase - ad;
  })();

  const salesCountForTile = Math.round((summary?.sales ?? 0) * costsTreeRatio);
  const returnsCountForTile = summary?.returns ?? 0;

  // Margin ratio for ProfitChart (daily profit estimate = daily_revenue × profitMargin)
  const profitMargin = revenueForTile > 0 ? netProfitForTile / revenueForTile : 0;

  // ── Per-marketplace profit (IIFE, not useMemo — after early returns) ──
  const ozonProfitData: MpProfitData | null = (() => {
    if (!summary || !ozonCostsTreeData) return null;
    const ozonPayout = ozonCostsTreeData.total_accrued ?? 0;
    const ozonPureSales = ozonCostsTreeData.tree?.find((t) => t.name === 'Продажи')?.amount ?? 0;
    const wbPS = wbCostsTreeData?.tree?.find((t) => t.name === 'Продажи')?.amount ?? 0;
    const totalPS = ozonPureSales + wbPS;
    const share = totalPS > 0 ? ozonPureSales / totalPS : 1;
    const purchase = adjustedPurchase * share;
    const ad = (summary.ad_cost ?? 0) * share;
    return { profit: ozonPayout - purchase - ad, purchase, ad };
  })();

  const wbProfitData: MpProfitData | null = (() => {
    if (!summary || !wbCostsTreeData) return null;
    const wbPayout = wbCostsTreeData.total_accrued ?? 0;
    const ozPS = ozonCostsTreeData?.tree?.find((t) => t.name === 'Продажи')?.amount ?? 0;
    const wbPureSales = wbCostsTreeData.tree?.find((t) => t.name === 'Продажи')?.amount ?? 0;
    const totalPS = ozPS + wbPureSales;
    const share = totalPS > 0 ? wbPureSales / totalPS : 1;
    const purchase = adjustedPurchase * share;
    const ad = (summary.ad_cost ?? 0) * share;
    return { profit: wbPayout - purchase - ad, purchase, ad };
  })();

  // ── Данные для новых карточек ──
  const ordersCountForTile = summary?.orders ?? 0;
  const ordersRevenueForTile = summary?.revenue ?? 0; // mp_sales revenue (все заказы)
  const buyoutPercent = ordersCountForTile > 0 ? Math.round((salesCountForTile / ordersCountForTile) * 100) : 0;

  // Средняя себестоимость за единицу
  const avgCcPerUnit = salesCountForTile > 0 ? adjustedPurchase / salesCountForTile : 0;

  // Change badges (period comparison integrated into cards)
  const prevRevenue = previousPeriod?.revenue ?? 0;
  const prevOrders = previousPeriod?.orders ?? 0;
  const canShowChange = showPeriodComparison && subscription?.features?.period_comparison;
  const revenueChangePct = canShowChange && prevRevenue > 0
    ? Math.round(((revenueForTile - prevRevenue) / prevRevenue) * 1000) / 10
    : undefined;
  const ordersChangePct = canShowChange && prevOrders > 0
    ? Math.round(((ordersCountForTile - prevOrders) / prevOrders) * 1000) / 10
    : undefined;

  // ==================== EXPORT HANDLERS ====================
  const handleExportExcel = () => {
    const exportData: ExcelExportData = {
      summary: summary ?? null,
      period: dateRange,
      marketplace,
      salesChart: chartData?.data ?? [],
      adCosts: adCostsData?.data ?? [],
      ozonCostsTree: ozonCostsTreeData ?? null,
      wbCostsTree: wbCostsTreeData ?? null,
      unitEconomics: unitEconomicsData?.products ?? [],
      stocks: stocksData?.stocks ?? [],
    };
    exportExcel(exportData);
  };

  const handleExportPdf = () => {
    exportPdf({
      period: dateRange,
      marketplace,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
      {/* CC=0 reminder modal */}
      {showCcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={dismissCcModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900">Себестоимость не заполнена</h3>
              </div>
              <button onClick={dismissCcModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Для точного расчёта прибыли заполните себестоимость товаров.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Товары без CC: {productsWithZeroCc.slice(0, 3).map((p) => p.name).join(', ')}
              {productsWithZeroCc.length > 3 && ` и ещё ${productsWithZeroCc.length - 3}`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={dismissCcModal}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Позже
              </button>
              <button
                onClick={() => { dismissCcModal(); navigate('/settings?tab=products'); }}
                className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Перейти в настройки
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Фильтры */}
      <FilterPanel
        onExportExcel={handleExportExcel}
        onExportPdf={subscription?.features?.pdf_export ? handleExportPdf : undefined}
        isExporting={isExporting}
        exportType={exportType}
      />

      {/* 2. Карточки метрик — Enterprise 4×2 grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-4 sm:mb-5 lg:mb-6">

        {/* ── Row 1: Воронка продаж ── */}

        {/* 1. Заказы — все заказы за период */}
        <SummaryCard
          title="Заказы"
          value={ordersCountForTile}
          format="number"
          secondaryValue={formatCurrency(ordersRevenueForTile)}
          subtitle={returnsCountForTile > 0 ? `${returnsCountForTile} возвр.` : undefined}
          tooltip={[
            'Все заказы за период (вкл. непроведённые).',
            'Источник: mp_sales (аналитика МП).',
            `Заказов: ${ordersCountForTile} шт на ${formatCurrency(ordersRevenueForTile)}`,
            returnsCountForTile > 0
              ? `Возвраты: ${returnsCountForTile} шт (${Math.round((returnsCountForTile / ordersCountForTile) * 100)}%)`
              : undefined,
          ].filter(Boolean).join('\n')}
          icon={ShoppingBag}
          accent="indigo"
          change={ordersChangePct}
          loading={isSummaryLoading}
        />

        {/* 2. Выкупы — проведённые (из финотчёта) */}
        <SummaryCard
          title="Выкупы"
          value={revenueForTile}
          format="currency"
          secondaryValue={`${salesCountForTile} шт · выкуп ${buyoutPercent}%`}
          subtitle={(() => {
            if (marketplace === 'all') {
              const oz = getSalesTotalFromCostsTree(ozonCostsTreeData);
              const wb = getSalesTotalFromCostsTree(wbCostsTreeData);
              if (oz !== null && wb !== null) return `Ozon ${formatNumber(Math.round(oz))} · WB ${formatNumber(Math.round(wb))}`;
            }
            return undefined;
          })()}
          tooltip={[
            'Выручка из финансового отчёта МП (проведённые).',
            'Может отличаться от «Аналитики» в ЛК —',
            'там учтены все заказы, вкл. непроведённые.',
            costsTreeRatio < 1
              ? `Проведено ${(costsTreeRatio * 100).toFixed(0)}% от всех заказов.`
              : undefined,
            ozonCostsTreeData?.warnings?.length ? `⚠ ${ozonCostsTreeData.warnings[0]}` : undefined,
          ].filter(Boolean).join('\n')}
          tooltipAlign="right"
          icon={ShoppingCart}
          accent="emerald"
          change={revenueChangePct}
          loading={isSummaryLoading || isCostsTreeLoading}
        />

        {/* 3. Себестоимость — COGS */}
        <SummaryCard
          title="Себестоимость"
          mobileTitle="Закупка"
          value={adjustedPurchase}
          format="currency"
          secondaryValue={salesCountForTile > 0 ? `∅ ${formatCurrency(avgCcPerUnit)} / шт` : undefined}
          subtitle={costsTreeRatio < 1
            ? `скорр. ${(costsTreeRatio * 100).toFixed(0)}% проведённых`
            : undefined}
          tooltip={[
            'Себестоимость реализованных товаров (COGS).',
            `= Закупочная цена × Кол-во выкупов × Коэфф. проведённых`,
            `= ${formatCurrency(purchaseCostsForTile)} × ${costsTreeRatio.toFixed(2)} = ${formatCurrency(adjustedPurchase)}`,
            '',
            costsTreeRatio < 1
              ? `Коэффициент ${(costsTreeRatio * 100).toFixed(0)}%: не все заказы проведены МП.`
              : 'Все заказы проведены (коэфф. = 100%).',
            '',
            'Закупочные цены задаются в Настройки → Товары.',
          ].join('\n')}
          icon={Package}
          accent="amber"
          loading={isSummaryLoading || ueLoading}
          warning={ccWarning}
        />

        {/* 4. Чистая прибыль */}
        <SummaryCard
          title="Чистая прибыль"
          mobileTitle="Прибыль"
          value={netProfitForTile}
          format="currency"
          secondaryValue={revenueForTile > 0
            ? `маржа ${((netProfitForTile / revenueForTile) * 100).toFixed(1)}%`
            : 'маржа 0%'}
          tooltip={
            summary
              ? [
                  'Чистая прибыль = К перечисл. − Себестоимость − Реклама',
                  '',
                  `К перечисл.: ${payoutForTile === null ? '—' : formatCurrency(payoutForTile)}`,
                  `Себестоимость: −${formatCurrency(adjustedPurchase)}`,
                  `Реклама: −${formatCurrency(summary.ad_cost ?? 0)}`,
                  `─────────────`,
                  `Итого: ${formatCurrency(netProfitForTile)}`,
                  '',
                  'Учтены ВСЕ расходы: удержания МП, закупка, реклама.',
                  costsTreeRatio < 1
                    ? `Закупка пропорциональна проведённым (${(costsTreeRatio * 100).toFixed(0)}%).`
                    : undefined,
                ].filter(Boolean).join('\n')
              : undefined
          }
          tooltipAlign="right"
          icon={DollarSign}
          accent={netProfitForTile >= 0 ? 'emerald' : 'red'}
          loading={isSummaryLoading}
        />

        {/* ── Row 2: Финансы ── */}

        {/* 5. Удержания МП */}
        <SummaryCard
          title="Удержания МП"
          mobileTitle="Удержания"
          value={mpDeductionsForTile}
          format="currency"
          subtitle={mpDeductionsSubtitle}
          tooltip={[
            'Удержания маркетплейса из финотчёта:',
            'Комиссия + Логистика + Хранение + Эквайринг + ...',
            '',
            'Совпадает с «Удержания» в карточках OZON/WB ниже.',
          ].join('\n')}
          icon={Receipt}
          accent="slate"
          loading={isSummaryLoading}
        />

        {/* 6. Реклама + ДРР (merged) */}
        <SummaryCard
          title="Реклама"
          value={adCostForTile}
          format="currency"
          secondaryValue={`ДРР ${drrForTile}%`}
          tooltip={[
            'Расходы на рекламу (все кампании суммарно):',
            'WB Продвижение + Ozon Performance.',
            '',
            `ДРР = Реклама / Выкупы × 100%`,
            `= ${formatCurrency(adCostForTile)} / ${formatCurrency(revenueForTile)} × 100%`,
            `= ${drrForTile}%`,
            '',
            'Не путать с «Бонусами продавца» в удержаниях МП.',
          ].join('\n')}
          tooltipAlign="right"
          icon={Megaphone}
          accent="violet"
          loading={isSummaryLoading}
        />

        {/* 7. К перечислению */}
        <SummaryCard
          title="К перечислению"
          mobileTitle="Выплата"
          value={payoutForTile ?? 0}
          format="currency"
          subtitle={
            marketplace === 'all' && ozonCostsTreeData && wbCostsTreeData
              ? `Ozon ${formatNumber(Math.round(ozonCostsTreeData.total_accrued ?? 0))} · WB ${formatNumber(Math.round(wbCostsTreeData.total_accrued ?? 0))}`
              : undefined
          }
          tooltip={[
            'Сумма к перечислению от маркетплейсов.',
            `= Выкупы − Удержания МП`,
            `= ${formatCurrency(revenueForTile)} − ${formatCurrency(mpDeductionsForTile)}`,
          ].join('\n')}
          icon={Banknote}
          accent="sky"
          loading={isSummaryLoading}
        />

        {/* 8. Δ к предыдущему / Рентабельность */}
        {canShowChange ? (
          <SummaryCard
            title="Δ к пред. периоду"
            mobileTitle="Динамика"
            value={`${revenueChangeForTile > 0 ? '+' : ''}${revenueChangeForTile}%`}
            secondaryValue={`было ${formatCurrency(prevRevenueForTile)}`}
            subtitle={prevOrders > 0 ? `${prevOrders} заказов` : undefined}
            tooltip={[
              'Изменение выкупов относительно предыдущего периода.',
              `Текущий: ${formatCurrency(revenueForTile)}`,
              `Предыдущий: ${formatCurrency(prevRevenueForTile)}`,
              `Изменение: ${revenueChangeForTile > 0 ? '+' : ''}${revenueChangeForTile}%`,
            ].join('\n')}
            tooltipAlign="right"
            icon={TrendingUp}
            accent={revenueChangeForTile >= 0 ? 'emerald' : 'red'}
            isPositive={revenueChangeForTile >= 0}
            loading={isSummaryLoading}
          />
        ) : (
          <SummaryCard
            title="Рентабельность"
            value={revenueForTile > 0
              ? `${((netProfitForTile / revenueForTile) * 100).toFixed(1)}%`
              : '0%'}
            secondaryValue={`на ${formatCurrency(revenueForTile)} выручки`}
            tooltip={[
              'Рентабельность по чистой прибыли.',
              `= Чистая прибыль / Выкупы × 100%`,
              `= ${formatCurrency(netProfitForTile)} / ${formatCurrency(revenueForTile)} × 100%`,
            ].join('\n')}
            tooltipAlign="right"
            icon={TrendingUp}
            accent={netProfitForTile >= 0 ? 'emerald' : 'red'}
            loading={isSummaryLoading}
          />
        )}
      </div>

      {/* 2.5. План продаж (если задан, только Pro+) */}
      <FeatureGate feature="unit_economics" hide>
        <div className="mb-4 sm:mb-5 lg:mb-6">
          <PlanCompletionCard data={planCompletionData} loading={planCompletionLoading} />
        </div>
      </FeatureGate>

      {/* 3. MarketplaceBreakdown (OZON / WB) */}
      <MarketplaceBreakdown
        ozonCostsTree={ozonCostsTreeData}
        ozonCostsTreeLoading={ozonCostsTreeLoading}
        wbCostsTree={wbCostsTreeData}
        wbCostsTreeLoading={wbCostsTreeLoading}
        ozonProfit={ozonProfitData}
        wbProfit={wbProfitData}
      />

      {/* 4. Графики с боковыми фильтрами */}
      <div className="flex flex-row gap-2 sm:gap-3 mb-4 sm:mb-5 lg:mb-6">
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

        {/* Графики — 2 колонки на lg+ */}
        <div className="flex-1 min-w-0">
          <Suspense
            fallback={
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                      <div className={`bg-gray-100 rounded ${i <= 2 ? 'h-[100px] sm:h-[140px]' : 'h-[80px] sm:h-[100px]'}`} />
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
              {/* Ряд 1: Заказы + Прибыль */}
              <SalesChart data={salesChartSeries as any} isLoading={!chartsEnabled || chartLoading} />
              <ProfitChart
                data={salesChartSeries as any}
                profitMargin={profitMargin}
                isLoading={!chartsEnabled || chartLoading}
              />
              {/* Ряд 2: ДРР + Конверсия */}
              <DrrChart data={adCostsSeriesFull as any} isLoading={!chartsEnabled || adCostsLoading} />
              <ConversionChart data={salesChartSeries as any} isLoading={!chartsEnabled || chartLoading} />
            </div>
          </Suspense>
        </div>
      </div>

      {/* 4.5. Аналитика: Структура прибыли + Расходы + Топ товаров + Прогноз остатков */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5 lg:mb-6">
        <ProfitWaterfall
          revenue={revenueForTile}
          mpDeductions={mpDeductionsForTile}
          purchase={adjustedPurchase}
          ads={adCostForTile}
          profit={netProfitForTile}
          loading={isSummaryLoading || isCostsTreeLoading}
        />
        <CostsDonutChart
          ozonTree={ozonCostsTreeData?.tree}
          wbTree={wbCostsTreeData?.tree}
          marketplace={marketplace}
          loading={isCostsTreeLoading}
        />
        <TopProductsChart
          products={unitEconomicsData?.products ?? []}
          isLoading={ueLoading}
        />
        <StockForecastChart
          stocks={stocksData?.stocks ?? []}
          isLoading={stocksLoading}
        />
      </div>

      {/* 4.6. Динамика остатков */}
      <div className="mb-4 sm:mb-5 lg:mb-6">
        <StockHistoryChart
          dateFrom={dateRange.from}
          dateTo={stockHistoryDateTo}
          enabled={stocksEnabled}
        />
      </div>

      {/* 5. Таблица остатков */}
      <div id="stocks-table" className="mb-4 sm:mb-5 lg:mb-6">
        <StocksTable
          stocks={stocksData?.stocks || []}
          isLoading={!stocksEnabled || stocksLoading}
        />
      </div>

    </div>
  );
};
