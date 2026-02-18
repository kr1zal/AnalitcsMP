# Enterprise Settings — BrainStorm Document

> Дата: 18.02.2026 | Статус: АНАЛИЗ ЗАВЕРШЁН, ожидает утверждения

## ПРОБЛЕМА

Три разрозненных UI-элемента, которые логически принадлежат одному пространству:

| Элемент | Файл | Строк | Что содержит |
|---------|------|-------|-------------|
| **SyncPage** | `pages/SyncPage.tsx` | 270 | Статус sync, ручное обновление, логи |
| **SettingsPage** | `pages/SettingsPage.tsx` | 722 | Профиль, тариф, товары, план продаж, API-токены, onboarding flow, удаление аккаунта |
| **Аккаунт-блок** | `components/Shared/Layout.tsx` | 288 | Email + Pro badge + logout в header/mobile drawer |

**Критические проблемы:**
- SettingsPage — 722-строчный монолит (стандарт: max 200 строк)
- Дублирование: logout в Layout И в SettingsPage
- Разорванный флоу: "Сохранить и синхронизировать" на Settings, но статус — на SyncPage
- Навигация: 6 пунктов, 2 из которых сервисные (Sync + Settings)

---

## БЕНЧМАРКИНГ

### Ключевой инсайт из исследования 7 платформ

| Платформа | Где API keys | Где Sync | Где Billing | Навигация Settings |
|-----------|-------------|----------|-------------|-------------------|
| **SellerBoard** | Marketplaces tab | Marketplaces tab | Billing tab | Vertical tabs |
| **Helium10** | Settings/Accounts | Settings/Accounts | Account/Subscription | Separate pages |
| **MPStats** | Настройки | Мониторинг | Подписка | Single page |
| **Stripe** | Developer tools | Developer tools/Logs | Account | Grouped sidebar |
| **Shopify** | Apps channel | Автоматический | Plan | Flat vertical list |
| **Amplitude** | Отдельный tab | Sources | Tab | Horizontal tabs |
| **Mixpanel** | Project Settings | Нет ручного | Org Settings | Sidebar groups |

**Вывод: API keys + Sync status ВСЕГДА вместе** в маркетплейс-аналитике. Это единая ментальная модель "подключение к маркетплейсу" = credentials + connection health + sync.

---

## РЕКОМЕНДУЕМОЕ РЕШЕНИЕ: Modern SaaS (Вариант B)

Все 4 эксперта (код-аудит, UX/UI, маркетинг, архитектура) сошлись на одном решении: **единая страница `/settings` с tab-навигацией**.

### Навигация: было → стало

```
БЫЛО (6 пунктов):
  Дашборд | Заказы | Unit-экономика | Реклама | Синхронизация | Настройки

СТАЛО (5 пунктов):
  Дашборд | Заказы | Unit-экономика | Реклама | Настройки
```

### Структура вкладок

```
/settings                    → default: Подключения (или Профиль)
/settings?tab=connections    → API-токены + Sync status + логи
/settings?tab=products       → ProductManagement + SalesPlanEditor
/settings?tab=billing        → SubscriptionCard + payment callback + upsell
/settings?tab=profile        → Email, logout, удаление аккаунта
```

### Wireframe — Desktop (lg+)

```
┌─────────────────────────────────────────────────────────────┐
│  Настройки                                                    │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                    │
│ Подключ. │  ═══ Подключения маркетплейсов ═══               │
│ ● active │                                                    │
│          │  ┌─── Wildberries ───── [Подключен] ─────────┐  │
│ Товары   │  │  API Token: ●●●●●●●●●  [Проверить]       │  │
│          │  │  Последняя синхронизация: 14:30 (2ч назад) │  │
│ Тариф    │  │  Следующая: 18:30                          │  │
│          │  └───────────────────────────────────────────── │  │
│ Профиль  │                                                    │
│          │  ┌─── Ozon Seller ───── [Подключен] ─────────┐  │
│          │  │  Client ID: 123456                          │  │
│          │  │  API Key: ●●●●●●    [Проверить]            │  │
│          │  │  Синхр: 14:35 / след: 18:35                │  │
│          │  └───────────────────────────────────────────── │  │
│          │                                                    │
│          │  ┌─── Ozon Performance ── [Не указан] ────────┐  │
│          │  │  Нужен для данных о рекламе на Ozon         │  │
│          │  │  [Подключить]                                │  │
│          │  └───────────────────────────────────────────── │  │
│          │                                                    │
│          │  [Сохранить]  [Сохранить и синхронизировать]      │
│          │                                                    │
│          │  ── Ручное обновление ──                          │
│          │  [Обновить сейчас]  3/5 осталось                 │
│          │                                                    │
│          │  ── История синхронизации (collapsible) ──        │
│          │  > Показать логи                                  │
│          │                                                    │
└──────────┴──────────────────────────────────────────────────┘
```

### Wireframe — Mobile

```
┌──────────────────────────┐
│ Настройки                 │
│                           │
│ [Подключ.][Товары][Тариф]→│  ← horizontal scroll pills
│                           │
│ ┌── WB ──── [Подключен] ┐│
│ │ Token: ●●●●●●●        ││
│ │ Last sync: 14:30       ││
│ │ [Проверить]            ││
│ └────────────────────────┘│
│                           │
│ ┌── Ozon ── [Подключен] ┐│
│ │ ...                    ││
│ └────────────────────────┘│
│                           │
│ [Сохранить и синхр.]      │
│                           │
│ > Ручное обновление       │
│ > Логи синхронизации      │
└──────────────────────────┘
```

---

## КОМПОНЕНТНАЯ АРХИТЕКТУРА

### Новая структура файлов

```
pages/
  SettingsPage.tsx              ← Tab-контроллер (~80 строк, было 722)

components/Settings/
  SettingsTabs.tsx               ← NEW: Tab bar UI (vertical desktop / horizontal mobile)
  ConnectionsTab.tsx             ← NEW: API keys + sync status + sync logs + manual sync
  ProductsTab.tsx                ← NEW: обёртка ProductManagement + SalesPlanEditor
  BillingTab.tsx                 ← NEW: обёртка SubscriptionCard + payment callback
  ProfileTab.tsx                 ← NEW: email + logout + delete account
  SyncingOverlay.tsx             ← NEW: вынесенный SyncingScreen + SyncDoneScreen (overlay)

  # БЕЗ ИЗМЕНЕНИЙ:
  SubscriptionCard.tsx           ← переиспользуется в BillingTab
  ProductManagement.tsx          ← переиспользуется в ProductsTab
  SalesPlanEditor.tsx            ← переиспользуется в ProductsTab

  # ВЫНЕСТИ ИЗ SettingsPage:
  SecretInput.tsx                ← отдельный reusable компонент
  StatusBadge.tsx                ← отдельный reusable компонент

УДАЛИТЬ:
  pages/SyncPage.tsx             ← контент переезжает в ConnectionsTab
```

### Tab State

Через `useSearchParams` (уже используется для `?payment=`):

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get('tab') || 'connections';
```

Это обеспечивает: shareable URLs, browser back/forward, обработку `?payment=success` в billing tab.

### Routing Changes

```tsx
// App.tsx
// УДАЛИТЬ:
<Route path="/sync" element={<SyncPage />} />
// ДОБАВИТЬ:
<Route path="/sync" element={<Navigate to="/settings?tab=connections" replace />} />
```

### Layout Changes

```tsx
// Layout.tsx navigation — УДАЛИТЬ пункт "Синхронизация":
const navigation = [
  { name: 'Дашборд', href: '/', icon: BarChart3 },
  { name: 'Заказы', href: '/orders', icon: ClipboardList, feature: 'order_monitor' },
  { name: 'Unit-экономика', href: '/unit-economics', icon: TrendingUp },
  { name: 'Реклама', href: '/ads', icon: Package },
  // УДАЛЕНО: { name: 'Синхронизация', href: '/sync', icon: RefreshCw },
  { name: 'Настройки', href: '/settings', icon: Settings },
];
```

---

## МАРКЕТИНГОВЫЕ УЛУЧШЕНИЯ (Phase 2)

### Value Hero — секция "Ваша аналитика в цифрах"

Показать конкретную ценность на странице настроек:

```
┌──────────────────────────────────────────────────┐
│  Ваша аналитика                                   │
│                                                    │
│  1 247 заказов   5 товаров    47 дней   ~12ч      │
│  обработано      отслеживается  с нами  сэкономлено│
└──────────────────────────────────────────────────┘
```

Формула: `количество_синхронизаций × 15 минут` (15 мин — среднее время ручного сбора из ЛК)

### Контекстный Upsell (вместо таблицы тарифов)

**Для Free:**
```
Что вы получите на Pro:
  [x] Ozon — видеть ВСЮ выручку, а не только WB
  [x] 20 SKU вместо 3
  [x] Unit-экономика: прибыль по каждому товару
  [x] PDF отчёты для партнёров

  [Подключить Pro — 990 руб/мес]
  Отменить можно в любой момент
```

### Usage Meters

```
SKU:              ████████░░  16/20
Ручные обновления: █████░░░░░  1/5 сегодня
```

### Upgrade Triggers (по контексту)

| Контекст | Текст |
|----------|-------|
| SKU лимит | "3 из 3 SKU. Новые товары не импортируются. [Расширить →]" |
| Ozon токен на Free | "Ozon подключен! Для просмотра нужен Pro" |
| PDF экспорт | "PDF доступен на Pro. [Попробовать за 990 руб/мес]" |
| Ручная синхронизация (Free) | "Ручное обновление доступно на Pro" |

---

## ПЛАН РЕАЛИЗАЦИИ

### Phase 1: MVP объединённой страницы (основная работа)

| Шаг | Действие | Файлы |
|-----|----------|-------|
| 1 | Вынести SecretInput, StatusBadge из SettingsPage | +2 новых файла |
| 2 | Создать ConnectionsTab (API keys + sync) | +1 файл (~350 строк) |
| 3 | Создать ProfileTab (email + logout + delete) | +1 файл (~80 строк) |
| 4 | Создать BillingTab (SubscriptionCard + payment) | +1 файл (~50 строк) |
| 5 | Создать ProductsTab (обёртка PM + SPE) | +1 файл (~30 строк) |
| 6 | Создать SyncingOverlay (syncing/done экраны) | +1 файл (~150 строк) |
| 7 | Создать SettingsTabs (tab bar UI) | +1 файл (~80 строк) |
| 8 | Переписать SettingsPage (tab-контроллер) | ~80 строк (было 722) |
| 9 | Обновить App.tsx (redirect /sync) | ~3 строки |
| 10 | Обновить Layout.tsx (убрать Синхронизацию) | ~5 строк |
| 11 | Удалить SyncPage.tsx | -270 строк |
| 12 | npm run build + проверка | — |

**Итого:** +8 файлов, -2 файла. ~800 строк нового кода, ~900 удалённого. Нет новых API endpoints.

### Phase 2: Маркетинг (отдельная задача)

- Value Hero секция
- Контекстный upsell в BillingTab
- Usage meters
- Feature gate previews (blur + overlay)

### Phase 3: Enterprise (при росте)

- Live sync indicator в header (пульсирующий dot)
- User dropdown (вместо inline email в header)
- Connection Health Map
- Activity stream (вместо таблицы логов)

---

## ОБРАТНАЯ СОВМЕСТИМОСТЬ

| Старый URL | Новый URL | Механизм |
|-----------|-----------|----------|
| `/sync` | `/settings?tab=connections` | `<Navigate>` redirect |
| `/settings` | `/settings?tab=connections` | tab по умолчанию |
| `/settings?payment=success` | `/settings?tab=billing&payment=success` | обработка в BillingTab |

---

## РИСКИ

1. **ProductManagement (750 строк) + SalesPlanEditor (292 строки)** — тяжёлые компоненты. При переключении табов будут unmount/remount. React Query кэширует данные, DOM рендер быстрый. При необходимости — `display: none` вместо unmount.

2. **Onboarding flow** — сейчас новый пользователь попадает на `/settings`. После рефакторинга нужно направлять на `/settings?tab=connections` с баннером "Подключите маркетплейсы".

3. **SyncingOverlay** — полноэкранное состояние при первой синхронизации. Вынести в overlay (position fixed, z-50), управлять через shared state.
