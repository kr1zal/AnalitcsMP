/**
 * Unit-экономика — Enterprise Page
 *
 * Оркестратор: загрузка данных + передача в subcomponents.
 * - 2 ряда KPI (8 карточек: Revenue, Profit, Margin, Unit Profit + ROI, ROAS, Returns, Products)
 * - TOP/BOTTOM bars с ABC-классификацией
 * - Стековый бар структуры затрат с легендой
 * - Enterprise таблица: search, filter tabs, sort, pagination, expandable MP breakdown
 * - Killer-фичи: ABC-классификация, Mini Waterfall, Smart Alerts
 */
import { useMemo } from 'react';
import { useUnitEconomics, useProducts } from '../hooks/useDashboard';
import { useSalesPlanCompletion } from '../hooks/useSalesPlan';
import { useFiltersStore } from '../store/useFiltersStore';
import { FilterPanel } from '../components/Shared/FilterPanel';
import { FeatureGate } from '../components/Shared/FeatureGate';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { getDateRangeFromPreset } from '../lib/utils';
import { UeKpiCards } from '../components/UnitEconomics/UeKpiCards';
import { UeProfitBars } from '../components/UnitEconomics/UeProfitBars';
import { UeCostStructure } from '../components/UnitEconomics/UeCostStructure';
import { UeTable } from '../components/UnitEconomics/UeTable';
import { classifyABC, computeTotals } from '../components/UnitEconomics/ueHelpers';
import type { UnitEconomicsItem, Product } from '../types';

// ==================== MP BREAKDOWN MATCHING ====================

/**
 * Матчинг WB↔Ozon продуктов по product_group_id.
 * Один физический товар может иметь разные UUIDs на WB и Ozon,
 * но они объединены через product_group_id.
 */
function buildMpBreakdown(
  allProducts: UnitEconomicsItem[],
  wbProducts: UnitEconomicsItem[] | undefined,
  ozonProducts: UnitEconomicsItem[] | undefined,
  productsList: Product[],
): Map<string, { wb?: UnitEconomicsItem; ozon?: UnitEconomicsItem }> {
  const map = new Map<string, { wb?: UnitEconomicsItem; ozon?: UnitEconomicsItem }>();

  // Build group → { wb_id, ozon_id } mapping
  const groupMap = new Map<string, { wb?: string; ozon?: string }>();
  for (const p of productsList) {
    if (p.product_group_id) {
      const entry = groupMap.get(p.product_group_id) ?? {};
      if (p.wb_nm_id) entry.wb = p.id;
      if (p.ozon_product_id) entry.ozon = p.id;
      groupMap.set(p.product_group_id, entry);
    }
  }

  // Index WB/Ozon data by product_id for O(1) lookup
  const wbById = new Map(wbProducts?.map((p) => [p.product.id, p]) ?? []);
  const ozonById = new Map(ozonProducts?.map((p) => [p.product.id, p]) ?? []);

  for (const item of allProducts) {
    const pid = item.product.id;
    const product = productsList.find((p) => p.id === pid);

    // Direct match
    let wb = wbById.get(pid);
    let ozon = ozonById.get(pid);

    // Group match (linked across MPs)
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
  const { datePreset, marketplace, customDateFrom, customDateTo } = useFiltersStore();
  const dateRange = getDateRangeFromPreset(datePreset, customDateFrom, customDateTo);

  const filters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace,
  };

  // Main UE data
  const { data: unitData, isLoading, error } = useUnitEconomics(filters);

  // Per-MP data (only when marketplace=all, for expanded row breakdown)
  const { data: wbData } = useUnitEconomics(
    { ...filters, marketplace: 'wb' },
    { enabled: marketplace === 'all' && !!unitData },
  );
  const { data: ozonData } = useUnitEconomics(
    { ...filters, marketplace: 'ozon' },
    { enabled: marketplace === 'all' && !!unitData },
  );

  // Products list (for product_group_id matching)
  const { data: productsData } = useProducts();

  // Plan completion
  const { data: planData } = useSalesPlanCompletion(filters);

  // ==================== DERIVED DATA ====================

  const unitProducts = unitData?.products ?? [];
  const productsList = productsData?.products ?? [];

  // Totals
  const totals = useMemo(() => computeTotals(unitProducts), [unitProducts]);
  const hasAds = totals.adCost > 0;
  const hasReturns = totals.returns > 0;

  // ABC classification
  const abcMap = useMemo(() => classifyABC(unitProducts), [unitProducts]);

  // Plan map
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

  // Profitable count
  const profitableCount = useMemo(
    () => unitProducts.filter((p) => p.metrics.net_profit > 0).length,
    [unitProducts],
  );

  // MP breakdown matching
  const mpBreakdown = useMemo(
    () => buildMpBreakdown(unitProducts, wbData?.products, ozonData?.products, productsList),
    [unitProducts, wbData, ozonData, productsList],
  );

  const costsTreeRatio = unitData?.costs_tree_ratio ?? 1;

  // ==================== LOADING / ERROR ====================

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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Unit-экономика</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Прибыль на единицу · {unitProducts.length} товаров · {dateRange.from} — {dateRange.to}
            {costsTreeRatio < 1 && (
              <span className="ml-1 text-amber-600" title="Закупка скорректирована по доле проведённых заказов из финотчёта МП">
                · проведено {Math.round(costsTreeRatio * 100)}%
              </span>
            )}
          </p>
        </div>

        {/* Filters */}
        <FilterPanel />

        {/* 1. KPI Cards (2 rows) */}
        <div className="mt-4 sm:mt-6 mb-4 sm:mb-6">
          <UeKpiCards
            totals={totals}
            productCount={unitProducts.length}
            profitableCount={profitableCount}
            hasAds={hasAds}
            hasReturns={hasReturns}
          />
        </div>

        {/* 2. TOP/BOTTOM Bars */}
        {unitProducts.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <UeProfitBars products={unitProducts} abcMap={abcMap} />
          </div>
        )}

        {/* 3. Cost Structure */}
        <div className="mb-4 sm:mb-6">
          <UeCostStructure totals={totals} hasAds={hasAds} />
        </div>

        {/* 4. Enterprise Table */}
        <UeTable
          products={unitProducts}
          abcMap={abcMap}
          planMap={planMap}
          mpBreakdown={mpBreakdown}
          marketplace={marketplace}
          hasAds={hasAds}
          hasReturns={hasReturns}
          hasPlan={hasPlan}
          totalProfit={totals.profit}
        />
      </div>
    </FeatureGate>
  );
};
