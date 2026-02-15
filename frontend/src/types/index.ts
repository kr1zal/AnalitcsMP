/**
 * TypeScript типы для Analytics Dashboard
 * Основаны на API ответах backend
 */

// ==================== ОБЩИЕ ТИПЫ ====================

export type Marketplace = 'wb' | 'ozon' | 'all';
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
}

export interface PreviousPeriod {
  revenue: number;
  sales: number;
  orders: number;
  revenue_change_percent: number;
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
  /**
   * Скорректированная выручка с учётом "истинной" Ozon выручки из costs-tree.
   */
  adjusted_revenue: {
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
  purchase_costs: number;
  ad_cost: number;
  drr: number;
  net_profit: number;
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
}

export interface UnitEconomicsResponse {
  status: 'success';
  period: {
    from: string;
    to: string;
  };
  marketplace: Marketplace;
  costs_tree_ratio: number;
  total_ad_cost: number;
  total_payout: number;
  total_returns: number;
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
  /**
   * Для /dashboard/costs-tree: если false, backend вернёт только верхние категории без children.
   * Остальные эндпоинты этот параметр игнорируют.
   */
  include_children?: boolean;
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
