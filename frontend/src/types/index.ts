/**
 * TypeScript типы для Analytics Dashboard
 * Основаны на API ответах backend
 */

// ==================== ОБЩИЕ ТИПЫ ====================

export type Marketplace = 'wb' | 'ozon' | 'all';
export type SyncStatus = 'success' | 'error';
export type SyncType = 'products' | 'sales' | 'stocks' | 'costs' | 'ads' | 'all';

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
  created_at: string;
  updated_at: string;
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

// ==================== UNIT-ЭКОНОМИКА ====================

export interface ProductMetrics {
  sales_count: number;
  revenue: number;
  mp_costs: number;
  purchase_costs: number;
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

// ==================== ФИЛЬТРЫ ====================

export interface DashboardFilters {
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  marketplace?: Marketplace;
  product_id?: string;
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
