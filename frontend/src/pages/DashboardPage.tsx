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
import { AlertTriangle, X } from 'lucide-react';
import { useExport } from '../hooks/useExport';
import { useSubscription } from '../hooks/useSubscription';
import type { ExcelExportData } from '../lib/exportExcel';
import { WidgetGrid } from '../components/Dashboard/WidgetGrid';
import { useDashboardConfig } from '../hooks/useDashboardConfig';
import type { WidgetValue, CardAccent, WidgetDataDep } from '../components/Dashboard/widgets/registry';
import { WIDGET_DEFINITIONS } from '../components/Dashboard/widgets/definitions';
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
  useOrderSummary,
} from '../hooks/useDashboard';
import { useFiltersStore } from '../store/useFiltersStore';
import { useDashboardLayoutStore } from '../store/useDashboardLayoutStore';
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

const ORDER_SUMMARY_WIDGETS = ['order_commission', 'order_logistics', 'order_deductions', 'order_est_profit', 'settled_ratio'] as const;

export const DashboardPage = () => {
  const { datePreset, marketplace, fulfillmentType, customDateFrom, customDateTo } = useFiltersStore();
  const dateRange = getDateRangeFromPreset(datePreset, customDateFrom, customDateTo);
  // fulfillment_type для API: 'all' → undefined (= все типы)
  const ftParam = fulfillmentType === 'all' ? undefined : fulfillmentType;

  // Export hook
  const { isExporting, exportType, exportExcel, exportPdf } = useExport();
  const { data: subscription } = useSubscription();

  // Фильтр товаров (боковая панель — только товары, МП из FilterPanel)
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>(undefined);

  // Widget settings panel (controlled from FilterPanel → WidgetGrid)
  const [widgetSettingsOpen, setWidgetSettingsOpen] = useState(false);

  // ОПТИМИЗАЦИЯ: visibility gating убран, т.к. RPC запросы теперь быстрые
  // и нет смысла откладывать загрузку графиков/остатков

  const filters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace,
    fulfillment_type: ftParam,
  };

  // Фильтры для графиков (глобальный МП из FilterPanel + drill-down по товару)
  const chartFilters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace,
    product_id: selectedProduct,
    fulfillment_type: ftParam,
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
  // ВСЕГДА загружаем оба МП — MarketplaceBreakdown показывает OZON и WB независимо от фильтра
  const ozonFilters = { ...filters, marketplace: 'ozon' as const, include_children: true };
  const { data: ozonCostsTreeData, isLoading: ozonCostsTreeLoading } = useCostsTree(
    ozonFilters,
  );
  const { data: wbCostsTreeData, isLoading: wbCostsTreeLoading } = useCostsTree(
    { ...filters, marketplace: 'wb', include_children: true },
  );

  // Закупка: считаем по unit-economics (purchase_costs = purchase_price * qty).
  // ОПТИМИЗАЦИЯ: purchase_costs_total теперь приходит из RPC get_dashboard_summary
  const hasUeAccess = subscription?.features?.unit_economics === true;
  const { data: unitEconomicsData, isLoading: ueLoading } = useUnitEconomics(filters, {
    // Загружаем только если есть доступ (Pro+) — для Free план бэкенд вернёт 403
    enabled: Boolean(summaryData) && hasUeAccess,
  });

  // Графики и остатки загружаются сразу (RPC оптимизированы)
  const chartsEnabled = true;
  const stocksEnabled = true;

  const { data: chartData, isLoading: chartLoading } = useSalesChart(chartFilters, {
    enabled: chartsEnabled,
  });

  const hasAdsAccess = subscription?.features?.ads_page === true;
  const { data: adCostsData, isLoading: adCostsLoading } = useAdCosts(chartFilters, {
    // Загружаем только если есть доступ (Pro+) — для Free план бэкенд вернёт 403
    enabled: chartsEnabled && hasAdsAccess,
  });

  // Остатки ВСЕГДА показывают все МП — StocksTable имеет встроенные фильтры (Все/OOS WB/OOS Ozon)
  const { data: stocksData, isLoading: stocksLoading } = useStocks('all', fulfillmentType, {
    enabled: stocksEnabled,
  });

  // dateTo для графика остатков: всегда сегодня МСК (снимки пишутся в реальном времени)
  const stockHistoryDateTo = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });

  // План продаж — completion
  const { data: planCompletionData, isLoading: planCompletionLoading } = useSalesPlanCompletion(filters);

  // Widget Dashboard config (DnD layout, enabled widgets)
  useDashboardConfig();

  // Order-based summary (mp_orders aggregation) — lazy loaded only when order widgets are enabled
  const enabledWidgets = useDashboardLayoutStore((s) => s.enabledWidgets);
  const hasOrderWidgets = enabledWidgets.some((id) => (ORDER_SUMMARY_WIDGETS as readonly string[]).includes(id));
  const orderSummaryEnabled = hasOrderWidgets && Boolean(subscription?.features?.unit_economics);
  const { data: orderSummaryData, isLoading: orderSummaryLoading } = useOrderSummary(filters, {
    enabled: orderSummaryEnabled,
  });

  // Товары для бокового фильтра (используем глобальный marketplace)
  const { data: productsData } = useProducts(marketplace);
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

  // Purchase: prefer settled_purchase from RPC (settlement-based, migration 029)
  // Falls back to UE sum, then to order-based RPC purchase_costs_total
  const purchaseCostsForTile = (() => {
    // Primary: settlement-based purchase from RPC (migration 029)
    if (summary?.settled_purchase != null && summary.settled_purchase > 0) {
      return summary.settled_purchase;
    }
    // Fallback: UE sum (settlement-based for Ozon)
    if (unitEconomicsData?.products) {
      return unitEconomicsData.products.reduce((acc, p) => acc + (p.metrics.purchase_costs || 0), 0);
    }
    // Last resort: order-based from RPC
    return summary?.purchase_costs_total ?? 0;
  })();

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

  const netProfitForTile = (() => {
    if (!summary) return 0;

    // Primary: settled_profit from RPC (migration 029) — settlement-based, consistent axis
    if (summary.settled_profit != null && summary.settled_payout != null && summary.settled_payout !== 0) {
      return summary.settled_profit;
    }

    // Fallback 1: UE total profit (settlement-based, consistent with UE page)
    if (unitEconomicsData?.products) {
      return unitEconomicsData.products.reduce((acc, p) => acc + (p.metrics.net_profit || 0), 0);
    }

    // Fallback 2: payout - purchase - ads (from costs-tree)
    const ad = summary.ad_cost ?? 0;
    if (payoutForTile === null) {
      return summary.net_profit;
    }
    return payoutForTile - purchaseCostsForTile - ad;
  })();

  const salesCountForTile = summary?.sales ?? 0;
  const returnsCountForTile = summary?.returns ?? 0;

  // Margin ratio for ProfitChart (daily profit estimate = daily_revenue × profitMargin)
  const profitMargin = revenueForTile > 0 ? netProfitForTile / revenueForTile : 0;

  // ── Per-marketplace profit (IIFE, not useMemo — after early returns) ──
  // When marketplace filter is active, purchaseCostsForTile and ad_cost are already
  // filtered by that MP — share must be 1 for the matching card, otherwise we
  // double-discount and overstate profit.
  const ozonProfitData: MpProfitData | null = (() => {
    if (!summary || !ozonCostsTreeData) return null;
    const ozonPayout = ozonCostsTreeData.total_accrued ?? 0;
    let share: number;
    if (marketplace === 'ozon') {
      share = 1;
    } else {
      const ozonPureSales = ozonCostsTreeData.tree?.find((t) => t.name === 'Продажи')?.amount ?? 0;
      const wbPS = wbCostsTreeData?.tree?.find((t) => t.name === 'Продажи')?.amount ?? 0;
      const totalPS = ozonPureSales + wbPS;
      share = totalPS > 0 ? ozonPureSales / totalPS : 1;
    }
    const purchase = purchaseCostsForTile * share;
    const ad = (summary.ad_cost ?? 0) * share;
    return { profit: ozonPayout - purchase - ad, purchase, ad };
  })();

  const wbProfitData: MpProfitData | null = (() => {
    if (!summary || !wbCostsTreeData) return null;
    const wbPayout = wbCostsTreeData.total_accrued ?? 0;
    let share: number;
    if (marketplace === 'wb') {
      share = 1;
    } else {
      const ozPS = ozonCostsTreeData?.tree?.find((t) => t.name === 'Продажи')?.amount ?? 0;
      const wbPureSales = wbCostsTreeData.tree?.find((t) => t.name === 'Продажи')?.amount ?? 0;
      const totalPS = ozPS + wbPureSales;
      share = totalPS > 0 ? wbPureSales / totalPS : 1;
    }
    const purchase = purchaseCostsForTile * share;
    const ad = (summary.ad_cost ?? 0) * share;
    return { profit: wbPayout - purchase - ad, purchase, ad };
  })();

  // ── Данные для новых карточек ──
  const ordersCountForTile = summary?.orders ?? 0;
  const ordersRevenueForTile = summary?.orders_sum ?? summary?.revenue ?? 0; // mp_orders price sum (migration 038), fallback to mp_sales revenue
  const cancelledCountForTile = summary?.cancelled_count ?? 0;
  // Funnel from mp_orders (same axis as orders): sold, delivering, buyout%
  const soldCountForTile = summary?.sold_count ?? 0;
  const deliveringCountForTile = summary?.delivering_count ?? 0;
  const buyoutPercent = ordersCountForTile > 0 ? Math.round((soldCountForTile / ordersCountForTile) * 1000) / 10 : 0;

  // Средняя себестоимость за единицу
  const avgCcPerUnit = salesCountForTile > 0 ? purchaseCostsForTile / salesCountForTile : 0;

  // Change badges (period comparison integrated into cards)
  const prevRevenue = previousPeriod?.revenue ?? 0;
  const prevOrders = previousPeriod?.orders ?? 0;
  const canShowChange = showPeriodComparison;
  const revenueChangePct = canShowChange && prevRevenue > 0
    ? Math.round(((revenueForTile - prevRevenue) / prevRevenue) * 1000) / 10
    : undefined;
  const ordersChangePct = canShowChange && prevOrders > 0
    ? Math.round(((ordersCountForTile - prevOrders) / prevOrders) * 1000) / 10
    : undefined;

  // ── Costs-tree item extractor (for mp_commission, mp_logistics, mp_storage widgets) ──
  const extractCostsTreeAmount = (names: string[]): number => {
    let total = 0;
    const trees = [ozonCostsTreeData, wbCostsTreeData].filter(Boolean);
    for (const tree of trees) {
      if (!tree?.tree) continue;
      for (const item of tree.tree) {
        if (names.some((n) => item.name?.includes(n))) {
          total += Math.abs(item.amount ?? 0);
        }
      }
    }
    return total;
  };

  // ── Widget values for WidgetGrid ──
  const widgetValues: Record<string, WidgetValue> = (() => {
    const marginPct = revenueForTile > 0 ? ((netProfitForTile / revenueForTile) * 100).toFixed(1) : '0';
    const profitAccent: CardAccent = netProfitForTile >= 0 ? 'emerald' : 'red';

    // Stocks aggregates
    const stockItems = (stocksData?.stocks ?? []).filter((s) => s.barcode !== 'WB_ACCOUNT');
    const stockTotal = stockItems.reduce((acc, s) => acc + (s.total_quantity ?? 0), 0);
    const stockWithForecast = stockItems.filter((s) => s.days_remaining !== null && s.days_remaining !== undefined);
    const stockForecastAvg = stockWithForecast.length > 0
      ? Math.round(stockWithForecast.reduce((acc, s) => acc + (s.days_remaining ?? 0), 0) / stockWithForecast.length)
      : 0;
    const oosCount = stockItems.filter((s) => (s.total_quantity ?? 0) === 0).length;

    // Plan completion
    const planPct = planCompletionData?.completion_percent ?? 0;

    // Period delta
    const deltaAccent: CardAccent = revenueChangeForTile >= 0 ? 'emerald' : 'red';

    return {
      // ── Sales (ORDER-based) ──
      orders_count: {
        value: ordersCountForTile,
        secondaryValue: formatCurrency(ordersRevenueForTile),
        subtitle: returnsCountForTile > 0 ? `${returnsCountForTile} возвр.` : undefined,
        change: ordersChangePct,
      },
      orders_revenue: {
        value: ordersRevenueForTile,
        secondaryValue: `${ordersCountForTile} шт`,
      },
      sales_count: {
        value: soldCountForTile,
        secondaryValue: `выкуп ${buyoutPercent}%` + (deliveringCountForTile > 0 ? ` · в пути ${deliveringCountForTile}` : ''),
      },
      returns_count: {
        value: returnsCountForTile,
      },
      cancelled_count: {
        value: cancelledCountForTile,
      },
      avg_check: {
        value: summary?.avg_check ?? 0,
      },
      purchase_costs: {
        value: purchaseCostsForTile,
        secondaryValue: salesCountForTile > 0 ? `\u2205 ${formatCurrency(avgCcPerUnit)} / \u0448\u0442` : undefined,
        warning: ccWarning,
      },

      // ── Finance (SETTLEMENT-based) ──
      revenue_settled: {
        value: revenueForTile,
        secondaryValue: `${soldCountForTile} выкуп. · ${buyoutPercent}%`,
        subtitle: (() => {
          if (marketplace === 'all') {
            const oz = getSalesTotalFromCostsTree(ozonCostsTreeData);
            const wb = getSalesTotalFromCostsTree(wbCostsTreeData);
            if (oz !== null && wb !== null) return `Ozon ${formatNumber(Math.round(oz))} \u00B7 WB ${formatNumber(Math.round(wb))}`;
          }
          return undefined;
        })(),
        change: revenueChangePct,
      },
      payout: {
        value: payoutForTile ?? 0,
        subtitle: marketplace === 'all' && ozonCostsTreeData && wbCostsTreeData
          ? `Ozon ${formatNumber(Math.round(ozonCostsTreeData.total_accrued ?? 0))} \u00B7 WB ${formatNumber(Math.round(wbCostsTreeData.total_accrued ?? 0))}`
          : undefined,
      },
      mp_deductions: {
        value: mpDeductionsForTile,
        subtitle: mpDeductionsSubtitle,
      },
      net_profit: {
        value: netProfitForTile,
        secondaryValue: `\u043C\u0430\u0440\u0436\u0430 ${marginPct}%`,
        accentOverride: profitAccent,
      },
      profit_margin: {
        value: `${marginPct}%`,
        accentOverride: profitAccent,
      },
      mp_commission: {
        value: extractCostsTreeAmount(['\u041A\u043E\u043C\u0438\u0441\u0441\u0438', '\u0412\u043E\u0437\u043D\u0430\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u0435']),
      },
      mp_logistics: {
        value: extractCostsTreeAmount(['\u0434\u043E\u0441\u0442\u0430\u0432\u043A', '\u043B\u043E\u0433\u0438\u0441\u0442\u0438\u043A']),
      },
      mp_storage: {
        value: extractCostsTreeAmount(['\u0445\u0440\u0430\u043D\u0435\u043D\u0438', '\u0425\u0440\u0430\u043D\u0435\u043D\u0438']),
      },

      // ── Ads ──
      ad_cost: {
        value: adCostForTile,
        secondaryValue: `\u0414\u0420\u0420 ${drrForTile}%`,
      },
      drr: {
        value: `${drrForTile}%`,
        secondaryValue: formatCurrency(adCostForTile),
      },
      acos: {
        value: '0%',
      },
      cpo: {
        value: 0,
      },

      // ── Stocks ──
      stock_total: {
        value: stockTotal,
      },
      stock_forecast_avg: {
        value: stockForecastAvg,
        secondaryValue: `${stockForecastAvg} \u0434\u043D.`,
      },
      oos_count: {
        value: oosCount,
        accentOverride: oosCount > 0 ? 'red' : 'emerald',
      },

      // ── Order-based finance (mp_orders) ──
      order_commission: {
        value: orderSummaryData?.totals?.commission ?? 0,
      },
      order_logistics: {
        value: orderSummaryData?.totals?.logistics ?? 0,
        subtitle: orderSummaryData?.totals?.logistics_note,
      },
      order_deductions: {
        value: orderSummaryData?.totals?.total_deductions ?? 0,
        secondaryValue: orderSummaryData?.totals?.orders_count
          ? `${orderSummaryData.totals.orders_count} заказов`
          : undefined,
      },
      order_est_profit: {
        value: orderSummaryData?.totals?.estimated_profit ?? 0,
        accentOverride: (orderSummaryData?.totals?.estimated_profit ?? 0) >= 0 ? 'emerald' : 'red',
        secondaryValue: orderSummaryData?.totals?.payout
          ? `payout ${formatCurrency(orderSummaryData.totals.payout)}`
          : undefined,
      },
      settled_ratio: {
        value: `${orderSummaryData?.totals?.settled_ratio ?? 0}%`,
        secondaryValue: orderSummaryData?.totals
          ? `${orderSummaryData.totals.settled_count} / ${orderSummaryData.totals.orders_count}`
          : undefined,
      },

      // ── Plan ──
      plan_completion: {
        value: `${Math.round(planPct)}%`,
      },

      // ── Delta ──
      period_delta: {
        value: `${revenueChangeForTile > 0 ? '+' : ''}${revenueChangeForTile}%`,
        secondaryValue: `\u0431\u044B\u043B\u043E ${formatCurrency(prevRevenueForTile)}`,
        subtitle: prevOrders > 0 ? `${prevOrders} \u0437\u0430\u043A\u0430\u0437\u043E\u0432` : undefined,
        isPositive: revenueChangeForTile >= 0,
        accentOverride: deltaAccent,
      },
    };
  })();

  // ── Loading states per data dependency ──
  const loadingStates: Record<string, boolean> = (() => {
    const depLoading: Record<WidgetDataDep, boolean> = {
      summary: isSummaryLoading,
      costsTreeOzon: ozonCostsTreeLoading,
      costsTreeWb: wbCostsTreeLoading,
      unitEconomics: ueLoading,
      adCosts: adCostsLoading,
      stocks: stocksLoading,
      planCompletion: planCompletionLoading,
      products: false,
      orderSummary: orderSummaryLoading,
    };

    const result: Record<string, boolean> = {};
    for (const def of WIDGET_DEFINITIONS) {
      result[def.id] = def.dataDeps.some((dep) => depLoading[dep] ?? false);
    }
    return result;
  })();

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
      fulfillment_type: ftParam,
    });
  };

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
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
        pdfLocked={subscription?.features?.pdf_export === false}
        onWidgetSettings={() => setWidgetSettingsOpen(true)}
        isExporting={isExporting}
        exportType={exportType}
      />

      {/* 2. Карточки метрик — Widget Dashboard с DnD */}
      <div className="mb-4 sm:mb-5 lg:mb-6">
        <WidgetGrid
          widgetValues={widgetValues}
          loadingStates={loadingStates}
          settingsOpen={widgetSettingsOpen}
          onOpenSettings={() => setWidgetSettingsOpen(true)}
          onCloseSettings={() => setWidgetSettingsOpen(false)}
        />
      </div>

      {/* 2.5. План продаж (если задан, только Pro+) */}
      <FeatureGate feature="unit_economics" hide>
        <div className="mb-4 sm:mb-5 lg:mb-6">
          <PlanCompletionCard data={planCompletionData} loading={planCompletionLoading} />
        </div>
      </FeatureGate>

      {/* 3. MarketplaceBreakdown (OZON / WB) */}
      <FeatureGate feature="mp_breakdown">
        <MarketplaceBreakdown
          ozonCostsTree={ozonCostsTreeData}
          ozonCostsTreeLoading={ozonCostsTreeLoading}
          wbCostsTree={wbCostsTreeData}
          wbCostsTreeLoading={wbCostsTreeLoading}
          ozonProfit={ozonProfitData}
          wbProfit={wbProfitData}
        />
      </FeatureGate>

      {/* 4. Графики с боковыми фильтрами */}
      <div className="flex flex-row gap-2 sm:gap-3 mb-4 sm:mb-5 lg:mb-6">
        {/* Боковая панель — только фильтр товаров (МП из FilterPanel, sticky) */}
        <div className="w-28 sm:w-32 lg:w-36 flex-shrink-0">
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
              <FeatureGate feature="profit_chart">
                <ProfitChart
                  data={salesChartSeries as any}
                  profitMargin={profitMargin}
                  isLoading={!chartsEnabled || chartLoading}
                />
              </FeatureGate>
              {/* Ряд 2: ДРР + Конверсия */}
              <FeatureGate feature="drr_chart">
                <DrrChart data={adCostsSeriesFull as any} isLoading={!chartsEnabled || adCostsLoading} />
              </FeatureGate>
              <FeatureGate feature="conversion_chart">
                <ConversionChart data={salesChartSeries as any} isLoading={!chartsEnabled || chartLoading} />
              </FeatureGate>
            </div>
          </Suspense>
        </div>
      </div>

      {/* 4.5. Аналитика: Структура прибыли + Расходы + Топ товаров + Прогноз остатков */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5 lg:mb-6">
        <FeatureGate feature="profit_waterfall">
          <ProfitWaterfall
            revenue={revenueForTile}
            mpDeductions={mpDeductionsForTile}
            purchase={purchaseCostsForTile}
            ads={adCostForTile}
            profit={netProfitForTile}
            loading={isSummaryLoading || isCostsTreeLoading}
          />
        </FeatureGate>
        <FeatureGate feature="costs_donut">
          <CostsDonutChart
            ozonTree={ozonCostsTreeData?.tree}
            wbTree={wbCostsTreeData?.tree}
            marketplace={marketplace}
            loading={isCostsTreeLoading}
          />
        </FeatureGate>
        <FeatureGate feature="top_products">
          <TopProductsChart
            products={unitEconomicsData?.products ?? []}
            isLoading={ueLoading}
          />
        </FeatureGate>
        <FeatureGate feature="stock_forecast">
          <StockForecastChart
            stocks={stocksData?.stocks ?? []}
            isLoading={stocksLoading}
          />
        </FeatureGate>
      </div>

      {/* 4.6. Динамика остатков */}
      <div className="mb-4 sm:mb-5 lg:mb-6">
        <FeatureGate feature="stock_history">
          <StockHistoryChart
            dateFrom={dateRange.from}
            dateTo={stockHistoryDateTo}
            enabled={stocksEnabled}
          />
        </FeatureGate>
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
