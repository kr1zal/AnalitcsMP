/**
 * TypeScript типы для Analytics Dashboard
 * Основаны на API ответах backend
 */

// ==================== ОБЩИЕ ТИПЫ ====================

export type Marketplace = 'wb' | 'ozon' | 'all';
export type FulfillmentType = 'all' | 'FBO' | 'FBS';
export type SyncStatus = 'success' | 'error';
export type SyncType = 'products' | 'sales' | 'stocks' | 'costs' | 'ads' | 'orders' | 'all';

// ==================== ПРОДУКТЫ ====================

export interface Product {
  id: string;
  barcode: string;
  name: string;
  purchase_price: number;
  wb_nm_id?: number | null;
  wb_vendor_code?: string | null;
  ozon_product_id?: number | null;
  ozon_offer_id?: string | null;
  ozon_sku?: string | null;
  sort_order: number;
  product_group_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== PRODUCT MANAGEMENT ====================

export interface UpdatePurchasePriceResponse {
  status: 'success';
  product_id: string;
  purchase_price: number;
  linked_updated: number;
}

export interface ReorderItem {
  product_id: string;
  sort_order: number;
}

export interface ReorderResponse {
  status: 'success';
  updated: number;
}

export interface LinkProductsRequest {
  wb_product_id: string;
  ozon_product_id: string;
  purchase_price: number;
}

export interface LinkProductsResponse {
  status: 'success';
  group_id: string;
  purchase_price: number;
}

export interface UnlinkProductsResponse {
  status: 'success';
  unlinked_count: number;
}

export interface ProductsResponse {
  status: 'success';
  count: number;
  products: Product[];
}

// ==================== DASHBOARD ====================

export interface CostsBreakdown {
  commission: number;
  logistics: number;
  storage: number;
  penalties: number;
  acquiring: number;
  other: number;
}

export interface SalesSummary {
  orders: number;
  /**
   * Сумма всех заказов за период из mp_orders (price).
   * Заказы с status != 'cancelled'. Миграция 038.
   */
  orders_sum: number;
  sales: number;
  returns: number;
  revenue: number;
  buyout_percent: number;
  net_profit: number;
  drr: number;
  ad_cost: number;
  /**
   * Закупка за период (purchase_price * sales_count), агрегат.
   * Используется для быстрой оценки прибыли на Dashboard без запроса unit-economics.
   */
  purchase_costs_total?: number;
  total_costs: number;
  avg_check: number;
  costs_breakdown: CostsBreakdown;
  /**
   * Settlement-based выручка из mp_costs_details (category='Продажи').
   * Финализированная выручка из фин. отчёта МП.
   * Добавлено в миграции 029.
   */
  settled_revenue?: number;
  /**
   * Settlement-based payout (SUM всех categories из mp_costs_details).
   * Эквивалент costs-tree total_accrued, но из RPC.
   * Добавлено в миграции 029.
   */
  settled_payout?: number;
  /**
   * Settlement-based закупка (purchase_price * settled_qty из mp_costs).
   * Для Ozon: settled_qty по дате расчёта. Fallback на order-based если settled_qty=0.
   * Добавлено в миграции 029.
   */
  settled_purchase?: number;
  /**
   * Settlement-based прибыль = settled_payout - settled_purchase - ad_cost.
   * Консистентна с осью выручки (все поля settlement-based).
   * Добавлено в миграции 029.
   */
  settled_profit?: number;
}

export interface PreviousPeriod {
  revenue: number;
  sales: number;
  orders: number;
  /** Сумма заказов за предыдущий период (mp_orders, migration 038) */
  orders_sum?: number;
  revenue_change_percent: number;
  /** Settlement-based profit for prev period (migration 029) */
  settled_profit?: number;
  /** Settlement-based purchase for prev period (migration 029) */
  settled_purchase?: number;
  /** Settlement-based revenue for prev period (migration 029) */
  settled_revenue?: number;
  /** Settlement-based payout for prev period (migration 029) */
  settled_payout?: number;
}

export interface DashboardSummaryResponse {
  status: 'success';
  period: {
    from: string;
    to: string;
  };
  marketplace: Marketplace;
  summary: SalesSummary;
  previous_period: PreviousPeriod;
}

/**
 * Расширенный ответ summary с prev-period и "истинной" выручкой Ozon.
 * Экономит 3-4 HTTP запроса при marketplace=all.
 */
export interface DashboardSummaryWithPrevResponse {
  summary: SalesSummary;
  previous_period: PreviousPeriod;
  period: {
    from: string;
    to: string;
  };
  prev_period: {
    from: string;
    to: string;
  };
  /** @deprecated Not used on frontend — backend returns this data but it's not consumed */
  adjusted_revenue?: {
    current: number;
    previous: number;
    ozon_truth_current: number;
    ozon_truth_previous: number;
  };
}

// ==================== UNIT-ЭКОНОМИКА ====================

export interface ProductMetrics {
  sales_count: number;
  returns_count: number;
  revenue: number;
  mp_costs: number;
  storage_cost: number;
  purchase_costs: number;
  ad_cost: number;
  drr: number;
  net_profit: number;
  unit_profit: number;
}

export interface FulfillmentBreakdownItem {
  sales_count: number;
  revenue: number;
  net_profit: number;
  margin: number;
  unit_profit: number;
}

export interface UnitEconomicsItem {
  product: {
    id: string;
    name: string;
    barcode: string;
    purchase_price: number;
  };
  metrics: ProductMetrics;
  fulfillment_breakdown?: {
    fbo?: FulfillmentBreakdownItem;
    fbs?: FulfillmentBreakdownItem;
  };
}

export interface UnitEconomicsResponse {
  status: 'success';
  period: {
    from: string;
    to: string;
  };
  marketplace: Marketplace;
  /** @deprecated Always 1.0 since 19.02.2026 — kept for backward compatibility */
  costs_tree_ratio?: number;
  total_ad_cost: number;
  total_payout: number;
  total_returns: number;
  total_storage_cost: number;
  products: UnitEconomicsItem[];
}

// ==================== ГРАФИК ПРОДАЖ ====================

export interface SalesChartDataPoint {
  date: string;
  orders: number;
  sales: number;
  revenue: number;
  avg_check: number;
}

/** Extended sales chart data with plot-null markers for gap rendering */
export interface SalesChartPlotPoint extends SalesChartDataPoint {
  __plotNull: boolean;
  ordersPlot: number | null;
  salesPlot: number | null;
  revenuePlot: number | null;
}

/** Extended ad costs data with plot fields */
export interface AdCostsPlotPoint extends AdCostsChartDataPoint {
  // no additional fields needed beyond AdCostsChartDataPoint
}

export interface SalesChartResponse {
  status: 'success';
  period: {
    from: string;
    to: string;
  };
  data: SalesChartDataPoint[];
}

// ==================== РЕКЛАМА / ДРР ====================

export interface AdCostsChartDataPoint {
  date: string;
  ad_cost: number;
  revenue: number;
  drr: number;
  impressions: number;
  clicks: number;
  orders: number;
}

export interface AdCostsResponse {
  status: 'success';
  period: {
    from: string;
    to: string;
  };
  marketplace: Marketplace;
  totals: {
    ad_cost: number;
    revenue: number;
    drr: number;
    impressions: number;
    clicks: number;
    orders: number;
  };
  previous_totals?: {
    ad_cost: number;
    revenue: number;
    drr: number;
    impressions: number;
    clicks: number;
    orders: number;
  };
  data: AdCostsChartDataPoint[];
}

// ==================== COSTS TREE (ДЕТАЛИЗАЦИЯ УДЕРЖАНИЙ) ====================

export interface CostsTreeChild {
  name: string;
  amount: number;
}

export interface CostsTreeItem {
  name: string;
  amount: number;
  percent: number | null;
  children: CostsTreeChild[];
}

export interface CostsTreeResponse {
  status: 'success';
  period: {
    from: string;
    to: string;
  };
  marketplace: Marketplace;
  total_accrued: number;
  total_revenue: number;
  /**
   * База для процентов "как в ЛК Ozon" (сумма категории "Продажи" в дереве, по модулю).
   * Может отсутствовать на старых версиях backend.
   */
  percent_base_sales?: number;
  /**
   * Предупреждения от backend (например, когда показан fallback без mp_costs_details).
   */
  warnings?: string[];
  /**
   * Источник данных (например, mp_costs_details | fallback_mp_sales_mp_costs).
   */
  source?: string;
  tree: CostsTreeItem[];
}

/**
 * Объединённый ответ costs-tree для Ozon и WB.
 * Экономит 1 HTTP запрос при marketplace=all.
 */
export interface CostsTreeCombinedResponse {
  ozon: CostsTreeResponse | null;
  wb: CostsTreeResponse | null;
  period: {
    from: string;
    to: string;
  };
}

// ==================== ОСТАТКИ ====================

export interface WarehouseStock {
  marketplace: Marketplace;
  warehouse: string;
  quantity: number;
  /** FBO или FBS */
  fulfillment_type?: 'FBO' | 'FBS';
  /**
   * Когда остаток по этому складу последний раз обновлялся (из mp_stocks.updated_at).
   * Может отсутствовать на старых версиях backend.
   */
  updated_at?: string;
}

export interface StockItem {
  /**
   * UUID товара в БД (может отсутствовать на старых версиях backend).
   */
  product_id?: string | null;
  product_name: string;
  barcode: string;
  total_quantity: number;
  /**
   * Последнее время обновления остатков по товару (max по складам).
   * Может отсутствовать на старых версиях backend.
   */
  last_updated_at?: string | null;
  /** Средние дневные продажи за 30 дней. */
  avg_daily_sales?: number;
  /** Прогноз: на сколько дней хватит остатков (total_quantity / avg_daily_sales). */
  days_remaining?: number | null;
  warehouses: WarehouseStock[];
}

export interface StocksResponse {
  status: 'success';
  stocks: StockItem[];
}

// ==================== СИНХРОНИЗАЦИЯ ====================

export interface SyncLog {
  id: string;
  marketplace: Marketplace;
  sync_type: SyncType;
  status: SyncStatus;
  records_count: number;
  error_message?: string | null;
  started_at: string;
  finished_at: string;
}

export interface SyncLogsResponse {
  status: 'success';
  count: number;
  logs: SyncLog[];
}

export interface SyncResultDetail {
  status: SyncStatus;
  records?: number;
  updated?: number;
  message?: string;
}

export interface SyncAllResponse {
  status: 'completed';
  success_count: number;
  error_count: number;
  details: {
    products?: SyncResultDetail;
    orders_wb?: SyncResultDetail;
    orders_ozon?: SyncResultDetail;
    sales_wb?: SyncResultDetail;
    sales_ozon?: SyncResultDetail;
    stocks_wb?: SyncResultDetail;
    stocks_ozon?: SyncResultDetail;
    costs_wb?: SyncResultDetail;
    costs_ozon?: SyncResultDetail;
    ads_wb?: SyncResultDetail;
    ads_ozon?: SyncResultDetail;
  };
}

// ==================== СТАТУС СИНХРОНИЗАЦИИ (Phase 4) ====================

export interface SyncStatusResponse {
  plan: SubscriptionPlan;
  plan_name: string;
  last_sync_at: string | null;
  last_sync_ago_minutes: number | null;
  next_sync_at: string | null;
  sync_interval_hours: number | null;
  manual_syncs_today: number;
  manual_sync_limit: number;
  manual_syncs_remaining: number;
  is_syncing: boolean;
}

export interface ManualSyncResponse {
  status: 'completed';
  syncs_remaining: number;
  next_auto_sync: string;
}

// ==================== ТОКЕНЫ ====================

export interface TokensStatus {
  has_wb: boolean;
  has_ozon_seller: boolean;
  has_ozon_perf: boolean;
}

export interface TokensInput {
  wb_api_token?: string;
  ozon_client_id?: string;
  ozon_api_key?: string;
  ozon_perf_client_id?: string;
  ozon_perf_secret?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  error?: string;
}

export interface TokensValidateResponse {
  results: {
    wb?: TokenValidationResult;
    ozon_seller?: TokenValidationResult;
    ozon_perf?: TokenValidationResult;
  };
}

// ==================== ПОДПИСКИ ====================

export type SubscriptionPlan = 'free' | 'pro' | 'business';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

export interface SubscriptionFeatures {
  dashboard: boolean;
  costs_tree_basic: boolean;
  costs_tree_details: boolean;
  unit_economics: boolean;
  ads_page: boolean;
  pdf_export: boolean;
  period_comparison: boolean;
  order_monitor: boolean;
  api_access: boolean;
  fbs_analytics: boolean;
  profit_chart: boolean;
  drr_chart: boolean;
  conversion_chart: boolean;
  profit_waterfall: boolean;
  top_products: boolean;
  costs_donut: boolean;
  mp_breakdown: boolean;
  stock_forecast: boolean;
  stock_history: boolean;
}

export interface SubscriptionLimits {
  max_sku: number | null;
  current_sku: number;
  sku_remaining: number | null;
  marketplaces: string[];
  auto_sync: boolean;
  sync_interval_hours: number | null;
}

export interface UserSubscriptionResponse {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  plan_name: string;
  auto_renew: boolean;
  expires_at: string | null;
  limits: SubscriptionLimits;
  features: SubscriptionFeatures;
}

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  price_rub: number;
  max_sku: number | null;
  marketplaces: string[];
  auto_sync: boolean;
  sync_interval_hours: number | null;
  manual_sync_limit: number;
  features: SubscriptionFeatures;
}

export interface PlansListResponse {
  plans: PlanDefinition[];
}

// ==================== ПРИБЫЛЬ PER MARKETPLACE ====================

export interface MpProfitData {
  profit: number;
  purchase: number;
  ad: number;
}

// ==================== ПЛАН ПРОДАЖ ====================

export interface SalesPlanItem {
  product_id: string;
  product_name: string;
  barcode: string;
  plan_revenue: number;
}

export interface SalesPlanResponse {
  status: 'success';
  month: string; // "YYYY-MM"
  plans: SalesPlanItem[];
}

export interface SalesPlanCompletionItem {
  product_id: string;
  product_name: string;
  plan_revenue: number;
  actual_revenue: number;
  completion_percent: number;
}

export interface SalesPlanCompletionResponse {
  status: 'success';
  period: { from: string; to: string };
  month_label: string;
  plan_level: 'total' | 'marketplace' | 'product' | 'none';
  total_plan: number;
  total_actual: number;
  completion_percent: number;
  by_product: SalesPlanCompletionItem[];
  /** Pace/forecast fields (v2) */
  pace_daily?: number;
  required_pace?: number;
  forecast_revenue?: number;
  forecast_percent?: number;
  days_elapsed?: number;
  days_remaining?: number;
  days_total?: number;
}

export interface PreviousPlanResponse {
  status: 'success';
  has_previous: boolean;
  prev_month: string;
  summary: { total: number; wb: number; ozon: number };
  plans: { product_id: string; plan_revenue: number; marketplace: string }[];
}

export interface SalesPlanSummary {
  total: number;
  wb: number;
  ozon: number;
}

export interface SalesPlanSummaryResponse {
  status: 'success';
  month: string;
  summary: SalesPlanSummary;
}

// ==================== ФИЛЬТРЫ ====================

export interface DashboardFilters {
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  marketplace?: Marketplace;
  product_id?: string;
  /** FBO / FBS фильтр. undefined = все типы */
  fulfillment_type?: 'FBO' | 'FBS';
  /**
   * Для /dashboard/costs-tree: если false, backend вернёт только верхние категории без children.
   * Остальные эндпоинты этот параметр игнорируют.
   */
  include_children?: boolean;
  /** Для /dashboard/ad-costs: вернуть previous_totals за предыдущий период */
  include_prev_period?: boolean;
}

export type DateRangePreset = '7d' | '30d' | '90d' | 'custom';

// ==================== UI СОСТОЯНИЯ ====================

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface TrendData {
  value: number;
  change: number; // процент изменения
  isPositive: boolean;
}

// ==================== РАСШИРЕННЫЕ МЕТРИКИ (для будущего) ====================

export interface AdCost {
  product_id: string;
  marketplace: Marketplace;
  date: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  orders_count: number;
  ctr: number;
  cpc: number;
  acos: number;
}

export interface AdPerformanceResponse {
  status: 'success';
  period: {
    from: string;
    to: string;
  };
  total_cost: number;
  average_acos: number;
  breakdown: {
    wb: number;
    ozon: number;
  };
  campaigns: AdCost[];
}

// ==================== РЕКЛАМА: КАМПАНИИ ====================

export interface AdCampaignItem {
  campaign_id: string;
  campaign_name: string;
  marketplace: Marketplace;
  product_name: string | null;
  cost: number;
  impressions: number;
  clicks: number;
  orders: number;
  ctr: number;
  cpc: number;
  drr: number;
}

export interface AdCampaignsResponse {
  status: 'success';
  period: { from: string; to: string };
  campaigns: AdCampaignItem[];
  total_campaigns: number;
}

// ==================== МОНИТОР ЗАКАЗОВ ====================

export interface OrderFunnelSummary {
  total_orders: number;
  total_sales: number;
  total_returns: number;
  buyout_percent: number;
  total_revenue: number;
  unsettled_orders: number;
  unsettled_amount: number;
  avg_check: number;
}

export interface OrderFunnelDaily {
  date: string;
  orders: number;
  sales: number;
  returns: number;
  buyout_percent: number;
  revenue: number;
}

export interface OrderFunnelProduct {
  product_id: string;
  product_name: string;
  barcode: string;
  orders: number;
  sales: number;
  returns: number;
  buyout_percent: number;
  revenue: number;
  avg_check: number;
}

export interface OrderFunnelResponse {
  status: 'success';
  period: { from: string; to: string };
  marketplace: Marketplace;
  summary: OrderFunnelSummary;
  daily: OrderFunnelDaily[];
  by_product: OrderFunnelProduct[];
}

// ==================== ПОЗАКАЗНЫЙ МОНИТОР (Phase 2) ====================

export type OrderStatus = 'ordered' | 'sold' | 'returned' | 'cancelled' | 'delivering';

export interface Order {
  id: string;
  marketplace: Marketplace;
  order_id: string;
  product_id: string | null;
  product_name: string;
  barcode: string;
  order_date: string;
  last_change_date: string | null;
  status: OrderStatus;
  price: number;
  /** Реальная цена продажи после скидки СПП (WB: retail_price_withdisc_rub, Ozon: = price) */
  sale_price: number | null;
  sale_amount: number | null;
  commission: number;
  logistics: number;
  storage_fee: number;
  other_fees: number;
  payout: number | null;
  settled: boolean;
  region: string | null;
  warehouse: string | null;
  /** FBO или FBS */
  fulfillment_type?: 'FBO' | 'FBS';
  wb_sale_id: string | null;
  ozon_posting_status: string | null;
}

export interface OrdersListSummary {
  total_orders: number;
  total_sold: number;
  total_returned: number;
  total_settled: number;
  total_unsettled: number;
  total_payout: number;
  total_revenue: number;
  buyout_percent: number;
}

export interface OrdersListResponse {
  status: 'success';
  period: { from: string; to: string };
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  orders: Order[];
  summary: OrdersListSummary;
}

export interface OrderDetailResponse {
  status: 'success';
  order: Order & {
    wb_rrd_id?: number | null;
    raw_data?: Record<string, unknown> | null;
  };
}

export interface OrdersFilters extends DashboardFilters {
  status?: OrderStatus;
  settled?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

// ==================== ORDER SUMMARY (позаказная аналитика) ====================

export interface OrderSummaryTotals {
  commission: number;
  logistics: number;
  storage_fee: number;
  other_fees: number;
  total_deductions: number;
  sale_amount: number;
  payout: number;
  purchase: number;
  ads: number;
  estimated_profit: number;
  orders_count: number;
  settled_count: number;
  unsettled_count: number;
  settled_ratio: number;
  logistics_note?: string;
}

export interface OrderSummaryResponse {
  status: 'success';
  period: { from: string; to: string };
  totals: OrderSummaryTotals;
  by_marketplace: Record<string, OrderSummaryTotals>;
}

// ==================== ИСТОРИЯ ОСТАТКОВ ====================

export interface StockHistorySeriesItem {
  product_id: string;
  product_name: string;
  barcode: string;
  data: number[];
}

export interface StockHistoryResponse {
  status: 'success';
  period: { from: string; to: string };
  dates: string[];
  products: { id: string; name: string; barcode: string }[];
  series: StockHistorySeriesItem[];
  totals: number[];
}

// ==================== FBS / FULFILLMENT ====================

export interface FulfillmentInfo {
  has_fbs_data: boolean;
  fbs_products_count: number;
}

// ==================== DASHBOARD CONFIG (Widget Dashboard) ====================

export interface DashboardConfigPayload {
  enabled_widgets: string[];
  column_count: number;
  show_axis_badges: boolean;
  compact_mode: boolean;
  locked: boolean;
}

export interface DashboardConfigResponse {
  status: 'success';
  config: DashboardConfigPayload;
}

// ==================== TELEGRAM ====================

export interface TelegramSettings {
  daily_summary: boolean;
  morning_time: string;
  evening_enabled: boolean;
  evening_time: string;
  stock_alerts: boolean;
}

export interface TelegramLinkStatus {
  linked: boolean;
  telegram_username: string | null;
  settings: TelegramSettings;
  linked_at: string | null;
}

export interface TelegramGenerateTokenResponse {
  token: string;
  link: string;
  expires_in: number;
}
