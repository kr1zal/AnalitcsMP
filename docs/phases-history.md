# История фаз проекта (подробности)

## SaaS Phase 1: Auth + RLS — DEPLOYED (08.02.2026)
- JWT middleware (JWKS), RLS на всех таблицах, user_id во всех данных
- Cron: X-Cron-Secret + X-Cron-User-Id headers
- Подробности: [../memory/saas-phase1.md](../memory/saas-phase1.md)

## SaaS Phase 2: Onboarding — DEPLOYED (09.02.2026)
- Fernet encryption, mp_user_tokens таблица, SettingsPage
- ProtectedRoute → redirect /settings если нет токенов
- Подробности: [../memory/saas-phase2.md](../memory/saas-phase2.md)

## SaaS Phase 3: Subscription Tiers — DEPLOYED (09.02.2026)
- 3 тарифа: Free / Pro (990₽) / Business (2990₽), без оплаты (admin-managed)
- Backend: plans.py, subscription.py (Depends), feature gates на dashboard/export/sync
- Frontend: FeatureGate (blur+lock), SubscriptionCard, plan badge в header
- Подробности: [../memory/saas-phase3.md](../memory/saas-phase3.md)

## SaaS Phase 4: Sync Queue — DEPLOYED (09.02.2026)
- DB-based queue (mp_sync_queue) + cron `/sync/process-queue` каждые 30 мин
- Расписание: Business 06/12/18/00 MSK, Pro +1ч, Free 08:00/20:00
- Ручной sync: Free:0, Pro:1/день, Business:2/день
- Endpoint: POST /sync/manual, GET /sync/status, POST /admin/sync/{user_id}
- SyncPage: статус-панель + кнопка "Обновить сейчас" + история
- Подробности: [../memory/saas-phase4.md](../memory/saas-phase4.md)

## Order Monitor v1 (Воронка) — READY (09.02.2026)
- Агрегированная воронка заказов: Заказы → Выкупы → Возвраты (из mp_sales)
- Pro/Business фича: feature gate `order_monitor` в plans.py
- Индикатор непроведённых: сравнение mp_sales.revenue vs costs-tree settled
- Backend: GET /dashboard/order-funnel (dashboard.py)

## Order Monitor v2 (Позаказная детализация + SPP fix) — READY (10.02.2026)
- Таблица mp_orders: одна строка = один заказ/отправление (migration 011)
- WB sync: 3-step enrichment (get_orders → get_sales → get_report_detail), accumulate financial data
- Ozon sync: FBS + FBO (get_posting_fbs_list + get_posting_fbo_list), per-product financials
- Ozon posting_status format: "FBO:delivered", "FBS:cancelled"
- **sale_price:** WB retail_price_withdisc_rub (после СПП), Ozon = price
- Backend: GET /dashboard/orders (пагинация+фильтры), GET /dashboard/orders/{id}
- Frontend: позаказная таблица, мобильные карточки, пагинация 50/стр

## Phase 5: Landing Page — DEPLOYED (10-14.02.2026)
- `frontend/src/pages/LandingPage.tsx` (~2000 lines, все секции в одном файле)
- Route `/` для неавторизованных → Landing, авторизованные → `/app`
- Зависимости: @fontsource/inter, swiper (карусель)
- Секции: NavBar, Hero, TrustBar, DashboardCarousel, StatsBar, Problem, Features, DataFlowV3, HowItWorks, Security, Pricing, FAQ, FinalCTA, Footer
- DataFlowV3: desktop SVG (1000×590) + mobile SVG (300×450)
- PRO блок: скрыт через `SHOW_PRO = false`
- Pricing: всегда grid-cols-2
- MatrixRain: canvas-based digital rain (hero), indigo/violet colors

## Phase 5: YooKassa Payment — TESTED & DEPLOYED (14.02.2026)
- Интеграция оплаты Pro подписки (990₽/мес) через ЮКассу (httpx, без SDK)
- ShopID: 1273909 (live), тестовый: 1276568
- Эндпоинты: POST /subscription/upgrade, POST /subscription/webhook, POST /subscription/cancel, POST /subscription/enable-auto-renew
- Webhook: IP whitelist + двойная верификация платежа
- Подробности: [yookassa-integration.md](yookassa-integration.md)

## Auth Flow — DEPLOYED (14.02.2026)
- LoginPage: 3 режима (login, signup, forgot-password) + emailRedirectTo
- ResetPasswordPage: ввод нового пароля после перехода по ссылке
- Удаление аккаунта: Danger Zone в SettingsPage → DELETE /api/v1/account
- Email-шаблоны: брендированные (RevioMP, indigo-600), на русском
- Подробности: [auth-flow.md](auth-flow.md)

## Product Management — DEPLOYED (15.02.2026)
- Компонент: `frontend/src/components/Settings/ProductManagement.tsx` (~700 строк)
- Drag & Drop: @dnd-kit, сортировка, связки (groups), себестоимость (CC)
- Backend: 5 эндпоинтов в products.py
- Migration 013: sort_order + product_group_id
- Подробности: [product-management.md](product-management.md)

## UE Profit Fix + P1 Features (15.02.2026)
- UE profit = Dashboard profit: пропорциональное распределение payout по товарам
- P1.1 ДРР по товарам: `ad_cost / revenue × 100%`
- P1.2 Прогноз остатков: `days_remaining = total_quantity / avg_daily_sales(30d)`

## СПП в Продажах — DEPLOYED (15.02.2026)
- WB credits (СПП, возмещения) включены в "Продажи" везде
- displayed_revenue = costs_tree_sales + credits
- costsTreeRatio использует ЧИСТЫЕ продажи (без credits)
- Сноска "вкл. СПП +X₽" на WB карточке

## Прибыль per OZON/WB — DEPLOYED (15.02.2026)
- Прибыль в карточках MarketplaceBreakdown: `profit_mp = payout_mp - purchase×share - ad×share`
- HelpCircle тултипы на всех метриках (Продажи, Начислено, Прибыль)
- Суммы без символа ₽ (мобильная оптимизация)

## Dashboard v2: Визуализация прибыли — DEPLOYED (15.02.2026)

Три новых компонента на главной странице, заменившие AvgCheckChart (средний чек — vanity metric).

### 1. ProfitWaterfall (Структура прибыли)
- **Файл:** `frontend/src/components/Dashboard/ProfitWaterfall.tsx`
- Каскад: Продажи → −Удерж.МП → −Закупка → −Реклама = Прибыль
- Div-based бары (НЕ Recharts) — пропорциональны к выручке
- Маржа % в заголовке, красный цвет при убытке
- Скрывает нулевые строки расходов
- Расположение: между карточками плашек и MarketplaceBreakdown

### 2. ProfitChart (Тренд прибыли)
- **Файл:** `frontend/src/components/Dashboard/ProfitChart.tsx`
- Dual AreaChart (Recharts): выручка (зелёная, фон) + прибыль (индиго, передний план)
- Визуальный зазор между area = расходы
- Прибыль = оценка по средней марже периода: `dailyProfit ≈ dailyRevenue × profitMargin`
- `profitMargin = netProfit / revenue` (из DashboardPage)
- Красный цвет при отрицательной марже
- Lazy-loaded (Recharts зависимость)
- Заменил AvgCheckChart в секции графиков

### 3. TopProductsChart (Топ товаров по прибыли)
- **Файл:** `frontend/src/components/Dashboard/TopProductsChart.tsx`
- Горизонтальные бары: топ-5 товаров по net_profit
- Масштабируется на 100+ SKU: всегда показывает только 5 лучших
- Ссылка "все N →" на /unit-economics при >5 товаров
- Предупреждение об убыточных: "X товаров убыточны · худший: Название −Сумма"
- Фильтрует WB_ACCOUNT (системный продукт)
- Расположение: перед StocksTable

### Изменения в DashboardPage
- UE данные (`useUnitEconomics`) загружаются всегда при наличии summaryData (для TopProductsChart)
- Добавлен расчёт `profitMargin = netProfitForTile / revenueForTile`
- AvgCheckChart lazy-import заменён на ProfitChart
- Новый порядок: Cards → ProfitWaterfall → MarketplaceBreakdown → Charts (Sales, Profit, DRR) → TopProductsChart → StocksTable

### 4. ConversionChart (Конверсия выкупа)
- **Файл:** `frontend/src/components/Dashboard/ConversionChart.tsx`
- AreaChart: `sales / orders × 100%` по дням
- Голубой цвет (#0ea5e9 / #e0f2fe), lazy-loaded
- Тултип: конверсия %, заказы шт, выкупы шт
- Расположение: 4-я ячейка в 2x2 grid (рядом с ДРР)

### Desktop layout (lg+)
```
[Карточки метрик]
[OZON | WB]
[Sidebar | Заказы    | Прибыль   ]
[        | ДРР       | Конверсия ]
[Структура прибыли | Топ товаров]
[Остатки на складах]
```

### Архитектурные решения
- **#22:** ProfitChart — lazy-loaded dual area (Recharts), margin estimation
- **#23:** ProfitWaterfall — div-based (НЕ Recharts), lightweight
- **#24:** TopProductsChart — top 5 + link, фильтрация WB_ACCOUNT
- **#25:** ConversionChart — `sales/orders × 100%`, lazy-loaded, sky-blue
- **#26:** Dashboard layout — 2x2 charts grid + analytics row (Waterfall|TopProducts)

---

## WB Методология расчётов — ФИНАЛ (аудит 15.02.2026)

**Статус: ВЕРИФИЦИРОВАН на реальных данных. Двойного учёта СПП нет.**

### Источник данных
Таблица `mp_costs_details` (из WB финансового отчёта API). Каждая строка = операция с полями: `category`, `subcategory`, `amount` (±), `date`, `marketplace`, `user_id`.

### SQL RPC `get_costs_tree()`
Агрегирует `mp_costs_details` по `category`, строит дерево. Ключевые расчёты:
- `total_accrued = SUM(ALL amounts)` — итоговая выплата от WB
- `percent_base_sales = ABS(SUM(amounts WHERE category='Продажи'))` — база для %

### Структура дерева (tree)
```
Продажи:          +N  (чистые продажи — ПОЛОЖИТЕЛЬНОЕ)
Вознаграждение:   -N  (комиссия WB)
Доставка:         -N  (логистика)
Хранение:         -N
Эквайринг:        -N
Прочие/СПП:       +N  (CREDIT — положительное, не «Продажи»)
Возмещения:       +N  (CREDIT)
```

### Инвариант (проверен)
```
total_accrued = Σ(все tree items) = Продажи + Credits + Удержания
Пример: 7866 + 3243 + (-2713) = 8396 = total_accrued ✓
```

### Метрики Dashboard → WB Card

| Метрика | Формула | Что показывает |
|---------|---------|----------------|
| **Продажи** | `salesItem.amount + creditsTotal` | Чистые продажи + СПП/возмещения |
| **Начислено** | `total_accrued` (из RPC) | Реальная выплата от WB |
| **Удержания** | `SUM(negative tree items)` | Комиссия + доставка + хранение + ... |
| **Прибыль** | `total_accrued - purchase×ratio - ad×ratio` | Чистая прибыль |

### costsTreeRatio
```
costsTreeRatio = pure_sales / mp_sales_revenue
```
- `pure_sales` = tree item "Продажи" (БЕЗ credits/СПП)
- Credits НЕ входят в ratio — они компенсация от МП, не от продаж
- Ratio = доля проведённых заказов (1.0 = все заказы проведены)

### Per-marketplace profit
```
share = pureSales_mp / totalPureSales (OZON+WB)
profit_mp = payout_mp - adjustedPurchase×share - ad×share
```
Гарантия: `profit_ozon + profit_wb = dashboard_profit`

### Почему двойного учёта СПП НЕТ
1. СПП входит в `total_accrued` (пейаут) через SUM всех amounts в SQL
2. `displayed_revenue` (Продажи + credits) используется ТОЛЬКО для отображения
3. `costsTreeRatio` использует чистые sales (без credits)
4. Прибыль считается от `total_accrued` (пейаут), НЕ от `displayed_revenue`
5. Сходимость: `displayed_revenue + удержания = начислено` ✓

## OZON Методология расчётов — ФИНАЛ (аудит 15.02.2026)

**Статус: ВЕРИФИЦИРОВАН на реальных данных. Расхождение с ЛК = 0.00₽ по всем категориям.**

### Источник данных
Таблица `mp_costs_details` (из OZON Finance API `get_finance_transaction_list`). Каждая операция классифицируется в `_classify_ozon_operation()` → записи с `category`, `subcategory`, `amount` (±).

### Структура дерева (tree) — 6 категорий
```
Продажи:                  +7097.00  (Выручка + Баллы + Партнёры)
Вознаграждение Ozon:      -1950.28  (комиссия МП)
Услуги доставки:           -701.55  (логистика)
Услуги агентов:            -183.48  (эквайринг + доставка до ПВЗ + звёздные товары)
Услуги FBO:                -452.78  (хранение на складах)
Продвижение и реклама:      -22.95  (бонусы продавца)
──────────────────────────────────
total_accrued:             3785.96  = SUM(всех items)
```

### Ключевые отличия от WB
| Аспект | OZON | WB |
|--------|------|-----|
| **Credits (СПП)** | НЕТ — нет положительных items кроме "Продажи" | ЕСТЬ (СПП, возмещения) |
| **Продажи** | = tree["Продажи"] (Выручка + Баллы + Партнёры) | = tree["Продажи"] + credits |
| **Удержания** | = SUM(все items кроме "Продажи") — все отрицательные | = SUM(только отрицательные items) |
| **API источник** | `get_finance_transaction_list` (Finance API v3) | `reportDetailByPeriod` (финотчёт) |
| **Multi-item** | items[] в операции → распределение по quantity | Каждая строка = одна операция |

### Формулы (OZON Card)

| Метрика | Формула | Откуда |
|---------|---------|--------|
| **Продажи** | `tree["Продажи"].amount` | costs-tree RPC |
| **Начислено** | `total_accrued` = SUM(всех tree items) | costs-tree RPC |
| **Удержания** | `SUM(tree items кроме "Продажи")` | фронтенд |
| **Прибыль** | `total_accrued - purchase×share - ad×share` | DashboardPage |

### Per-MP profit
```
ozonPureSales = tree["Продажи"].amount (без credits — у OZON их нет)
share = ozonPureSales / (ozonPureSales + wbPureSales)
profit_ozon = ozon_total_accrued - adjustedPurchase × share - ad × share
```
Гарантия: `profit_ozon + profit_wb = dashboard_profit` ✓ (проверено: 1013.40 = 1013.40)

### Сверка с ЛК (период 16–22.01.2026)

| Категория | CSV (ЛК) | Наши данные | Diff |
|-----------|----------|-------------|------|
| Продажи | 7097.00 | 7097.00 | **0.00** |
| Вознаграждение Ozon | -1950.28 | -1950.28 | **0.00** |
| Услуги доставки | -701.55 | -701.55 | **0.00** |
| Услуги агентов | -183.48 | -183.48 | **0.00** |
| Услуги FBO | -452.78 | -452.78 | **0.00** |
| Продвижение | -22.95 | -22.95 | **0.00** |
| **Итого (Начислено)** | **3785.96** | **3785.96** | **0.00** |

### Почему расчёт OZON корректен
1. `total_accrued = SUM(all amounts)` — единый расчёт пейаута
2. У OZON нет credits → нет риска двойного учёта
3. "Продажи" включают Выручку + Баллы + Партнёров (как в ЛК)
4. costsTreeRatio использует чистые "Продажи" (у OZON = displayed, т.к. нет credits)
5. Прибыль считается от `total_accrued` (пейаут), НЕ от "Продажи"

## Sales Plan Audit & Fixes — DEPLOYED (18.02.2026)

Комплексный аудит механизма плана продаж (4 агента: backend, frontend UX, сценарии, CJM).

### Исправленные баги (P1)
1. **Completion inflation** (`sales_plan.py`): marketplace=all + план только на WB → actual считал WB+Ozon. Fix: `active_mps` list, actual только по МП с планами
2. **wbPlanMap actual mismatch** (`UnitEconomicsPage.tsx`): `planData.by_product` содержал all-MP actual, а план per-MP. Fix: actual из `wbData.products`/`ozonData.products`
3. **Footer weighted avg** (`UeTable.tsx`): простое среднее `Σ%/N` вместо взвешенного. Fix: `totalPlanCompletion` prop из backend `completion_percent`
4. **FeatureGate**: Free-пользователи видели план. Fix: SalesPlanEditor + PlanCompletionCard обёрнуты в FeatureGate
5. **SaveInput data loss** (`SaveInput.tsx`): server sync перезаписывал ввод при фокусе. Fix: `isFocusedRef`, skip sync при focus
6. **Consistency warnings** (`SalesPlanEditor.tsx`): предупреждения при Σ(МП) > total, Σ(товары) > МП, total + МП coexist

### Вынос "План продаж" в отдельный таб
- `PlanTab.tsx` — обёртка SalesPlanEditor + FeatureGate
- `ProductsTab.tsx` — теперь только ProductManagement
- `SettingsTabs.tsx` — 5 табов: Подключения | Товары | **План продаж** | Тариф | Профиль
- `SettingsPage.tsx` — routing для нового таба
- URL: `/settings?tab=plan`

## Enterprise Settings — DEPLOYED (18.02.2026)

Объединение трёх элементов (SyncPage, SettingsPage-монолит, аккаунт-блок) в единую enterprise `/settings` с табами.

### Архитектура
- **Паттерн:** SellerBoard/Stripe unified settings — вертикальный sidebar (md+) / горизонтальные pills (mobile)
- **URL state:** `?tab=connections|products|billing|profile` через `useSearchParams`
- **ARIA:** `role="tablist/tab/tabpanel"`, `aria-selected`, `aria-controls`
- **SyncingOverlay:** full-screen фазовый overlay (idle → syncing → done) с логарифмическим прогресс-баром

### 5 табов
| Таб | Компонент | Содержимое |
|-----|-----------|-----------|
| **Подключения** | `ConnectionsTab.tsx` (~350 строк) | API-токены (WB, Ozon×2) + статус синхронизации + ручной sync + логи |
| **Товары** | `ProductsTab.tsx` | ProductManagement |
| **План продаж** | `PlanTab.tsx` | SalesPlanEditor (FeatureGate: Pro+) |
| **Тариф** | `BillingTab.tsx` | SubscriptionCard + обработка `?payment=success/fail` |
| **Профиль** | `ProfileTab.tsx` | Email + logout + удаление аккаунта (double-confirm) |

### Переиспользуемые компоненты
- `SecretInput.tsx` — password input с show/hide toggle
- `StatusBadge.tsx` — green "Подключен" / gray "Не указан"
- `SettingsTabs.tsx` — tab navigation (desktop sidebar + mobile pills)
- `SyncingOverlay.tsx` — full-screen sync overlay с фазовой машиной

### Изменения в роутинге
- `SettingsPage.tsx`: 722 строк → 110 строк (tab controller)
- `SyncPage.tsx`: УДАЛЁН (содержимое → ConnectionsTab)
- Route `/sync` → redirect `/settings?tab=connections`
- Layout: убран пункт "Синхронизация" из навигации (6→5 items)
- Hash-ссылки: `#subscription` → `?tab=billing`, `#products` → `?tab=products`

### Архитектурное решение #29
Settings — unified `/settings?tab=` (НЕ отдельные /sync, /settings, аккаунт-блок). 5 табов с URL state. SyncingOverlay как full-screen фаза. ARIA accessibility.

## Sales Plan Enterprise v2 — DONE (18.02.2026)

3 enterprise-фичи для плана продаж:

### 1. PlanCompletionCard v2
- **Темп**: pace_daily (₽/д), required_pace (сколько нужно для выполнения)
- **Прогноз**: forecast_revenue, forecast_percent (линейная экстраполяция)
- **Дни**: days_elapsed / days_remaining / days_total
- **Кликабельность**: "Настроить →" → `/settings?tab=plan`
- **Цвета**: green ≥100% forecast, indigo ≥80%, amber <80%
- **Backend**: `_calc_pace_forecast()` в completion endpoint — все 4 return блока
- **Frontend**: `PlanCompletionCard.tsx` — полная переработка с formatCompact (K/M)

### 2. Stock Alert в плане
- **StockPlanAlerts.tsx** — self-contained компонент на основе useStocks()
- **Логика**: daysToMonthEnd vs days_remaining каждого товара
- **Severity**: critical (≤7д & < monthEnd), warning (< monthEnd), ok
- **UI**: красные/жёлтые предупреждения + зелёная OK-строка
- **Фильтрация**: WB_ACCOUNT system product исключён
- **Синхронизация**: month state поднят в PlanTab, передаётся в оба дочерних компонента

### 3. Copy Plan + Auto-suggest
- **Копирование**: кнопка "Из {prev_month}" — копирует summary + per-product планы
- **Backend**: `GET /sales-plan/previous` — планы за пред. месяц (summary + products)
- **Backend**: `GET /sales-plan/suggest` — avg revenue за 3 мес. × 1.1 (10% рост)
- **WB_ACCOUNT**: фильтруется в suggest endpoint
- **SuggestHint**: кликабельная подсказка "Ср. за 3 мес: X₽" под каждым SaveInput
- **Уровни подсказок**: total, per-MP (wb/ozon), per-product per-MP
- **Frontend hooks**: `usePreviousPlan`, `usePlanSuggest` (staleTime: 10min)
- **Type safety**: salesPlanApi с generic типами (SalesPlanResponse, etc.)

### Архитектурное решение #30
Plan completion pace/forecast: `_calc_pace_forecast()` helper. forecast = actual + pace × days_remaining. Используется во всех 4 return-блоках completion endpoint.

---

## Исправленные баги
- Плашки "Пред.пер." не показывают данные (commit 1aa095f)
- `secret_key = "change-me-in-production"` в config.py (удалён)
- Нет concurrent sync protection (sync guard + lock)
- Ozon SKU mapping hardcoded (dynamic from DB + migration 009)
- Прибыль -10К из-за смешивания costs-tree и mp_sales (пропорциональная коррекция)
- WB mp_orders: price = retail_price ДО скидки (sale_price column added)
- save-and-sync 500: trigger "onboarding" не в CHECK constraint (заменён на "manual")
