/**
 * Unit-экономика — Enterprise Page
 *
 * Оркестратор: загрузка данных + передача в subcomponents.
 * - Plan Summary Panel (editing, progress, forecast)
 * - 2 ряда KPI (8 карточек + Plan KPI)
 * - BCG Plan-Profit Matrix (2×2)
 * - TOP/BOTTOM bars с ABC-классификацией
 * - Стековый бар структуры затрат с легендой
 * - Enterprise таблица: search, filter tabs, sort, pagination, expandable MP breakdown
 * - Killer-фичи: ABC, Mini Waterfall, Smart Alerts, Pace/Forecast, Inline Plan Edit
 */
import { useState, useMemo, useCallback } from 'react';
import { HelpCircle } from 'lucide-react';
import { useUnitEconomics, useProducts } from '../hooks/useDashboard';
import {
  useSalesPlanCompletion,
  useSalesPlan,
} from '../hooks/useSalesPlan';
import { useSubscription } from '../hooks/useSubscription';
import { useFiltersStore } from '../store/useFiltersStore';
import { FilterPanel } from '../components/Shared/FilterPanel';
import { FeatureGate } from '../components/Shared/FeatureGate';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { getDateRangeFromPreset } from '../lib/utils';
import { UeKpiCards } from '../components/UnitEconomics/UeKpiCards';
import { UeProfitBars } from '../components/UnitEconomics/UeProfitBars';
import { UeCostStructure } from '../components/UnitEconomics/UeCostStructure';
import { UeTable } from '../components/UnitEconomics/UeTable';
import { UePlanPanel } from '../components/UnitEconomics/UePlanPanel';
import { UePlanMatrix } from '../components/UnitEconomics/UePlanMatrix';
import { classifyABC, computeTotals, type AbcMetric } from '../components/UnitEconomics/ueHelpers';
import { buildPlanPaceMap, classifyMatrix, extractPlanMonth } from '../components/UnitEconomics/uePlanHelpers';
import type { MatrixQuadrant } from '../components/UnitEconomics/uePlanHelpers';
import type { UnitEconomicsItem, Product } from '../types';

// ==================== MP BREAKDOWN MATCHING ====================

function buildMpBreakdown(
  allProducts: UnitEconomicsItem[],
  wbProducts: UnitEconomicsItem[] | undefined,
  ozonProducts: UnitEconomicsItem[] | undefined,
  productsList: Product[],
): Map<string, { wb?: UnitEconomicsItem; ozon?: UnitEconomicsItem }> {
  const map = new Map<string, { wb?: UnitEconomicsItem; ozon?: UnitEconomicsItem }>();

  const groupMap = new Map<string, { wb?: string; ozon?: string }>();
  for (const p of productsList) {
    if (p.product_group_id) {
      const entry = groupMap.get(p.product_group_id) ?? {};
      if (p.wb_nm_id) entry.wb = p.id;
      if (p.ozon_product_id) entry.ozon = p.id;
      groupMap.set(p.product_group_id, entry);
    }
  }

  const wbById = new Map(wbProducts?.map((p) => [p.product.id, p]) ?? []);
  const ozonById = new Map(ozonProducts?.map((p) => [p.product.id, p]) ?? []);

  for (const item of allProducts) {
    const pid = item.product.id;
    const product = productsList.find((p) => p.id === pid);
    let wb = wbById.get(pid);
    let ozon = ozonById.get(pid);

    if (product?.product_group_id) {
      const group = groupMap.get(product.product_group_id);
      if (group) {
        if (!wb && group.wb) wb = wbById.get(group.wb);
        if (!ozon && group.ozon) ozon = ozonById.get(group.ozon);
      }
    }
    map.set(pid, { wb, ozon });
  }
  return map;
}

// ==================== PAGE COMPONENT ====================

export const UnitEconomicsPage = () => {
  const { datePreset, marketplace, fulfillmentType, customDateFrom, customDateTo } = useFiltersStore();
  const { data: subscription } = useSubscription();
  const hasAccess = subscription?.features?.unit_economics === true;
  const dateRange = getDateRangeFromPreset(datePreset, customDateFrom, customDateTo);
  const ftParam = fulfillmentType === 'all' ? undefined : fulfillmentType;

  const filters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace,
    fulfillment_type: ftParam,
  };

  // ==================== DATA FETCHING ====================

  // Main UE data — disabled for Free plan (backend returns 403)
  const { data: unitData, isLoading, error } = useUnitEconomics(filters, { enabled: hasAccess });

  // Per-MP data (only when marketplace=all, for expanded row breakdown)
  const { data: wbData } = useUnitEconomics(
    { ...filters, marketplace: 'wb' },
    { enabled: hasAccess && marketplace === 'all' && !!unitData },
  );
  const { data: ozonData } = useUnitEconomics(
    { ...filters, marketplace: 'ozon' },
    { enabled: hasAccess && marketplace === 'all' && !!unitData },
  );

  // Products list (for product_group_id matching)
  const { data: productsData } = useProducts();

  // Plan completion
  const { data: planData } = useSalesPlanCompletion(filters);

  // Plan month (derived from completion data or current month)
  const planMonth = extractPlanMonth(planData);

  // Per-MP plan data (for expanded row plan progress)
  const { data: wbPlanData } = useSalesPlan(planMonth, 'wb');
  const { data: ozonPlanData } = useSalesPlan(planMonth, 'ozon');

  // ==================== DERIVED DATA ====================

  const productsList = productsData?.products ?? [];

  // Связанные пары (product_group_id) показываются одной строкой.
  // Первый товар группы — основной, метрики остальных суммируются в него.
  // Остальные товары группы убираются — доступны через mpBreakdown (раскрытие).
  const unitProducts = useMemo(() => {
    const raw = unitData?.products ?? [];
    const groupPrimary = new Map<string, number>(); // groupId → index in result
    const result: typeof raw = [];

    for (const item of raw) {
      const groupId = item.product?.product_group_id;
      if (!groupId) {
        result.push(item);
        continue;
      }

      const existingIdx = groupPrimary.get(groupId);
      if (existingIdx === undefined) {
        // Первый товар группы — добавляем
        groupPrimary.set(groupId, result.length);
        result.push({ ...item, metrics: { ...item.metrics } });
      } else {
        // Суммируем метрики в первый товар группы
        const primary = result[existingIdx];
        const pm = primary.metrics;
        const m = item.metrics;
        pm.sales_count += m.sales_count ?? 0;
        pm.orders_count = (pm.orders_count ?? 0) + (m.orders_count ?? 0);
        pm.cancelled_count = (pm.cancelled_count ?? 0) + (m.cancelled_count ?? 0);
        pm.returns_count += m.returns_count ?? 0;
        pm.revenue += m.revenue ?? 0;
        pm.mp_costs += m.mp_costs ?? 0;
        pm.storage_cost += m.storage_cost ?? 0;
        pm.purchase_costs += m.purchase_costs ?? 0;
        pm.ad_cost += m.ad_cost ?? 0;
        pm.net_profit += m.net_profit ?? 0;
      }
    }
    return result;
  }, [unitData?.products]);

  const totals = useMemo(() => computeTotals(unitProducts), [unitProducts]);
  const hasAds = totals.adCost > 0;
  const hasReturns = totals.returns > 0;

  // ABC metric toggle (profit or revenue)
  const [abcMetric, setAbcMetric] = useState<AbcMetric>('profit');

  const abcMap = useMemo(() => classifyABC(unitProducts, abcMetric), [unitProducts, abcMetric]);

  // Plan completion map
  const planMap = useMemo(() => {
    const map = new Map<string, number>();
    if (planData?.by_product) {
      for (const p of planData.by_product) {
        map.set(p.product_id, p.completion_percent);
      }
    }
    return map;
  }, [planData]);
  const hasPlan = planMap.size > 0;

  // Plan pace map (forecast per product)
  const planPaceMap = useMemo(() => buildPlanPaceMap(planData), [planData]);

  // BCG Matrix classification
  const [matrixFilter, setMatrixFilter] = useState<MatrixQuadrant | null>(null);

  const matrixData = useMemo(
    () => classifyMatrix(unitProducts, planMap),
    [unitProducts, planMap],
  );

  const matrixProductIds = useMemo(() => {
    if (!matrixFilter) return null;
    const q = matrixData.quadrants.find((q) => q.quadrant === matrixFilter);
    return q ? q.productIds : null;
  }, [matrixFilter, matrixData]);

  // Per-MP plan maps (for expanded row progress bars)
  // FIX: Use per-MP UE data for actual revenue (not planData.by_product which is all-MP)
  const wbPlanMap = useMemo(() => {
    const map = new Map<string, { plan_revenue: number; actual_revenue: number; completion_percent: number }>();
    if (!wbPlanData?.plans) return map;
    const actualProducts = wbData?.products ?? (marketplace === 'wb' ? unitProducts : []);
    const actualMap = new Map(actualProducts.map((p) => [p.product.id, p.metrics.revenue]));
    for (const plan of wbPlanData.plans) {
      if (plan.plan_revenue > 0) {
        const actual = actualMap.get(plan.product_id) ?? 0;
        map.set(plan.product_id, {
          plan_revenue: plan.plan_revenue,
          actual_revenue: actual,
          completion_percent: (actual / plan.plan_revenue) * 100,
        });
      }
    }
    return map;
  }, [wbPlanData, wbData, marketplace, unitProducts]);

  const ozonPlanMap = useMemo(() => {
    const map = new Map<string, { plan_revenue: number; actual_revenue: number; completion_percent: number }>();
    if (!ozonPlanData?.plans) return map;
    const actualProducts = ozonData?.products ?? (marketplace === 'ozon' ? unitProducts : []);
    const actualMap = new Map(actualProducts.map((p) => [p.product.id, p.metrics.revenue]));
    for (const plan of ozonPlanData.plans) {
      if (plan.plan_revenue > 0) {
        const actual = actualMap.get(plan.product_id) ?? 0;
        map.set(plan.product_id, {
          plan_revenue: plan.plan_revenue,
          actual_revenue: actual,
          completion_percent: (actual / plan.plan_revenue) * 100,
        });
      }
    }
    return map;
  }, [ozonPlanData, ozonData, marketplace, unitProducts]);

  const profitableCount = useMemo(
    () => unitProducts.filter((p) => p.metrics.net_profit > 0).length,
    [unitProducts],
  );

  const mpBreakdown = useMemo(
    () => buildMpBreakdown(unitProducts, wbData?.products, ozonData?.products, productsList),
    [unitProducts, wbData, ozonData, productsList],
  );

  // ==================== HANDLERS ====================

  const handleMatrixClick = useCallback((q: MatrixQuadrant | null) => {
    setMatrixFilter((prev) => (prev === q ? null : q));
  }, []);

  // ==================== LOADING / ERROR ====================

  // Free plan — показываем FeatureGate блокировку вместо данных
  if (!hasAccess) {
    return (
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <FilterPanel />
        <FeatureGate feature="unit_economics">
          <div className="h-[400px]" />
        </FeatureGate>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner text="Загрузка unit-экономики..." />;
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">Ошибка: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  // ==================== RENDER ====================

  return (
    <FeatureGate feature="unit_economics">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Unit-экономика</h2>
            {fulfillmentType !== 'all' && (
              <>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                  {fulfillmentType}
                </span>
                <span className="group/tip relative inline-flex items-center">
                  <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  <span className="invisible group-hover/tip:visible absolute top-full mt-1.5 right-0 z-50 w-56 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg">
                    Рекламные расходы показаны целиком — реклама привлекает трафик на карточку независимо от типа фулфилмента
                  </span>
                </span>
              </>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Прибыль на единицу · {unitProducts.length} товаров · {dateRange.from} — {dateRange.to}
          </p>
        </div>

        {/* Filters */}
        <FilterPanel />

        {/* Plan Summary Panel */}
        <div className="mt-4 sm:mt-6">
          <UePlanPanel
            planData={planData}
            month={planMonth}
          />
        </div>

        {/* KPI Cards (2 rows) */}
        <div className="mt-4 sm:mt-6 mb-4 sm:mb-6">
          <UeKpiCards
            totals={totals}
            productCount={unitProducts.length}
            profitableCount={profitableCount}
            hasAds={hasAds}
            hasReturns={hasReturns}
            planData={planData}
          />
        </div>

        {/* Plan-Profit Matrix */}
        {hasPlan && unitProducts.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <UePlanMatrix
              quadrants={matrixData.quadrants}
              activeQuadrant={matrixFilter}
              onQuadrantClick={handleMatrixClick}
            />
          </div>
        )}

        {/* TOP/BOTTOM Bars */}
        {unitProducts.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <UeProfitBars products={unitProducts} abcMap={abcMap} />
          </div>
        )}

        {/* Cost Structure */}
        <div className="mb-4 sm:mb-6">
          <UeCostStructure totals={totals} hasAds={hasAds} />
        </div>

        {/* Enterprise Table */}
        <UeTable
          products={unitProducts}
          abcMap={abcMap}
          abcMetric={abcMetric}
          onAbcMetricChange={setAbcMetric}
          planMap={planMap}
          mpBreakdown={mpBreakdown}
          marketplace={marketplace}
          hasAds={hasAds}
          hasReturns={hasReturns}
          hasPlan={hasPlan}
          totalProfit={totals.profit}
          totalPlanCompletion={planData?.completion_percent ?? 0}
          planPaceMap={planPaceMap}
          matrixFilter={matrixFilter}
          matrixProductIds={matrixProductIds}
          onMatrixClear={() => setMatrixFilter(null)}
          wbPlanMap={wbPlanMap}
          ozonPlanMap={ozonPlanMap}
        />
      </div>
    </FeatureGate>
  );
};
