/**
 * API клиент для взаимодействия с backend
 */
import axios from 'axios';
import { supabase } from '../lib/supabase';
import type {
  ProductsResponse,
  DashboardSummaryResponse,
  DashboardSummaryWithPrevResponse,
  UnitEconomicsResponse,
  SalesChartResponse,
  StocksResponse,
  SyncLogsResponse,
  SyncAllResponse,
  SyncStatusResponse,
  ManualSyncResponse,
  DashboardFilters,
  AdCostsResponse,
  AdCampaignsResponse,
  CostsTreeResponse,
  CostsTreeCombinedResponse,
  TokensStatus,
  TokensInput,
  TokensValidateResponse,
  UserSubscriptionResponse,
  PlansListResponse,
  OrderFunnelResponse,
  OrdersListResponse,
  OrderDetailResponse,
  OrdersFilters,
  StockHistoryResponse,
  FulfillmentInfo,
  SalesPlanResponse,
  SalesPlanCompletionResponse,
  SalesPlanSummaryResponse,
  PreviousPlanResponse,
  DashboardConfigResponse,
  DashboardConfigPayload,
  TelegramLinkStatus,
  TelegramGenerateTokenResponse,
  TelegramSettings,
  OrderSummaryResponse,
} from '../types';

// Создаём axios instance с базовыми настройками
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== AUTH INTERCEPTOR ====================

// PrintPage передаёт JWT через URL (?token=...) — используем его приоритетно
declare global {
  interface Window {
    __PDF_TOKEN?: string;
  }
}

api.interceptors.request.use(async (config) => {
  // Приоритет 1: PDF token (передан через URL в PrintPage)
  if (window.__PDF_TOKEN) {
    config.headers.Authorization = `Bearer ${window.__PDF_TOKEN}`;
    return config;
  }

  // Приоритет 2: Supabase session token
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

// 401 → try refresh token once, then redirect to /login
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  const { data, error } = await supabase.auth.refreshSession();
  return !error && !!data.session;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !window.__PDF_TOKEN &&
      !originalRequest._retried
    ) {
      originalRequest._retried = true;

      // Deduplicate: if already refreshing, wait for the same promise
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = tryRefreshSession().finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }

      const refreshed = await refreshPromise;

      if (refreshed) {
        // Re-attach fresh token and retry
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
        }
        return api(originalRequest);
      }

      // Refresh failed — redirect to login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Interceptor для логирования запросов (только в dev режиме)
if (import.meta.env.DEV) {
  api.interceptors.request.use((config) => {
    (config as any).__meta = {
      startMs: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  });

  api.interceptors.response.use(
    (response) => {
      const meta = (response.config as any).__meta as { startMs?: number } | undefined;
      const endMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const ms = meta?.startMs ? Math.round(endMs - meta.startMs) : null;
      const len = (response.headers as any)?.['content-length'];
      const lenPart = len ? ` ${len}b` : '';
      const msPart = ms !== null ? ` ${ms}ms` : '';
      console.log(`[API] ✓ ${response.config.url} (${response.status})${msPart}${lenPart}`);
      return response;
    },
    (error) => {
      const cfg = error.config;
      const meta = (cfg as any)?.__meta as { startMs?: number } | undefined;
      const endMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const ms = meta?.startMs ? Math.round(endMs - meta.startMs) : null;
      const msPart = ms !== null ? ` ${ms}ms` : '';
      const status = error.response?.status;
      const statusPart = status ? ` (${status})` : '';
      console.error(`[API] ✗ ${cfg?.url}${statusPart}${msPart}: ${error.message}`);
      return Promise.reject(error);
    }
  );
}

// ==================== ПРОДУКТЫ ====================

export const productsApi = {
  /**
   * Получить список всех товаров
   */
  getAll: async (marketplace?: string) => {
    const { data } = await api.get<ProductsResponse>('/products', {
      params: { marketplace },
    });
    return data;
  },

  /**
   * Получить товар по ID
   */
  getById: async (id: string) => {
    const { data } = await api.get(`/products/${id}`);
    return data;
  },

  /**
   * Получить товар по штрихкоду
   */
  getByBarcode: async (barcode: string) => {
    const { data } = await api.get(`/products/barcode/${barcode}`);
    return data;
  },

  /**
   * Обновить себестоимость (синхронизирует связанные товары)
   */
  updatePurchasePrice: async (productId: string, purchasePrice: number) => {
    const { data } = await api.put(`/products/${productId}/purchase-price`, {
      purchase_price: purchasePrice,
    });
    return data;
  },

  /**
   * Массовое обновление sort_order
   */
  reorder: async (items: { product_id: string; sort_order: number }[]) => {
    const { data } = await api.put('/products/reorder', { items });
    return data;
  },

  /**
   * Связать два товара (WB + Ozon)
   */
  link: async (wbProductId: string, ozonProductId: string, purchasePrice: number) => {
    const { data } = await api.post('/products/link', {
      wb_product_id: wbProductId,
      ozon_product_id: ozonProductId,
      purchase_price: purchasePrice,
    });
    return data;
  },

  /**
   * Разорвать связь товаров
   */
  unlink: async (groupId: string) => {
    const { data } = await api.post(`/products/unlink/${groupId}`);
    return data;
  },
};

// ==================== DASHBOARD ====================

export const dashboardApi = {
  /**
   * Получить сводку по продажам
   */
  getSummary: async (filters?: DashboardFilters) => {
    const { data } = await api.get<DashboardSummaryResponse>('/dashboard/summary', {
      params: filters,
    });
    return data;
  },

  /**
   * Получить данные unit-экономики
   */
  getUnitEconomics: async (filters?: DashboardFilters) => {
    const { data } = await api.get<UnitEconomicsResponse>('/dashboard/unit-economics', {
      params: filters,
    });
    return data;
  },

  /**
   * Получить данные для графика продаж
   */
  getSalesChart: async (filters?: DashboardFilters) => {
    const { data } = await api.get<SalesChartResponse>('/dashboard/sales-chart', {
      params: filters,
    });
    return data;
  },

  /**
   * Получить остатки на складах
   */
  getStocks: async (marketplace?: string, fulfillmentType?: string, timeout?: number) => {
    const { data } = await api.get<StocksResponse>('/dashboard/stocks', {
      params: { marketplace, fulfillment_type: fulfillmentType },
      timeout: timeout ?? 30000,
    });
    return data;
  },

  /**
   * Проверить наличие FBS данных у пользователя (Progressive Disclosure)
   */
  getFulfillmentInfo: async () => {
    const { data } = await api.get<FulfillmentInfo>('/dashboard/fulfillment-info');
    return data;
  },

  getStockHistory: async (params?: { date_from?: string; date_to?: string; marketplace?: string; product_id?: string; fulfillment_type?: string }) => {
    const { data } = await api.get<StockHistoryResponse>('/dashboard/stock-history', {
      params,
    });
    return data;
  },

  /**
   * Получить рекламные расходы и ДРР
   */
  getAdCosts: async (filters?: DashboardFilters, timeout?: number) => {
    const { data } = await api.get<AdCostsResponse>('/dashboard/ad-costs', {
      params: filters,
      timeout: timeout ?? 30000,
    });
    return data;
  },

  getAdCampaigns: async (filters?: DashboardFilters) => {
    const { data } = await api.get<AdCampaignsResponse>('/dashboard/ad-campaigns', {
      params: filters,
      timeout: 30000,
    });
    return data;
  },

  /**
   * Получить дерево удержаний (tree-view как в ЛК Ozon)
   */
  getCostsTree: async (filters?: DashboardFilters) => {
    const { data } = await api.get<CostsTreeResponse>('/dashboard/costs-tree', {
      params: filters,
    });
    return data;
  },

  /**
   * Получить объединённое дерево удержаний для Ozon и WB.
   * Экономит 1 HTTP запрос при marketplace=all.
   */
  getCostsTreeCombined: async (filters?: Omit<DashboardFilters, 'marketplace'>) => {
    const { data } = await api.get<CostsTreeCombinedResponse>('/dashboard/costs-tree-combined', {
      params: filters,
    });
    return data;
  },

  /**
   * Получить сводку с данными предыдущего периода.
   * Экономит 3-4 HTTP запроса при marketplace=all.
   */
  getSummaryWithPrev: async (filters?: DashboardFilters & { include_ozon_truth?: boolean }) => {
    const { data } = await api.get<DashboardSummaryWithPrevResponse>('/dashboard/summary', {
      params: {
        ...filters,
        include_prev_period: true,
        include_ozon_truth: filters?.include_ozon_truth ?? true,
      },
    });
    return data;
  },

  /**
   * Получить агрегированную сводку из mp_orders (позаказная аналитика).
   * Pro+ фича. Данные без задержки settlement.
   */
  getOrderSummary: async (filters?: DashboardFilters) => {
    const { data } = await api.get<OrderSummaryResponse>('/dashboard/order-summary', {
      params: filters,
    });
    return data;
  },
};

// ==================== МОНИТОР ЗАКАЗОВ ====================

export const ordersApi = {
  getFunnel: async (filters?: DashboardFilters): Promise<OrderFunnelResponse> => {
    const { data } = await api.get<OrderFunnelResponse>('/dashboard/order-funnel', {
      params: filters,
    });
    return data;
  },

  getList: async (filters?: OrdersFilters): Promise<OrdersListResponse> => {
    const { data } = await api.get<OrdersListResponse>('/dashboard/orders', {
      params: filters,
    });
    return data;
  },

  getDetail: async (orderId: string): Promise<OrderDetailResponse> => {
    const { data } = await api.get<OrderDetailResponse>(`/dashboard/orders/${orderId}`);
    return data;
  },
};

// ==================== ЭКСПОРТ ====================

export const exportApi = {
  /**
   * Экспорт в PDF через Playwright (backend)
   * Возвращает blob PDF файла
   */
  exportPdf: async (params: {
    date_from: string;
    date_to: string;
    marketplace: string;
    fulfillment_type?: string;
  }): Promise<Blob> => {
    const { data } = await api.get('/export/pdf', {
      params,
      responseType: 'blob',
      timeout: 120000, // 2 минуты — PDF генерация может быть долгой
    });
    return data;
  },
};

// ==================== ТОКЕНЫ ====================

export const tokensApi = {
  getStatus: async (): Promise<TokensStatus> => {
    const { data } = await api.get<TokensStatus>('/tokens');
    return data;
  },

  save: async (tokens: TokensInput): Promise<{ status: string }> => {
    const { data } = await api.put('/tokens', tokens);
    return data;
  },

  validate: async (tokens: TokensInput): Promise<TokensValidateResponse> => {
    const { data } = await api.post<TokensValidateResponse>('/tokens/validate', tokens);
    return data;
  },

  saveAndSync: async (tokens: TokensInput): Promise<{ status: string }> => {
    const { data } = await api.post('/tokens/save-and-sync', tokens);
    return data;
  },
};

// ==================== ПОДПИСКИ ====================

export const subscriptionApi = {
  getMy: async (): Promise<UserSubscriptionResponse> => {
    const { data } = await api.get<UserSubscriptionResponse>('/subscription');
    return data;
  },

  getPlans: async (): Promise<PlansListResponse> => {
    const { data } = await api.get<PlansListResponse>('/subscription/plans');
    return data;
  },
};

// ==================== ОПЛАТА ====================

export const paymentApi = {
  upgrade: async (plan: string): Promise<{ confirmation_url: string }> => {
    const { data } = await api.post<{ confirmation_url: string }>('/subscription/upgrade', { plan });
    return data;
  },
  cancel: async (): Promise<{ status: string }> => {
    const { data } = await api.post<{ status: string }>('/subscription/cancel');
    return data;
  },
  enableAutoRenew: async (): Promise<{ status: string }> => {
    const { data } = await api.post<{ status: string }>('/subscription/enable-auto-renew');
    return data;
  },
};

// ==================== СИНХРОНИЗАЦИЯ ====================

export const syncApi = {
  /**
   * Полная синхронизация всех данных
   */
  syncAll: async (daysBack: number = 30, runInBackground: boolean = false) => {
    const { data } = await api.post<SyncAllResponse>('/sync/all', null, {
      params: { days_back: daysBack, run_in_background: runInBackground },
    });
    return data;
  },

  /**
   * Синхронизация товаров
   */
  syncProducts: async () => {
    const { data } = await api.post('/sync/products');
    return data;
  },

  /**
   * Синхронизация продаж
   */
  syncSales: async (daysBack: number = 7, marketplace?: string) => {
    const { data } = await api.post('/sync/sales', null, {
      params: { days_back: daysBack, marketplace },
    });
    return data;
  },

  /**
   * Синхронизация остатков
   */
  syncStocks: async (marketplace?: string) => {
    const { data } = await api.post('/sync/stocks', null, {
      params: { marketplace },
    });
    return data;
  },

  /**
   * Синхронизация удержаний
   */
  syncCosts: async (daysBack: number = 30, marketplace?: string) => {
    const { data } = await api.post('/sync/costs', null, {
      params: { days_back: daysBack, marketplace },
    });
    return data;
  },

  /**
   * Синхронизация рекламных расходов
   */
  syncAds: async (daysBack: number = 30, marketplace?: string) => {
    const { data } = await api.post('/sync/ads', null, {
      params: { days_back: daysBack, marketplace },
    });
    return data;
  },

  /**
   * Получить логи синхронизации
   */
  getLogs: async (limit: number = 50) => {
    const { data } = await api.get<SyncLogsResponse>('/sync/logs', {
      params: { limit },
    });
    return data;
  },

  /**
   * Получить статус синхронизации (Phase 4)
   */
  getStatus: async (): Promise<SyncStatusResponse> => {
    const { data } = await api.get<SyncStatusResponse>('/sync/status');
    return data;
  },

  /**
   * Ручная синхронизация с дневным лимитом (Phase 4)
   */
  manualSync: async (): Promise<ManualSyncResponse> => {
    const { data } = await api.post<ManualSyncResponse>('/sync/manual', null, {
      timeout: 300000, // 5 мин — полная синхронизация
    });
    return data;
  },
};

// ==================== АККАУНТ ====================

export const accountApi = {
  deleteAccount: async (): Promise<{ status: string }> => {
    const { data } = await api.delete<{ status: string }>('/account');
    return data;
  },
};

// ==================== ПЛАН ПРОДАЖ ====================

export const salesPlanApi = {
  getPlans: async (month: string, marketplace: string): Promise<SalesPlanResponse> => {
    const { data } = await api.get<SalesPlanResponse>('/sales-plan', { params: { month, marketplace } });
    return data;
  },

  upsertPlans: async (body: { month: string; marketplace: string; items: { product_id: string; plan_revenue: number }[] }) => {
    const { data } = await api.put<{ status: string; updated: number }>('/sales-plan', body);
    return data;
  },

  getCompletion: async (params?: { date_from?: string; date_to?: string; marketplace?: string; fulfillment_type?: string }): Promise<SalesPlanCompletionResponse> => {
    const { data } = await api.get<SalesPlanCompletionResponse>('/sales-plan/completion', { params });
    return data;
  },

  getSummary: async (month: string): Promise<SalesPlanSummaryResponse> => {
    const { data } = await api.get<SalesPlanSummaryResponse>('/sales-plan/summary', { params: { month } });
    return data;
  },

  upsertSummary: async (body: { month: string; level: string; plan_revenue: number }) => {
    const { data } = await api.put<{ status: string }>('/sales-plan/summary', body);
    return data;
  },

  reset: async (month: string) => {
    const { data } = await api.delete<{ status: string }>('/sales-plan/reset', { params: { month } });
    return data;
  },

  getPrevious: async (month: string): Promise<PreviousPlanResponse> => {
    const { data } = await api.get<PreviousPlanResponse>('/sales-plan/previous', { params: { month } });
    return data;
  },

};

// ==================== DASHBOARD CONFIG (Widget Dashboard) ====================

export const dashboardConfigApi = {
  /**
   * Получить конфигурацию дашборда пользователя (включённые виджеты, layout)
   */
  getConfig: async (): Promise<DashboardConfigResponse> => {
    const { data } = await api.get<DashboardConfigResponse>('/dashboard/config');
    return data;
  },

  /**
   * Сохранить конфигурацию дашборда пользователя
   */
  saveConfig: async (payload: DashboardConfigPayload): Promise<{ status: string }> => {
    const { data } = await api.put<{ status: string }>('/dashboard/config', payload);
    return data;
  },
};

// ==================== TELEGRAM ====================

export const telegramApi = {
  /** Check if user has linked Telegram account */
  getLinkStatus: async (): Promise<TelegramLinkStatus> => {
    const { data } = await api.get<TelegramLinkStatus>('../telegram/link-status');
    return data;
  },

  /** Generate one-time deep link token for binding */
  generateToken: async (): Promise<TelegramGenerateTokenResponse> => {
    const { data } = await api.post<TelegramGenerateTokenResponse>('../telegram/generate-token');
    return data;
  },

  /** Unlink Telegram account */
  unlink: async (): Promise<{ status: string }> => {
    const { data } = await api.delete<{ status: string }>('../telegram/unlink');
    return data;
  },

  /** Update notification settings */
  updateSettings: async (settings: TelegramSettings): Promise<{ status: string; settings: TelegramSettings }> => {
    const { data } = await api.put<{ status: string; settings: TelegramSettings }>('../telegram/settings', settings);
    return data;
  },
};

export default api;
