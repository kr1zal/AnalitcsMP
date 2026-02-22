# Layout, Routing, Feature Gates

> Основной Layout (навигация + контент), маршрутизация, ProtectedRoute, FeatureGate, тарифные планы

**Правила CLAUDE.md:** #6 (Auth Hybrid), #29 (Enterprise Settings URL tabs), #32 (FBS pills)

## Визуальная структура

### Desktop (md+)

```
┌──────────────────────────────────────────────────┐
│ [Logo] Analytics    Nav: Дашборд|Заказы|UE|Реклама|Настройки    [Pro] email [Выйти] │
├──────────────────────────────────────────────────┤
│                                                  │
│                 <Outlet />                        │
│            (текущая страница)                     │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Mobile (< 640px)

```
┌────────────────────────────┐
│                        [◄] │  ← язычок справа (25% от верха)
│                            │
│       <Outlet />           │
│    (текущая страница)      │
│                            │
└────────────────────────────┘

При клике на язычок:

┌────────────────────────────┐
│                   ┌────────┤
│   overlay         │ [X]    │
│   bg-black/40     │ Дашборд│
│                   │ Заказы │
│                   │ UE     │
│                   │ Реклама│
│                   │ Настр. │
│                   │        │
│                   │ email  │
│                   │ [Выйти]│
│                   │← свайп │
│                   └────────┤
└────────────────────────────┘
```

## Файлы

| Компонент | Путь | Props |
|-----------|------|-------|
| App | `frontend/src/App.tsx` | -- |
| Layout | `frontend/src/components/Shared/Layout.tsx` | -- |
| ProtectedRoute | `frontend/src/components/Shared/ProtectedRoute.tsx` | `{ children: ReactNode }` |
| FeatureGate | `frontend/src/components/Shared/FeatureGate.tsx` | `{ feature: keyof SubscriptionFeatures, children: ReactNode, hide?: boolean }` |
| Plans (backend) | `backend/app/plans.py` | -- |

## App.tsx — Routing

Файл: `frontend/src/App.tsx` (103 строки)

### QueryClient (строки 24-32)

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

### Иерархия компонентов

```
<QueryClientProvider>
  <BrowserRouter>
    <AppRoutes />              // useAuth() вызывается здесь
  </BrowserRouter>
  <Toaster position="top-right" richColors />
</QueryClientProvider>
```

### Все маршруты (строки 65-89)

| Путь | Компонент | Auth | Описание |
|------|-----------|------|----------|
| `/login` | `LoginPage` | Нет | Страница входа |
| `/reset-password` | `ResetPasswordPage` | Нет | Сброс пароля |
| `/print` | `PrintPage` | JWT через `?token=` | PDF-рендер для Playwright |
| `/legal` | `LegalPage` | Нет | Оферта |
| `/policy` | `PolicyPage` | Нет | Политика конфиденциальности |
| `/privacy` | `PrivacyPage` | Нет | Обработка данных |
| `/` | `DashboardPage` | Да (ProtectedRoute) | Главный дашборд |
| `/orders` | `OrderMonitorPage` | Да | Монитор заказов |
| `/unit-economics` | `UnitEconomicsPage` | Да | Unit-экономика |
| `/products` | Redirect → `/unit-economics` | -- | Обратная совместимость |
| `/ads` | `AdsPage` | Да | Рекламная аналитика |
| `/sync` | Redirect → `/settings?tab=connections` | -- | Обратная совместимость |
| `/settings` | `SettingsPage` | Да | Настройки (5 табов) |

### RootLayout (строки 38-58)

Корневой layout определяет, что показывать:

```ts
function RootLayout() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) return <Spinner />;      // Ожидание auth check
  if (!user)     return <LandingPage />;   // Неавторизован → лендинг
  return (
    <ProtectedRoute>
      <Layout />                           // Авторизован → приложение
    </ProtectedRoute>
  );
}
```

Ключевой момент: путь `/` при отсутствии auth показывает `LandingPage` (НЕ redirect на `/login`).

## Layout.tsx — Навигация

Файл: `frontend/src/components/Shared/Layout.tsx` (288 строк)

### Навигационные пункты (строки 15-26)

```ts
const navigation = [
  { name: 'Дашборд',        href: '/',               icon: BarChart3 },
  { name: 'Заказы',         href: '/orders',          icon: ClipboardList, feature: 'order_monitor' },
  { name: 'Unit-экономика', href: '/unit-economics',  icon: TrendingUp },
  { name: 'Реклама',        href: '/ads',             icon: Package },
  { name: 'Настройки',      href: '/settings',        icon: Settings },
];
```

Пункты с `feature` фильтруются по подписке (строки 112-113):
```ts
navigation.filter((item) => !item.feature || subscription?.features?.[item.feature])
```

Если у пользователя нет `order_monitor` в подписке → "Заказы" не показывается в меню.

### Desktop навигация (строки 100-163)

- `<header>` с `sticky top-0 z-40`
- Горизонтальное меню `<nav>` с `space-x-1`
- Активный пункт: `bg-indigo-50 text-indigo-700`
- Справа: badge тарифа (Free/Pro/Business), email, кнопка выхода
- Badge цвета: free → `bg-gray-100`, pro → `bg-indigo-100`, business → `bg-amber-100`
- Определение mobile: `useIsMobile()` hook (`max-width: 639px`)

### Mobile навигация (строки 166-280)

- Десктопный header НЕ рендерится на мобильных (`!isMobile && <header>`)
- **Язычок** (tab trigger): фиксирован справа, `top-[25%]`, 48px touch target, 16px полоска с chevron
- **Панель**: `fixed right-0 z-50 h-full w-[min(240px,75vw)]`, slide-in/out анимация
- **Overlay**: `bg-black/40 backdrop-blur-[2px]`, закрывает при клике
- **Swipe**: touch handlers для закрытия свайпом вправо (threshold 60px)
- **ESC**: закрывает панель по нажатию Escape
- **Блокировка скролла**: `document.body.style.overflow = 'hidden'` при открытой панели
- Закрывается при смене маршрута (строки 45-48)

### Вертикальные рассечения

```
Layout.tsx (288 строк)
├── строки 1-14:    imports
├── строки 15-26:   navigation config
├── строки 28-29:   SWIPE_THRESHOLD = 60
├── строки 31-48:   state + route change listener
├── строки 50-66:   ESC handler + scroll lock
├── строки 68-95:   touch handlers (start/move/end)
├── строка 98:      root div с [overflow-x:clip]
├── строки 100-163: desktop header render
├── строки 166-280: mobile panel render
└── строки 282-284: main content (<Outlet />)
```

## ProtectedRoute — Защита маршрутов

Файл: `frontend/src/components/Shared/ProtectedRoute.tsx` (31 строка)

### Логика проверок (в порядке приоритета)

```
1. isLoading || tokensLoading → Spinner
2. !user → Navigate to /login
3. !hasAnyTokens && pathname != /settings → Navigate to /settings (onboarding)
4. OK → render children
```

### Onboarding flow (строки 25-28)

Если пользователь зарегистрировался, но не ввёл API-токены:
- `tokensStatus?.has_wb || tokensStatus?.has_ozon_seller` = false
- Redirect на `/settings` с `state: { onboarding: true }`
- Исключение: если уже на `/settings` — не редиректит (иначе бесконечный цикл)

### Prefetch

Строка 10: `useSubscription()` вызывается в ProtectedRoute для prefetch данных подписки. Все дочерние компоненты получат данные из кэша React Query.

## FeatureGate — Тарифные ограничения

Файл: `frontend/src/components/Shared/FeatureGate.tsx` (55 строк)

### Props

```ts
interface FeatureGateProps {
  feature: keyof SubscriptionFeatures;  // название фичи
  children: React.ReactNode;             // защищённый контент
  hide?: boolean;                        // true = полностью скрыть (вместо overlay)
}
```

### Логика

```
isLoading → показать children (оптимистично)
hasAccess → показать children
!hasAccess + hide → null (скрыть)
!hasAccess + !hide → overlay с замком + ссылка на /settings?tab=billing
```

### Overlay (строки 37-54)

```
┌──────────────────────────┐
│  [контент blur + opacity]│
│  ┌──────────────────┐    │
│  │     [Lock icon]  │    │
│  │  Доступно на     │    │
│  │  тарифе Pro      │    │
│  │  [Подробнее →]   │    │
│  └──────────────────┘    │
└──────────────────────────┘
```

Контент рендерится (для SEO и визуального контекста), но с `pointer-events-none opacity-30 blur-[2px]`.

### Маппинг фич на минимальный тариф (строки 12-20)

```ts
const MIN_PLAN_MAP = {
  costs_tree_details: 'Pro',
  unit_economics:     'Pro',
  ads_page:           'Pro',
  pdf_export:         'Pro',
  period_comparison:  'Pro',
  order_monitor:      'Business',
  api_access:         'Business',
};
```

## Тарифные планы — Backend

Файл: `backend/app/plans.py` (119 строк)

### Таблица планов

| Feature | Free | Pro (990 руб/мес) | Business (2990 руб/мес) |
|---------|------|-------|----------|
| `dashboard` | + | + | + |
| `costs_tree_basic` | + | + | + |
| `costs_tree_details` | -- | + | + |
| `unit_economics` | -- | + | + |
| `ads_page` | -- | + | + |
| `pdf_export` | -- | + | + |
| `period_comparison` | -- | + | + |
| `fbs_analytics` | -- | + | + |
| `order_monitor` | -- | -- | + |
| `api_access` | -- | -- | + |

### Лимиты по планам

| Лимит | Free | Pro | Business |
|-------|------|-----|----------|
| max_sku | 3 | 20 | unlimited |
| marketplaces | WB | WB + Ozon | WB + Ozon |
| auto_sync | нет | да (6h) | да (2h) |
| manual_sync_limit | 0 | 1/день | 2/день |
| sync_priority | 2 (низший) | 1 | 0 (высший) |

### Business tier

Строка 57: `"visible": False` — Business тариф скрыт в UI (правило CLAUDE.md: "Hide Business tier"). Скрывается на фронтенде до полировки Order Monitor.

### Helper-функции

```python
get_plan(plan_name: str) -> dict       # Получить конфиг плана (fallback → free)
has_feature(plan_name: str, feature: str) -> bool  # Проверить доступ к фиче
get_next_sync_utc(plan_name: str) -> datetime      # Следующее время авто-синхронизации
```

## SubscriptionFeatures — TypeScript тип

Файл: `frontend/src/types/index.ts` (строки 446-457)

```ts
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
}
```

## Data Flow — Auth

```
App mount
  └─ AppRoutes: useAuth() инициализирует listener
       └─ supabase.auth.getSession()
            ├─ session → setAuth(user, session) → isLoading=false
            └─ no session → setAuth(null, null) → isLoading=false

RootLayout
  └─ isLoading? → Spinner
  └─ !user? → LandingPage
  └─ user → ProtectedRoute
       ├─ tokensLoading? → Spinner
       ├─ !hasTokens? → Redirect /settings (onboarding)
       └─ OK → Layout → <Outlet />
```

## Data Flow — Feature Gate

```
FeatureGate({ feature: 'unit_economics', children })
  └─ useSubscription()
       queryKey: ['subscription']
       └─ GET /api/v1/subscription
            └─ Backend: subscription.py → get_my_subscription()
                 └─ plans.py: PLANS[user.plan].features
                      └─ { unit_economics: true/false }
  └─ sub.features.unit_economics?
       ├─ true → render children
       └─ false → overlay "Доступно на тарифе Pro"
```

## Utility Hooks

### useIsMobile / useIsTablet / useIsDesktop

Файл: `frontend/src/hooks/useMediaQuery.ts` (32 строки)

```ts
useIsMobile()   → (max-width: 639px)
useIsTablet()   → (min-width: 640px) and (max-width: 1023px)
useIsDesktop()  → (min-width: 1024px)
```

Используется в Layout для переключения desktop/mobile навигации.

### useInView

Файл: `frontend/src/hooks/useInView.ts` (49 строк)

IntersectionObserver-based hook для lazy loading компонентов. Поддерживает `once: true` для однократной загрузки (графики Recharts).

```ts
const { ref, inView } = useInView<HTMLDivElement>({ once: true });
// inView=true после первого появления в viewport
```

## Edge Cases

1. **Первый вход** — `isLoading=true` → spinner → auth check → `user=null` → LandingPage
2. **Нет токенов** — ProtectedRoute ловит и редиректит на `/settings` с `state: { onboarding: true }`
3. **FeatureGate при загрузке** — показывает контент оптимистично (строка 26: `if (isLoading) return <>{children}</>`)
4. **Business hidden** — `visible: false` в plans.py, фильтруется на фронтенде в PricingSection
5. **Redirect legacy routes** — `/products` → `/unit-economics`, `/sync` → `/settings?tab=connections`
6. **Mobile панель** — закрывается при: смене маршрута, ESC, клике overlay, свайпе вправо > 60px

## Зависимости

- **Зависит от:** useAuthStore (auth state), useSubscription (тариф), useTokensStatus (onboarding), react-router-dom (routing)
- **Используется в:** Все защищённые страницы рендерятся внутри Layout через `<Outlet />`
- **Feature gate:** Навигация фильтрует пункты по `subscription.features`. FeatureGate используется внутри страниц для блокировки секций

## CSS: overflow-x:clip

Файл: `frontend/src/components/Shared/Layout.tsx` (строка 98)

Корневой `<div>` контейнер Layout использует `[overflow-x:clip]` (Tailwind arbitrary value) вместо `overflow-x-hidden`.

**Причина:** `overflow-x-hidden` создаёт scroll container, что ломает `position: sticky` у FilterPanel. `overflow-x: clip` обрезает контент без создания scroll container — FilterPanel корректно прилипает к верху.

```tsx
// Layout.tsx — root wrapper (строка 98)
<div className="min-h-screen bg-gray-50 [overflow-x:clip]">
  {/* header (desktop) | mobile panel */}
  <main>
    <Outlet />
  </main>
</div>
```

**Правило:** НИКОГДА не менять на `overflow-x-hidden` или `overflow-hidden` — это сломает sticky FilterPanel.

## Известные проблемы

- [ ] Business tier скрыт (`visible: false`) — активировать после полировки Order Monitor
- [ ] `order_monitor` feature gate = Business, но в навигации фильтруется через `subscription.features.order_monitor` — корректно при текущей конфигурации планов
