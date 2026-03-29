/**
 * Функция для расчёта значений виджетов дашборда.
 * Извлечена из DashboardPage для уменьшения размера компонента (~130 строк).
 *
 * Принимает все необходимые данные через параметры и возвращает
 * Record<string, WidgetValue> для WidgetGrid.
 *
 * Не является React hook — вызывается после early returns в DashboardPage.
 */
import type { WidgetValue, CardAccent } from '../components/Dashboard/widgets/registry';
import type {
  CostsTreeResponse,
  Marketplace,
  SalesSummary,
  PreviousPeriod,
  StockItem,
  SalesPlanCompletionResponse,
  OrderSummaryTotals,
} from '../types';
import { formatCurrency, formatNumber } from '../lib/utils';

interface UseDashboardWidgetsParams {
  // Summary
  summary: SalesSummary | undefined;
  previousPeriod: PreviousPeriod | undefined;
  // Costs tree
  ozonCostsTreeData: CostsTreeResponse | undefined;
  wbCostsTreeData: CostsTreeResponse | undefined;
  marketplace: Marketplace;

  // Computed values from DashboardPage
  revenueForTile: number;
  revenueChangeForTile: number;
  prevRevenueForTile: number;
  purchaseCostsForTile: number;
  netProfitForTile: number;
  adCostForTile: number;
  drrForTile: number;
  mpDeductionsForTile: number;
  mpDeductionsSubtitle: string | undefined;
  payoutForTile: number | null;
  ordersCountForTile: number;
  ordersRevenueForTile: number;
  salesCountForTile: number;
  returnsCountForTile: number;
  cancelledCountForTile: number;
  buyoutPercent: number;
  avgCcPerUnit: number;
  ordersChangePct: number | undefined;
  revenueChangePct: number | undefined;
  ccWarning: string | undefined;

  // Stocks
  stocksData: { stocks: StockItem[] } | undefined;

  // Plan
  planCompletionData: SalesPlanCompletionResponse | undefined;

  // Order summary (optional — endpoint may not exist yet)
  orderSummaryData?: { totals: OrderSummaryTotals } | undefined;

  // Helper
  getSalesTotalFromCostsTree: (data?: CostsTreeResponse | null) => number | null;
  extractCostsTreeAmount: (names: string[]) => number;
}

export function computeWidgetValues(params: UseDashboardWidgetsParams): Record<string, WidgetValue> {
  const {
    summary,
    previousPeriod,
    ozonCostsTreeData,
    wbCostsTreeData,
    marketplace,
    revenueForTile,
    revenueChangeForTile,
    prevRevenueForTile,
    purchaseCostsForTile,
    netProfitForTile,
    adCostForTile,
    drrForTile,
    mpDeductionsForTile,
    mpDeductionsSubtitle,
    payoutForTile,
    ordersCountForTile,
    ordersRevenueForTile,
    salesCountForTile,
    returnsCountForTile,
    cancelledCountForTile,
    buyoutPercent,
    avgCcPerUnit,
    ordersChangePct,
    revenueChangePct,
    ccWarning,
    stocksData,
    planCompletionData,
    orderSummaryData,
    getSalesTotalFromCostsTree,
    extractCostsTreeAmount,
  } = params;

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

  const prevOrders = previousPeriod?.orders ?? 0;

  return {
      // -- Sales (ORDER-based) --
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
        value: salesCountForTile,
        secondaryValue: `выкуп ${buyoutPercent}%`,
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

      // -- Finance (SETTLEMENT-based) --
      revenue_settled: {
        value: revenueForTile,
        secondaryValue: `${salesCountForTile} \u0448\u0442 \u00B7 \u0432\u044B\u043A\u0443\u043F ${buyoutPercent}%`,
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

      // -- Ads --
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

      // -- Stocks --
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

      // -- Order-based finance (mp_orders) --
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

      // -- Plan --
      plan_completion: {
        value: `${Math.round(planPct)}%`,
      },

      // -- Delta --
      period_delta: {
        value: `${revenueChangeForTile > 0 ? '+' : ''}${revenueChangeForTile}%`,
        secondaryValue: `\u0431\u044B\u043B\u043E ${formatCurrency(prevRevenueForTile)}`,
        subtitle: prevOrders > 0 ? `${prevOrders} \u0437\u0430\u043A\u0430\u0437\u043E\u0432` : undefined,
        isPositive: revenueChangeForTile >= 0,
        accentOverride: deltaAccent,
      },
  };
}
