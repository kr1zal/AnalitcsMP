# State Management — Zustand Stores + URL Sync

> Zustand stores для UI-состояния (фильтры, auth), двусторонняя синхронизация фильтров с URL

**Правила CLAUDE.md:** #40 (URL state sync), #42 (Даты в МСК TZ)

## Визуальная структура

```
URL: /?period=30d&mp=wb&ft=FBS&from=2026-01-01&to=2026-01-31
                          │
                  useFilterUrlSync
                ┌─────────┴─────────┐
         Phase 1: URL→Store    Phase 2: Store→URL
           (mount only)        (on every change)
                │                     │
         ┌─────▼─────┐        ┌──────▼──────┐
         │ Zustand    │◄──────►│ URL params  │
         │ Filters    │        │ replaceState│
         │ Store      │        └─────────────┘
         └─────┬─────┘
               │
    React Query hooks читают фильтры
    ┌──────────┼──────────┐
    │          │          │
 Dashboard   Charts    Stocks
```

## Файлы

| Компонент | Путь | Назначение |
|-----------|------|------------|
| useFiltersStore | `frontend/src/store/useFiltersStore.ts` | Глобальные фильтры дашборда |
| useAuthStore | `frontend/src/store/useAuthStore.ts` | Auth state (user, session) |
| useDashboardLayoutStore | `frontend/src/store/useDashboardLayoutStore.ts` | Widget Dashboard layout + lock |
| useFilterUrlSync | `frontend/src/hooks/useFilterUrlSync.ts` | Sync Zustand ↔ URL |
| useAuth | `frontend/src/hooks/useAuth.ts` | Инициализация auth listener |
| useDashboardConfig | `frontend/src/hooks/useDashboardConfig.ts` | Load/save dashboard config (debounced) |

## useFiltersStore — Глобальные фильтры

Файл: `frontend/src/store/useFiltersStore.ts` (40 строк)

### Interface

```ts
interface FiltersState {
  datePreset: DateRangePreset;        // '7d' | '30d' | '90d' | 'custom'
  marketplace: Marketplace;            // 'all' | 'wb' | 'ozon'
  fulfillmentType: FulfillmentType;    // 'all' | 'FBO' | 'FBS'
  customDateFrom: string | null;       // 'YYYY-MM-DD' при preset='custom'
  customDateTo: string | null;         // 'YYYY-MM-DD' при preset='custom'
  setDatePreset: (preset: DateRangePreset) => void;
  setMarketplace: (mp: Marketplace) => void;
  setFulfillmentType: (ft: FulfillmentType) => void;
  setCustomDates: (from: string, to: string) => void;
  reset: () => void;
}
```

### Дефолтные значения

```ts
const initialState = {
  datePreset: '7d',
  marketplace: 'all',
  fulfillmentType: 'all',
  customDateFrom: null,
  customDateTo: null,
};
```

### Логика actions (строки 28-40)

| Action | Поведение |
|--------|-----------|
| `setDatePreset(preset)` | Устанавливает preset, **сбрасывает** `customDateFrom` и `customDateTo` в `null` |
| `setMarketplace(mp)` | Устанавливает marketplace |
| `setFulfillmentType(ft)` | Устанавливает fulfillmentType |
| `setCustomDates(from, to)` | Устанавливает даты, **автоматически** ставит `datePreset: 'custom'` |
| `reset()` | Возвращает все значения к initialState |

Ключевая связь:
- `setDatePreset` → очищает кастомные даты (preset и custom взаимоисключающие)
- `setCustomDates` → автоматически ставит `datePreset: 'custom'` (выбор дат = кастомный период)

### Где используется

Store читается в FilterPanel для отображения текущих фильтров, а также передаётся как `DashboardFilters` объект в React Query hooks. Пример из DashboardPage:

```ts
const { datePreset, marketplace, fulfillmentType, customDateFrom, customDateTo } = useFiltersStore();

const filters: DashboardFilters = {
  date_from: dateFrom,
  date_to: dateTo,
  marketplace,
  fulfillment_type: fulfillmentType === 'all' ? undefined : fulfillmentType,
};
```

## useAuthStore — Auth State

Файл: `frontend/src/store/useAuthStore.ts` (24 строки)

### Interface

```ts
interface AuthState {
  user: User | null;                                    // Supabase User object
  session: Session | null;                              // Supabase Session (contains JWT)
  isLoading: boolean;                                   // true до первого getSession
  setAuth: (user: User | null, session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;                          // supabase.auth.signOut()
}
```

### Начальное состояние

```ts
{
  user: null,
  session: null,
  isLoading: true,   // ВАЖНО: true при старте → показывает spinner до проверки сессии
}
```

### Логика

| Action | Поведение |
|--------|-----------|
| `setAuth(user, session)` | Устанавливает user + session, **ставит** `isLoading: false` |
| `setLoading(loading)` | Меняет isLoading |
| `logout()` | `supabase.auth.signOut()` → обнуляет user и session |

### Инициализация через useAuth hook

Файл: `frontend/src/hooks/useAuth.ts` (40 строк)

Hook вызывается один раз в корне (`App.tsx` → `AppRoutes`, строка 62). Делает:

1. **Mount**: `supabase.auth.getSession()` — читает текущую сессию
   - Если токен протухает через < 60с → `supabase.auth.refreshSession()`
   - Результат → `setAuth(user, session)` (снимает isLoading)
2. **Listener**: `supabase.auth.onAuthStateChange()` — слушает login/logout/token refresh
   - Каждое изменение → `setAuth(session?.user, session)`
3. **Cleanup**: отписка от listener при unmount

```
App mount
  └─ useAuth()
       ├─ getSession()
       │    ├─ session exists + expiring → refreshSession() → setAuth()
       │    ├─ session exists + fresh → setAuth(user, session)
       │    └─ no session → setAuth(null, null)
       └─ onAuthStateChange(_event, session)
            └─ setAuth(session?.user, session)
```

## useFilterUrlSync — URL State Sync

Файл: `frontend/src/hooks/useFilterUrlSync.ts` (127 строк)

### URL параметры

| Param | Store поле | Валидные значения | Дефолт (НЕ пишется в URL) |
|-------|-----------|-------------------|---------------------------|
| `period` | `datePreset` | `7d`, `30d`, `90d`, `custom` | `7d` |
| `mp` | `marketplace` | `all`, `wb`, `ozon` | `all` |
| `ft` | `fulfillmentType` | `all`, `FBO`, `FBS` | `all` |
| `from` | `customDateFrom` | `YYYY-MM-DD` (только при period=custom) | -- |
| `to` | `customDateTo` | `YYYY-MM-DD` (только при period=custom) | -- |

### Phase 1: URL → Store (mount only, строки 54-91)

Выполняется один раз при монтировании компонента:

1. Проверяет `isInitialized.current` — если уже было, пропускает
2. Читает `window.location.search`
3. Если URL не содержит ни одного filter-param → пропускает (Zustand defaults)
4. Ставит `isUpdatingFromUrl.current = true` (блокирует Phase 2)
5. Валидирует каждый param через `Set` валидных значений:
   - `VALID_PRESETS`: `Set(['7d', '30d', '90d', 'custom'])`
   - `VALID_MP`: `Set(['all', 'wb', 'ozon'])`
   - `VALID_FT`: `Set(['all', 'FBO', 'FBS'])`
   - Даты: regex `/^\d{4}-\d{2}-\d{2}$/` + `!isNaN(Date.parse(s))`
6. Применяет валидные значения в store
7. `queueMicrotask` снимает `isUpdatingFromUrl` перед следующим рендером

### Phase 2: Store → URL (on every change, строки 94-126)

Выполняется при каждом изменении фильтров в store:

1. Пропускает если `isUpdatingFromUrl` (Phase 1 ещё идёт)
2. Пропускает если `!isInitialized` (первый рендер)
3. Читает текущие URL params → удаляет ТОЛЬКО filter-ключи (`FILTER_KEYS`)
4. Дефолтные значения НЕ пишутся в URL (чистый адрес при дефолтах)
5. `window.history.replaceState` (НЕ pushState — не засоряет history)

```ts
// Примеры URL:
// Все дефолты:          /
// WB + 30 дней:         /?period=30d&mp=wb
// FBS + кастом:         /?period=custom&ft=FBS&from=2026-01-01&to=2026-01-31
// С UTM (сохранён):     /?period=30d&utm_source=email
```

### Где подключён

Hook подключен в **FilterPanel** (НЕ в каждой странице). FilterPanel рендерится на DashboardPage, и hook синхронизирует фильтры глобально.

### Сохранение чужих params

Строки 101-102: перед записью фильтров удаляются ТОЛЬКО ключи из `FILTER_KEYS`. Все остальные params (`utm_source`, `ref`, `tab` и т.д.) сохраняются.

```ts
const FILTER_KEYS = ['period', 'mp', 'ft', 'from', 'to'] as const;

const params = new URLSearchParams(window.location.search);
FILTER_KEYS.forEach((k) => params.delete(k));
// Затем добавляются только non-default filter values
```

## Взаимодействие Stores с React Query

### Invalidation при мутациях

Mutations в hooks вызывают `queryClient.invalidateQueries()` после успеха:

```
useUpdatePurchasePrice (onSuccess)
  ├─ invalidate ['products']       // перезагрузить товары
  └─ invalidate ['dashboard']      // перезагрузить все dashboard данные

useSaveAndSync (onSuccess)
  ├─ invalidate ['tokens']
  ├─ invalidate ['dashboard']
  └─ invalidate ['sync-logs']

useResetSalesPlan (onSuccess)
  └─ invalidate ['sales-plan']     // ВСЕ sales-plan queries
```

## useDashboardLayoutStore — Widget Dashboard

Файл: `frontend/src/store/useDashboardLayoutStore.ts` (111 строк)

### Interface

```ts
interface DashboardLayoutState {
  enabledWidgets: string[];     // ordered list of widget IDs
  columnCount: number;          // 2-6 columns
  showAxisBadges: boolean;      // data axis badges on cards
  compactMode: boolean;         // smaller padding
  locked: boolean;              // disable DnD (миграция 022)
  isLoaded: boolean;            // config loaded from server
  isDirty: boolean;             // unsaved changes

  setConfig: (config) => void;
  toggleWidget: (id) => void;
  reorderWidgets: (from, to) => void;
  setColumnCount: (n) => void;
  toggleAxisBadges: () => void;
  toggleCompactMode: () => void;
  toggleLocked: () => void;     // Lock/Unlock DnD
  resetToDefaults: () => void;
  markClean: () => void;
}
```

### Persistence

Store НЕ персистится в localStorage. Вместо этого — React Query:

```
Mount → GET /dashboard/config → setConfig(serverData) → isLoaded=true
Change → isDirty=true → debounce 1.5s → PUT /dashboard/config → markClean()
```

Hook `useDashboardConfig` в `DashboardPage.tsx` связывает Zustand ↔ Backend.

### Lock Feature

`locked: boolean` контролирует DnD в `WidgetGrid`:
- `locked=false` → sensors=[PointerSensor, TouchSensor], grip dots visible
- `locked=true` → sensors=[] (empty), cursor-default, grip dots hidden

Toggle в `FilterPanel` (Lock/LockOpen icons). State автоматически сохраняется на сервер через debounced auto-save.

### Где используется

- `WidgetGrid.tsx` — читает enabledWidgets, columnCount, locked
- `SortableWidget.tsx` — получает locked как prop
- `WidgetSettingsPanel.tsx` — toggleWidget, setColumnCount, toggleAxisBadges, toggleCompactMode, resetToDefaults
- `FilterPanel.tsx` — читает locked, вызывает toggleLocked
- `useDashboardConfig.ts` — sync server ↔ store

### Store НЕ содержит серверные данные

Zustand хранит ТОЛЬКО UI-состояние:
- `useFiltersStore` — выбранные фильтры
- `useAuthStore` — auth session
- `useDashboardLayoutStore` — widget layout + lock

Серверные данные ВСЕГДА в React Query. Это соответствует правилу из coding-standards.md:

```
// CORRECT — server data via React Query
const { data } = useQuery({ queryKey: [...], queryFn: () => api.method() });

// CORRECT — UI state via Zustand
const { marketplace } = useFiltersStore();

// WRONG — server data in useState
const [data, setData] = useState([]);
```

## Data Flow: от фильтра до данных

```
1. Пользователь кликает "30 дней" в FilterPanel
   └─ useFiltersStore.setDatePreset('30d')

2. useFilterUrlSync (Phase 2) обновляет URL
   └─ /?period=30d  (replaceState)

3. React компонент (DashboardPage) читает store
   └─ const { datePreset } = useFiltersStore()

4. Компонент вычисляет dateFrom/dateTo из preset
   └─ dateFrom = subDays(today, 30)

5. Filters объект передаётся в React Query hook
   └─ useDashboardSummaryWithPrev({ date_from, date_to, marketplace })

6. React Query видит новый queryKey → refetch
   └─ dashboardApi.getSummaryWithPrev(filters)
        └─ GET /api/v1/dashboard/summary?date_from=...&date_to=...
```

## Edge Cases

1. **Невалидный URL param** — игнорируется, используются Zustand defaults. Пример: `?period=invalid` → datePreset='7d'
2. **Дефолтные значения** — НЕ пишутся в URL. URL `/` = `period=7d, mp=all, ft=all`
3. **Custom dates без period** — `?from=2026-01-01&to=2026-01-31` без `period=custom` → даты игнорируются
4. **Auth race condition** — `isLoading: true` при старте, spinner показывается до `setAuth()`. Компоненты не рендерятся с `user=null` до завершения проверки
5. **Token refresh** — `useAuth` hook проверяет `expires_at - now < 60s` при mount и обновляет токен превентивно

## Зависимости

- **Зависит от:** `zustand` (state management), `@supabase/supabase-js` (auth)
- **Используется в:** FilterPanel, DashboardPage, AdsPage, Layout, ProtectedRoute, все React Query hooks (через filters)
- **Feature gate:** нет

## Известные проблемы

- [ ] `useFilterUrlSync` использует `window.location.search` напрямую (а не React Router useSearchParams). Это сделано намеренно для избежания лишних ререндеров, но может не синхронизироваться при программной навигации через React Router
