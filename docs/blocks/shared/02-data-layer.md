# Data Layer — API Client + React Query Hooks

> HTTP-клиент (axios), JWT-авторизация, все API-модули и React Query hooks для серверных данных

**Правила CLAUDE.md:** #6 (Auth Hybrid), #10 (Profit formula), #35 (Costs-tree merge)

## Визуальная структура

```
React Component
  └─ useXxx(filters, opts)                    // React Query hook
       queryKey: ['domain', 'action', filters]
       staleTime: 5min (default)
       └─ xxxApi.method(params)               // API module
            └─ axios instance (api)
                 ├─ Request interceptor: attach JWT
                 ├─ Response interceptor: 401 → refresh → retry
                 └─ GET/POST/PUT/DELETE /api/v1/...
                      └─ Backend FastAPI endpoint
```

## Файлы

| Компонент | Путь | Назначение |
|-----------|------|------------|
| Supabase client | `frontend/src/lib/supabase.ts` | `createClient(url, anonKey)` |
| Axios instance | `frontend/src/services/api.ts` | HTTP client, interceptors, все API модули |
| Dashboard hooks | `frontend/src/hooks/useDashboard.ts` | 14 hooks для dashboard данных |
| Orders hooks | `frontend/src/hooks/useOrders.ts` | 3 hooks для монитора заказов |
| Sales Plan hooks | `frontend/src/hooks/useSalesPlan.ts` | 7 hooks (3 query + 4 mutation) |
| Products hooks | `frontend/src/hooks/useProducts.ts` | 5 hooks (1 query + 4 mutation) |
| Tokens hooks | `frontend/src/hooks/useTokens.ts` | 4 hooks (1 query + 3 mutation) |
| Sync hooks | `frontend/src/hooks/useSync.ts` | 6 hooks (2 query + 4 mutation) |
| Subscription hooks | `frontend/src/hooks/useSubscription.ts` | 5 hooks (2 query + 3 mutation) |
| Export hook | `frontend/src/hooks/useExport.ts` | 1 hook (Excel + PDF export) |
| Types | `frontend/src/types/index.ts` | Все TypeScript типы для API responses |

## Supabase Client

Файл: `frontend/src/lib/supabase.ts` (строки 1-10)

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- Используется ТОЛЬКО для auth (getSession, refreshSession, signOut, onAuthStateChange)
- Все данные идут через FastAPI backend (НЕ напрямую в Supabase)
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## API Client (axios)

Файл: `frontend/src/services/api.ts` (строки 39-157)

### Создание instance

```ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});
```

### Request Interceptor — JWT attachment (строки 57-71)

Два приоритета получения токена:

1. **PDF token** (`window.__PDF_TOKEN`) — передаётся через URL `?token=` в PrintPage. Используется Playwright при генерации PDF
2. **Supabase session** — `supabase.auth.getSession()` → `session.access_token`

```ts
api.interceptors.request.use(async (config) => {
  if (window.__PDF_TOKEN) {
    config.headers.Authorization = `Bearer ${window.__PDF_TOKEN}`;
    return config;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
```

### Response Interceptor — 401 Token Refresh (строки 73-122)

При получении 401:

1. Дедупликация: если refresh уже идёт, ждёт тот же Promise (НЕ запускает параллельный)
2. `supabase.auth.refreshSession()` — обновляет токен
3. Успех → повторяет оригинальный запрос с новым токеном
4. Неуспех → redirect на `/login`
5. Пропускает refresh для PDF token (`window.__PDF_TOKEN`)
6. Не ретраит повторно (`_retried` flag)

```
401 → isRefreshing? → wait promise : refreshSession()
  → refreshed?
    → YES: re-attach token, retry original request
    → NO:  redirect to /login
```

### Dev Logging (строки 124-157)

В режиме `import.meta.env.DEV` логирует:
- `[API] GET /dashboard/summary` — перед запросом
- `[API] ✓ /dashboard/summary (200) 45ms 1234b` — после успеха
- `[API] ✗ /dashboard/summary (401) 12ms: Unauthorized` — после ошибки

## API Модули — Полный справочник

### productsApi (строки 161-225)

| Метод | HTTP | Путь | Параметры |
|-------|------|------|-----------|
| `getAll` | GET | `/products` | `?marketplace` |
| `getById` | GET | `/products/{id}` | path: id |
| `getByBarcode` | GET | `/products/barcode/{barcode}` | path: barcode |
| `updatePurchasePrice` | PUT | `/products/{id}/purchase-price` | body: `{ purchase_price }` |
| `reorder` | PUT | `/products/reorder` | body: `{ items: [{product_id, sort_order}] }` |
| `link` | POST | `/products/link` | body: `{ wb_product_id, ozon_product_id, purchase_price }` |
| `unlink` | POST | `/products/unlink/{groupId}` | path: groupId |

### dashboardApi (строки 229-340)

| Метод | HTTP | Путь | Параметры |
|-------|------|------|-----------|
| `getSummary` | GET | `/dashboard/summary` | `DashboardFilters` |
| `getSummaryWithPrev` | GET | `/dashboard/summary` | `DashboardFilters + include_prev_period=true + include_ozon_truth=true` |
| `getUnitEconomics` | GET | `/dashboard/unit-economics` | `DashboardFilters` |
| `getSalesChart` | GET | `/dashboard/sales-chart` | `DashboardFilters` |
| `getStocks` | GET | `/dashboard/stocks` | `?marketplace, ?fulfillment_type` |
| `getFulfillmentInfo` | GET | `/dashboard/fulfillment-info` | нет |
| `getStockHistory` | GET | `/dashboard/stock-history` | `?date_from, ?date_to, ?marketplace, ?product_id, ?fulfillment_type` |
| `getAdCosts` | GET | `/dashboard/ad-costs` | `DashboardFilters` |
| `getAdCampaigns` | GET | `/dashboard/ad-campaigns` | `DashboardFilters` |
| `getCostsTree` | GET | `/dashboard/costs-tree` | `DashboardFilters` |
| `getCostsTreeCombined` | GET | `/dashboard/costs-tree-combined` | `DashboardFilters` без marketplace |

### ordersApi (строки 344-363)

| Метод | HTTP | Путь | Параметры |
|-------|------|------|-----------|
| `getFunnel` | GET | `/dashboard/order-funnel` | `DashboardFilters` |
| `getList` | GET | `/dashboard/orders` | `OrdersFilters` |
| `getDetail` | GET | `/dashboard/orders/{orderId}` | path: orderId |

### exportApi (строки 367-385)

| Метод | HTTP | Путь | Параметры |
|-------|------|------|-----------|
| `exportPdf` | GET | `/export/pdf` | `?date_from, ?date_to, ?marketplace, ?fulfillment_type` (timeout: 120s, responseType: blob) |

### tokensApi (строки 389-409)

| Метод | HTTP | Путь | Параметры |
|-------|------|------|-----------|
| `getStatus` | GET | `/tokens` | нет |
| `save` | PUT | `/tokens` | body: `TokensInput` |
| `validate` | POST | `/tokens/validate` | body: `TokensInput` |
| `saveAndSync` | POST | `/tokens/save-and-sync` | body: `TokensInput` |

### subscriptionApi (строки 413-423)

| Метод | HTTP | Путь | Параметры |
|-------|------|------|-----------|
| `getMy` | GET | `/subscription` | нет |
| `getPlans` | GET | `/subscription/plans` | нет |

### paymentApi (строки 427-440)

| Метод | HTTP | Путь | Параметры |
|-------|------|------|-----------|
| `upgrade` | POST | `/subscription/upgrade` | body: `{ plan }` |
| `cancel` | POST | `/subscription/cancel` | нет |
| `enableAutoRenew` | POST | `/subscription/enable-auto-renew` | нет |

### syncApi (строки 444-530)

| Метод | HTTP | Путь | Параметры |
|-------|------|------|-----------|
| `syncAll` | POST | `/sync/all` | `?days_back, ?run_in_background` |
| `syncProducts` | POST | `/sync/products` | нет |
| `syncSales` | POST | `/sync/sales` | `?days_back, ?marketplace` |
| `syncStocks` | POST | `/sync/stocks` | `?marketplace` |
| `syncCosts` | POST | `/sync/costs` | `?days_back, ?marketplace` |
| `syncAds` | POST | `/sync/ads` | `?days_back, ?marketplace` |
| `getLogs` | GET | `/sync/logs` | `?limit` |
| `getStatus` | GET | `/sync/status` | нет |
| `manualSync` | POST | `/sync/manual` | нет (timeout: 300s) |

### salesPlanApi (строки 543-578)

| Метод | HTTP | Путь | Параметры |
|-------|------|------|-----------|
| `getPlans` | GET | `/sales-plan` | `?month, ?marketplace` |
| `upsertPlans` | PUT | `/sales-plan` | body: `{ month, marketplace, items }` |
| `getCompletion` | GET | `/sales-plan/completion` | `?date_from, ?date_to, ?marketplace, ?fulfillment_type` |
| `getSummary` | GET | `/sales-plan/summary` | `?month` |
| `upsertSummary` | PUT | `/sales-plan/summary` | body: `{ month, level, plan_revenue }` |
| `reset` | DELETE | `/sales-plan/reset` | `?month` |
| `getPrevious` | GET | `/sales-plan/previous` | `?month` |

### accountApi (строки 534-539)

| Метод | HTTP | Путь | Параметры |
|-------|------|------|-----------|
| `deleteAccount` | DELETE | `/account` | нет |

## React Query Hooks — Полный справочник

### Конвенция queryKey

```
['domain', 'action', ...params]

Примеры:
['dashboard', 'summary', filters]
['dashboard', 'stocks', marketplace, fulfillmentType]
['sales-plan', 'completion', filters]
['products', marketplace]
['subscription']
['tokens', 'status']
['sync', 'logs', limit]
['orders', 'funnel', filters]
```

### QueryClient defaults (App.tsx, строки 24-32)

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,  // 5 минут
    },
  },
});
```

### Таблица Hook → Endpoint

| Hook | Файл | queryKey | staleTime | refetchInterval | Endpoint |
|------|------|----------|-----------|-----------------|----------|
| `useDashboardSummary` | useDashboard.ts:15 | `['dashboard', 'summary', filters]` | 5min | 5min | `GET /dashboard/summary` |
| `useDashboardSummaryWithPrev` | useDashboard.ts:29 | `['dashboard', 'summary-with-prev', filters]` | 5min | 5min | `GET /dashboard/summary` (+prev) |
| `useUnitEconomics` | useDashboard.ts:45 | `['dashboard', 'unit-economics', filters]` | 5min | 5min | `GET /dashboard/unit-economics` |
| `useSalesChart` | useDashboard.ts:58 | `['dashboard', 'sales-chart', filters]` | 5min | 5min | `GET /dashboard/sales-chart` |
| `useStocks` | useDashboard.ts:71 | `['dashboard', 'stocks', mp, ft]` | 10min | 10min | `GET /dashboard/stocks` |
| `useFulfillmentInfo` | useDashboard.ts:85 | `['dashboard', 'fulfillment-info']` | 30min | -- | `GET /dashboard/fulfillment-info` |
| `useAdCosts` | useDashboard.ts:97 | `['dashboard', 'ad-costs', filters]` | 5min | 5min | `GET /dashboard/ad-costs` |
| `useAdCampaigns` | useDashboard.ts:110 | `['dashboard', 'ad-campaigns', filters]` | 5min | -- | `GET /dashboard/ad-campaigns` |
| `useCostsTree` | useDashboard.ts:122 | `['dashboard', 'costs-tree', filters]` | 5min | 5min | `GET /dashboard/costs-tree` |
| `useCostsTreeCombined` | useDashboard.ts:136 | `['dashboard', 'costs-tree-combined', filters]` | 5min | 5min | `GET /dashboard/costs-tree-combined` |
| `useProducts` (dashboard) | useDashboard.ts:152 | `['products', marketplace]` | 30min | -- | `GET /products` |
| `useStockHistory` | useDashboard.ts:164 | `['dashboard', 'stock-history', params]` | 10min | -- | `GET /dashboard/stock-history` |
| `useOrderFunnel` | useOrders.ts:12 | `['orders', 'funnel', filters]` | 5min | 5min | `GET /dashboard/order-funnel` |
| `useOrdersList` | useOrders.ts:22 | `['orders', 'list', filters]` | 5min | -- | `GET /dashboard/orders` |
| `useOrderDetail` | useOrders.ts:31 | `['orders', 'detail', orderId]` | 10min | -- | `GET /dashboard/orders/{id}` |
| `useSalesPlan` | useSalesPlan.ts:12 | `['sales-plan', month, mp]` | 5min | -- | `GET /sales-plan` |
| `useSalesPlanSummary` | useSalesPlan.ts:34 | `['sales-plan', 'summary', month]` | 5min | -- | `GET /sales-plan/summary` |
| `usePreviousPlan` | useSalesPlan.ts:67 | `['sales-plan', 'previous', month]` | 10min | -- | `GET /sales-plan/previous` |
| `useSalesPlanCompletion` | useSalesPlan.ts:76 | `['sales-plan', 'completion', filters]` | 5min | -- | `GET /sales-plan/completion` |
| `useProducts` (products) | useProducts.ts:6 | `['products']` | 5min | -- | `GET /products` |
| `useTokensStatus` | useTokens.ts:5 | `['tokens', 'status']` | 10min | -- | `GET /tokens` |
| `useSubscription` | useSubscription.ts:4 | `['subscription']` | 10min | -- | `GET /subscription` |
| `usePlans` | useSubscription.ts:12 | `['subscription', 'plans']` | 1hr | -- | `GET /subscription/plans` |
| `useSyncLogs` | useSync.ts:11 | `['sync', 'logs', limit]` | 30s | -- | `GET /sync/logs` |
| `useSyncStatus` | useSync.ts:96 | `['sync', 'status']` | 10s | 30s | `GET /sync/status` |

### Mutations (хуки с побочными эффектами)

| Hook | Файл | API метод | Invalidates |
|------|------|-----------|-------------|
| `useUpsertSalesPlan` | useSalesPlan.ts:21 | `PUT /sales-plan` | `['sales-plan', month, mp]`, `['sales-plan', 'completion']` |
| `useUpsertSummaryPlan` | useSalesPlan.ts:43 | `PUT /sales-plan/summary` | `['sales-plan', 'summary', month]`, `['sales-plan', 'completion']` |
| `useResetSalesPlan` | useSalesPlan.ts:56 | `DELETE /sales-plan/reset` | `['sales-plan']` (все) |
| `useUpdatePurchasePrice` | useProducts.ts:15 | `PUT /products/{id}/purchase-price` | `['products']`, `['dashboard']` |
| `useReorderProducts` | useProducts.ts:28 | `PUT /products/reorder` | `['products']` |
| `useLinkProducts` | useProducts.ts:39 | `POST /products/link` | `['products']` |
| `useUnlinkProducts` | useProducts.ts:51 | `POST /products/unlink/{id}` | `['products']` |
| `useSaveTokens` | useTokens.ts:13 | `PUT /tokens` | `['tokens']` |
| `useValidateTokens` | useTokens.ts:21 | `POST /tokens/validate` | -- |
| `useSaveAndSync` | useTokens.ts:27 | `POST /tokens/save-and-sync` | `['tokens']`, `['dashboard']`, `['sync-logs']` |
| `useSyncAll` | useSync.ts:22 | `POST /sync/all` | `['dashboard']`, `['sync', 'logs']` |
| `useSyncSales` | useSync.ts:53 | `POST /sync/sales` | `['dashboard']`, `['sync', 'logs']` |
| `useSyncStocks` | useSync.ts:73 | `POST /sync/stocks` | `['dashboard', 'stocks']`, `['sync', 'logs']` |
| `useManualSync` | useSync.ts:108 | `POST /sync/manual` | `['dashboard']`, `['sync']` |
| `useUpgrade` | useSubscription.ts:20 | `POST /subscription/upgrade` | -- |
| `useCancelSubscription` | useSubscription.ts:26 | `POST /subscription/cancel` | `['subscription']` |
| `useEnableAutoRenew` | useSubscription.ts:35 | `POST /subscription/enable-auto-renew` | `['subscription']` |

## Паттерн staleTime по категориям

| Категория | staleTime | Причина |
|-----------|-----------|---------|
| Dashboard данные | 5min | Баланс актуальности и нагрузки |
| Остатки (stocks) | 10min | Меняются реже, тяжёлые запросы |
| FulfillmentInfo | 30min | Почти статические данные |
| Товары (products) | 30min | Редко меняются |
| Подписка | 10min | Меняется только при оплате |
| Список планов | 1hr | Статические данные |
| Логи синхронизации | 30s | Нужна актуальность при мониторинге |
| Статус синхронизации | 10s | Polling для отображения прогресса |

## Как добавить новый hook

### 1. Добавить метод в API модуль (`api.ts`)

```ts
// В соответствующий блок (dashboardApi, syncApi, etc.)
export const dashboardApi = {
  // ... существующие методы
  getNewData: async (filters?: DashboardFilters) => {
    const { data } = await api.get<NewDataResponse>('/dashboard/new-data', {
      params: filters,
    });
    return data;
  },
};
```

### 2. Создать hook (или добавить в существующий файл hooks)

```ts
export const useNewData = (filters?: DashboardFilters, opts?: QueryOpts) => {
  return useQuery({
    queryKey: ['dashboard', 'new-data', filters],
    queryFn: () => dashboardApi.getNewData(filters),
    staleTime: 1000 * 60 * 5,
    enabled: opts?.enabled ?? true,
  });
};
```

### 3. Для мутаций — с invalidation

```ts
export const useUpdateNewData = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewDataInput) => dashboardApi.updateNewData(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'new-data'] });
    },
  });
};
```

### Правила:

- `queryKey` всегда начинается с домена: `'dashboard'`, `'products'`, `'sales-plan'`, `'sync'`, `'orders'`
- `opts?: { enabled?: boolean }` — стандартный паттерн для условного выполнения
- `DashboardFilters` передаётся целиком в params (содержит `date_from`, `date_to`, `marketplace`, `fulfillment_type`)
- Типы response определяются в `frontend/src/types/index.ts`

## Обработка ошибок

```
Request failed
  └─ Response interceptor (api.ts:82-122)
       ├─ Status 401 → tryRefreshSession()
       │    ├─ Success → retry с новым токеном
       │    └─ Fail → redirect /login
       └─ Status != 401 → Promise.reject(error)
            └─ React Query catches error
                 ├─ retry: 1 (одна попытка)
                 └─ error доступен в компоненте:
                      const { error } = useQuery(...)
                      if (error) return <ErrorMessage />
```

Мутации дополнительно показывают toast-уведомления через `sonner`:
- `onSuccess` → `toast.success('...')`
- `onError` → `toast.error('...')`

## Специальные таймауты

| Запрос | Timeout | Причина |
|--------|---------|---------|
| Default | 30s | Стандарт |
| `getStocks` | 30s | Кастомный параметр (может быть увеличен) |
| `getAdCosts` | 30s | Кастомный параметр (может быть увеличен) |
| `getAdCampaigns` | 30s | Фиксированный |
| `exportPdf` | 120s | Playwright рендер PDF может быть долгим |
| `manualSync` | 300s | Полная синхронизация всех данных |

## Edge Cases

1. **PDF token** — при генерации PDF backend открывает `/print?token=JWT` через Playwright. `window.__PDF_TOKEN` имеет приоритет над Supabase session
2. **Параллельный refresh** — дедупликация через `isRefreshing` flag и shared `refreshPromise`
3. **fulfillmentType 'all'** — преобразуется в `undefined` перед отправкой (в `useStocks`, строка 72)
4. **marketplace 'all'** — преобразуется в `undefined` перед отправкой (в `useStocks`, строка 75; `useProducts` dashboard, строка 155)

## Зависимости

- **Зависит от:** `@supabase/supabase-js` (auth), `axios` (HTTP), `@tanstack/react-query` (caching), `sonner` (toasts)
- **Используется в:** Все страницы и компоненты приложения
- **Env vars:** `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
