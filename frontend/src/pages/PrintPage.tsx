/**
 * Enterprise PDF Export — Оркестратор
 * Загружает данные (8 запросов), рассчитывает метрики,
 * динамически разбивает на страницы с page-break.
 *
 * Структура:
 * 1. Обложка
 * 2. Executive Summary (KPI, план, waterfall, donut)
 * 3. Маркетплейсы (OZON + WB)
 * 4. Динамика продаж (combo chart)
 * 5. Прибыль и рентабельность (area charts)
 * 6. UE обзор (ABC, top 5, убыточные)
 * 7..N UE таблица (пагинация по 12)
 * N+1 Остатки
 * N+2 Реклама обзор + кампании (1 страница)
 * N+3..M Реклама таблица (пагинация по 20)
 */
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, salesPlanApi } from '../services/api';
import { eachDayOfInterval, parseISO, format } from 'date-fns';
import { classifyABC } from '../components/UnitEconomics/ueHelpers';
import {
  chunkArray,
  UE_ROWS_PER_PAGE,
  STOCKS_ROWS_PER_PAGE,
  ADS_ROWS_PER_PAGE,
} from '../components/Print/print-constants';
import { PrintPageShell } from '../components/Print/PrintPageShell';
import { PrintCoverPage } from '../components/Print/PrintCoverPage';
import { PrintExecutiveSummary } from '../components/Print/PrintExecutiveSummary';
import { PrintMarketplaceBreakdown } from '../components/Print/PrintMarketplaceBreakdown';
import { PrintSalesChart } from '../components/Print/PrintSalesChart';
import { PrintProfitChart } from '../components/Print/PrintProfitChart';
import { PrintUeOverview } from '../components/Print/PrintUeOverview';
import { PrintUeTable } from '../components/Print/PrintUeTable';
import { PrintStocksTable } from '../components/Print/PrintStocksTable';
import { PrintAdsOverview } from '../components/Print/PrintAdsOverview';
import { PrintAdsCampaignTable } from '../components/Print/PrintAdsCampaignTable';
import { PrintAdsTable } from '../components/Print/PrintAdsTable';

import type {
  SalesChartDataPoint,
  AdCostsChartDataPoint,
  SalesPlanCompletionResponse,
} from '../types';

// ==================== DATE FILL UTILITIES ====================

function fillMissingSalesDates(
  data: SalesChartDataPoint[],
  dateFrom: string,
  dateTo: string,
): SalesChartDataPoint[] {
  if (!dateFrom || !dateTo) return data;
  try {
    const allDates = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) });
    const map = new Map(data.map((d) => [d.date, d]));
    return allDates.map((date) => {
      const key = format(date, 'yyyy-MM-dd');
      return map.get(key) ?? { date: key, orders: 0, sales: 0, revenue: 0, avg_check: 0 };
    });
  } catch {
    return data;
  }
}

function fillMissingAdDates(
  data: AdCostsChartDataPoint[],
  dateFrom: string,
  dateTo: string,
): AdCostsChartDataPoint[] {
  if (!dateFrom || !dateTo) return data;
  try {
    const allDates = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) });
    const map = new Map(data.map((d) => [d.date, d]));
    return allDates.map((date) => {
      const key = format(date, 'yyyy-MM-dd');
      return map.get(key) ?? { date: key, ad_cost: 0, revenue: 0, drr: 0, impressions: 0, clicks: 0, orders: 0 };
    });
  } catch {
    return data;
  }
}

// ==================== MAIN COMPONENT ====================

export function PrintPage() {
  const [searchParams] = useSearchParams();

  // PDF token from Playwright
  const tokenFromUrl = searchParams.get('token');
  if (tokenFromUrl) {
    window.__PDF_TOKEN = tokenFromUrl;
  }

  const dateFrom = searchParams.get('from') || '';
  const dateTo = searchParams.get('to') || '';
  const marketplace = (searchParams.get('marketplace') || 'all') as 'all' | 'ozon' | 'wb';
  const enabled = !!dateFrom && !!dateTo;

  // ==================== 8 PARALLEL QUERIES ====================

  const { data: summaryWithPrev, isLoading: l1 } = useQuery({
    queryKey: ['print-summary', dateFrom, dateTo, marketplace],
    queryFn: () => dashboardApi.getSummaryWithPrev({ date_from: dateFrom, date_to: dateTo, marketplace }),
    enabled,
  });

  const { data: ozonTree, isLoading: l2 } = useQuery({
    queryKey: ['print-ozon-tree', dateFrom, dateTo],
    queryFn: () => dashboardApi.getCostsTree({ date_from: dateFrom, date_to: dateTo, marketplace: 'ozon', include_children: false }),
    enabled: enabled && marketplace !== 'wb',
  });

  const { data: wbTree, isLoading: l3 } = useQuery({
    queryKey: ['print-wb-tree', dateFrom, dateTo],
    queryFn: () => dashboardApi.getCostsTree({ date_from: dateFrom, date_to: dateTo, marketplace: 'wb', include_children: false }),
    enabled: enabled && marketplace !== 'ozon',
  });

  const { data: salesChart, isLoading: l4 } = useQuery({
    queryKey: ['print-sales', dateFrom, dateTo, marketplace],
    queryFn: () => dashboardApi.getSalesChart({ date_from: dateFrom, date_to: dateTo, marketplace }),
    enabled,
  });

  const { data: unitEconomics, isLoading: l5 } = useQuery({
    queryKey: ['print-ue', dateFrom, dateTo, marketplace],
    queryFn: () => dashboardApi.getUnitEconomics({ date_from: dateFrom, date_to: dateTo, marketplace }),
    enabled,
  });

  const { data: stocks, isLoading: l6 } = useQuery({
    queryKey: ['print-stocks', marketplace],
    queryFn: () => dashboardApi.getStocks(marketplace === 'all' ? undefined : marketplace, 60000),
    enabled,
  });

  const { data: adCosts, isLoading: l7 } = useQuery({
    queryKey: ['print-ads', dateFrom, dateTo, marketplace],
    queryFn: () => dashboardApi.getAdCosts({ date_from: dateFrom, date_to: dateTo, marketplace }, 60000),
    enabled,
  });

  const { data: adCampaigns, isLoading: l7b } = useQuery({
    queryKey: ['print-ad-campaigns', dateFrom, dateTo, marketplace],
    queryFn: () => dashboardApi.getAdCampaigns({ date_from: dateFrom, date_to: dateTo, marketplace }),
    enabled,
  });

  // Plan completion
  const { data: planCompletion, isLoading: l8 } = useQuery({
    queryKey: ['print-plan', dateFrom, dateTo, marketplace],
    queryFn: () => salesPlanApi.getCompletion({ date_from: dateFrom, date_to: dateTo, marketplace }) as Promise<SalesPlanCompletionResponse>,
    enabled,
  });

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l7b || l8;

  // ==================== LOADING STATE ====================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500 text-lg">Загрузка данных для PDF...</div>
      </div>
    );
  }

  // ==================== COMPUTE ALL METRICS ====================

  // Revenue from costs-tree (settled, displayed)
  const ozonPureSales = ozonTree?.tree.find((c) => c.name === 'Продажи')?.amount ?? 0;
  const wbPureSales = wbTree?.tree.find((c) => c.name === 'Продажи')?.amount ?? 0;
  const wbCredits = wbTree?.tree
    .filter((c) => c.name !== 'Продажи' && c.amount > 0)
    .reduce((s, c) => s + c.amount, 0) ?? 0;

  const ozonDisplayedRevenue = ozonPureSales; // OZON has no credits
  const wbDisplayedRevenue = wbPureSales + wbCredits;
  const totalRevenue = ozonDisplayedRevenue + wbDisplayedRevenue;

  // Deductions
  const ozonDeductions = ozonTree?.tree
    .filter((c) => c.name !== 'Продажи')
    .reduce((s, c) => s + Math.abs(c.amount), 0) ?? 0;
  const wbDeductions = wbTree?.tree
    .filter((c) => c.name !== 'Продажи' && c.amount < 0)
    .reduce((s, c) => s + Math.abs(c.amount), 0) ?? 0;
  const totalDeductions = ozonDeductions + wbDeductions;

  // Payout, purchase, ads
  const totalPayout = (ozonTree?.total_accrued ?? 0) + (wbTree?.total_accrued ?? 0);
  const purchaseCosts = unitEconomics?.products?.reduce((s, p) => s + p.metrics.purchase_costs, 0)
    ?? summaryWithPrev?.summary?.purchase_costs_total ?? 0;
  const totalAdCost = adCosts?.totals?.ad_cost ?? 0;
  const profit = totalPayout - purchaseCosts - totalAdCost;

  // Sales / avg check
  const totalSalesFromUE = unitEconomics?.products?.reduce((s, p) => s + p.metrics.sales_count, 0) ?? 0;
  const totalSalesFromChart = salesChart?.data?.reduce((s, d) => s + d.sales, 0) ?? 0;
  const totalSales = totalSalesFromUE > 0 ? totalSalesFromUE : totalSalesFromChart;
  const avgCheck = totalSales > 0 ? totalRevenue / totalSales : 0;

  // DRR
  const drr = totalRevenue > 0 ? (totalAdCost / totalRevenue) * 100 : 0;

  // Changes vs prev period
  const prevRevenue = summaryWithPrev?.previous_period?.revenue ?? 0;
  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const prevSales = summaryWithPrev?.previous_period?.sales ?? 0;
  const salesChange = prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : 0;

  // Profit margin
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // Filled chart data
  const filledSalesData = fillMissingSalesDates(salesChart?.data ?? [], dateFrom, dateTo);
  const filledAdData = fillMissingAdDates(adCosts?.data ?? [], dateFrom, dateTo);

  // Products sorted by profit
  const products = [...(unitEconomics?.products ?? [])].sort((a, b) => b.metrics.net_profit - a.metrics.net_profit);
  const abcMap = classifyABC(products);

  // Stocks
  const stocksList = stocks?.stocks ?? [];

  // ==================== PAGINATION ====================

  const ueChunks = chunkArray(products, UE_ROWS_PER_PAGE);
  const stocksChunks = chunkArray(stocksList, STOCKS_ROWS_PER_PAGE);
  const adsChunks = chunkArray(filledAdData, ADS_ROWS_PER_PAGE);

  const hasAds = totalAdCost > 0 || filledAdData.length > 0;

  // Total page count (cover is not numbered)
  const fixedPages = 5; // summary + MP + sales + profit + UE overview
  const ueTablePages = ueChunks.length;
  const stocksPages = stocksChunks.length;
  const adsOverviewPages = hasAds ? 1 : 0;
  const adsTablePages = hasAds ? adsChunks.length : 0;
  const totalPages = fixedPages + ueTablePages + stocksPages + adsOverviewPages + adsTablePages;

  let pageNum = 0;

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-white text-gray-900 print:bg-white" data-pdf-ready="true">
      {/* 1. Cover (no page number) */}
      <PrintCoverPage dateFrom={dateFrom} dateTo={dateTo} marketplace={marketplace} />

      {/* 2. Executive Summary */}
      <PrintPageShell page={++pageNum} totalPages={totalPages}>
        <PrintExecutiveSummary
          revenue={totalRevenue}
          profit={profit}
          sales={totalSales}
          avgCheck={avgCheck}
          adCost={totalAdCost}
          drr={drr}
          revenueChange={revenueChange}
          salesChange={salesChange}
          mpDeductions={totalDeductions}
          purchaseCosts={purchaseCosts}
          planCompletion={planCompletion}
          ozonTree={ozonTree}
          wbTree={wbTree}
          marketplace={marketplace}
        />
      </PrintPageShell>

      {/* 3. Marketplace Breakdown */}
      <PrintPageShell page={++pageNum} totalPages={totalPages}>
        <PrintMarketplaceBreakdown ozonTree={ozonTree} wbTree={wbTree} marketplace={marketplace} />
      </PrintPageShell>

      {/* 4. Sales Chart */}
      <PrintPageShell page={++pageNum} totalPages={totalPages}>
        <PrintSalesChart data={filledSalesData} dateFrom={dateFrom} dateTo={dateTo} />
      </PrintPageShell>

      {/* 5. Profit Chart */}
      <PrintPageShell page={++pageNum} totalPages={totalPages}>
        <PrintProfitChart
          salesData={filledSalesData}
          revenue={totalRevenue}
          profit={profit}
          profitMargin={profitMargin}
        />
      </PrintPageShell>

      {/* 6. UE Overview */}
      <PrintPageShell page={++pageNum} totalPages={totalPages}>
        <PrintUeOverview products={products} />
      </PrintPageShell>

      {/* 7..N UE Table pages */}
      {ueChunks.map((chunk, i) => (
        <PrintPageShell key={`ue-${i}`} page={++pageNum} totalPages={totalPages}>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">
              Unit-экономика: таблица {ueChunks.length > 1 ? `(${i + 1}/${ueChunks.length})` : ''}
            </h2>
            <PrintUeTable
              products={chunk}
              abcMap={abcMap}
              showTotals={i === ueChunks.length - 1}
              allProducts={products}
            />
          </div>
        </PrintPageShell>
      ))}

      {/* N+1..N+K Stocks pages */}
      {stocksChunks.map((chunk, i) => (
        <PrintPageShell key={`stocks-${i}`} page={++pageNum} totalPages={totalPages}>
          <PrintStocksTable
            stocks={chunk}
            showTitle={i === 0}
          />
        </PrintPageShell>
      ))}

      {/* Ads Overview + Campaign Table (single page) */}
      {hasAds && adCosts?.totals && (
        <PrintPageShell page={++pageNum} totalPages={totalPages}>
          <PrintAdsOverview totals={adCosts.totals} data={filledAdData} />
          {(adCampaigns?.campaigns?.length ?? 0) > 0 && (
            <div className="mt-4">
              <PrintAdsCampaignTable campaigns={adCampaigns!.campaigns} />
            </div>
          )}
        </PrintPageShell>
      )}

      {/* Ads Table pages */}
      {hasAds &&
        adsChunks.map((chunk, i) => (
          <PrintPageShell
            key={`ads-${i}`}
            page={++pageNum}
            totalPages={totalPages}
            isLast={i === adsChunks.length - 1}
          >
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900">
                Реклама: таблица {adsChunks.length > 1 ? `(${i + 1}/${adsChunks.length})` : ''}
              </h2>
              <PrintAdsTable
                data={chunk}
                showTotals={i === adsChunks.length - 1}
                totals={adCosts?.totals}
              />
            </div>
          </PrintPageShell>
        ))}
    </div>
  );
}
