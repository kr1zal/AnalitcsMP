# Архитектура системы — Analytics Dashboard

> Версия документа: 18.02.2026
> Статус: Production (https://reviomp.ru)

---

## 1. Обзор системы

Analytics Dashboard — SaaS-платформа для аналитики продаж на маркетплейсах Wildberries и Ozon. Целевая аудитория: продавцы витаминов/БАДов (5 SKU). Per-user авторизация, подписочная модель (Free / Pro).

### Диаграмма архитектуры

```
                              ┌───────────────────────────────────────────┐
                              │              КЛИЕНТ (Browser)             │
                              │  React 19 + TS 5.9 + Vite 7 + TW 3      │
                              │  React Query 5 (server) + Zustand 5 (UI) │
                              │  Recharts (lazy) + Supabase Auth SDK      │
                              └────────────────────┬──────────────────────┘
                                                   │ HTTPS
                                                   ▼
                              ┌───────────────────────────────────────────┐
                              │              NGINX (reverse proxy)        │
                              │  SSL (Let's Encrypt) + static files      │
                              │  /api/v1/* → FastAPI :8000                │
                              │  /* → React SPA (index.html fallback)    │
                              └────────────────────┬──────────────────────┘
                                                   │
                                                   ▼
                              ┌───────────────────────────────────────────┐
                              │           FastAPI Backend (:8000)         │
                              │  Python 3.14 + httpx + Pydantic          │
                              │  JWT JWKS + Fernet + Playwright          │
                              │  systemd: analytics-api                  │
                              └──┬──────────┬──────────┬─────────────────┘
                                 │          │          │
                    ┌────────────┘          │          └────────────┐
                    ▼                       ▼                       ▼
          ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
          │  Supabase        │   │  Marketplace APIs │   │  YooKassa API    │
          │  PostgreSQL + RLS│   │  ┌──────┐ ┌─────┐│   │  Оплата подписок │
          │  4 RPC functions │   │  │ WB   │ │Ozon ││   │  ShopID: 1273909 │
          │  17 migrations   │   │  │ API  │ │ API ││   │  Webhook + IP WL │
          └──────────────────┘   │  └──────┘ └─────┘│   └──────────────────┘
                                 └──────────────────┘
                                   │            │
                              ┌────┘            └────┐
                              ▼                      ▼
                    ┌──────────────────┐   ┌──────────────────┐
                    │ WB APIs:         │   │ Ozon APIs:        │
                    │ Content          │   │ Seller v3/v4     │
                    │ Statistics       │   │ Finance v3       │
                    │ Analytics        │   │ Analytics v1     │
                    │ Ads              │   │ Performance      │
                    │ Finance          │   │ (OAuth 2.0)      │
                    └──────────────────┘   └──────────────────┘

            ┌─────────────────────────────────────────────────────┐
            │                  CRON (systemd timer)               │
            │  */30 мин → POST /sync/process-queue                │
            │  Business: 4x/день, Pro: 3x/день, Free: 2x/день   │
            └─────────────────────────────────────────────────────┘
```

### Инфраструктура

| Компонент | Характеристика |
|-----------|---------------|
| VPS | Beget, Ubuntu 24.04, 1 ядро |
| Процесс | systemd `analytics-api` (uvicorn) |
| Reverse Proxy | Nginx + Let's Encrypt SSL |
| БД | Supabase (hosted PostgreSQL + RLS) |
| Домен | reviomp.ru |
| Деплой | rsync + systemd restart |

---

## 2. Стек технологий

### Backend

| Компонент | Версия | Назначение | Почему выбран |
|-----------|--------|-----------|---------------|
| Python | 3.14 | Язык бэкенда | Богатая экосистема, async/await, быстрая разработка |
| FastAPI | latest | Веб-фреймворк | Нативный async, автодокументация Swagger, Pydantic-валидация |
| Supabase (PostgreSQL) | hosted | БД + RLS | Managed PostgreSQL, встроенная авторизация, Row Level Security, RPC-функции |
| httpx | latest | HTTP-клиент | Асинхронный, поддержка timeout/retry, замена requests |
| Pydantic | v2 | Валидация | Нативная интеграция с FastAPI, строгая типизация |
| Playwright | latest | PDF-экспорт | Headless Chromium, точный рендеринг CSS, серверный |
| cryptography (Fernet) | latest | Шифрование токенов | Симметричное шифрование, простой API, не требует расширений БД |
| PyJWT + jwcrypto | latest | JWT-верификация | JWKS-совместимость, ES256 + HS256 fallback |

### Frontend

| Компонент | Версия | Назначение | Почему выбран |
|-----------|--------|-----------|---------------|
| React | 19.2 | UI-фреймворк | Компонентный подход, огромная экосистема, стабильность |
| TypeScript | 5.9 | Типизация | Строгие типы, автодополнение, ранний перехват ошибок |
| Vite | 7.2 | Сборщик | HMR <50ms, tree-shaking, ESBuild, быстрее Webpack в 10x |
| Tailwind CSS | 3 | Стили | Utility-first, mobile-first, малый бандл через purge |
| React Query | 5.90 | Серверный стейт | Кеширование, staleTime, дедупликация запросов, retry |
| Zustand | 5.0 | UI-стейт | Минимальный API, нет boilerplate (vs Redux), вне React-дерева |
| Recharts | latest | Графики | React-нативный, декларативный, lazy-loadable |
| axios | latest | HTTP-клиент | Интерцепторы (401 refresh), baseURL, типизация |
| @supabase/supabase-js | latest | Авторизация | SDK для Supabase Auth (getSession, onAuthStateChange) |
| react-day-picker | 9.x | Календарь | Compact DateRange, кастомизация, captionLayout="label" |
| @dnd-kit | latest | Drag & Drop | Headless DnD, accessibility, SortableContext |
| lucide-react | latest | Иконки | Tree-shakeable, consistent стиль, TypeScript |
| sonner | latest | Тосты | Минимальный, анимированный, stackable |

### Инфраструктура

| Компонент | Версия | Назначение | Почему выбран |
|-----------|--------|-----------|---------------|
| Nginx | latest | Reverse proxy + SSL | Стабильный, Let's Encrypt автообновление, статика |
| systemd | OS | Процесс-менеджер | Встроен в Ubuntu, restart on failure, journalctl |
| Cron (systemd timer) | OS | Планировщик sync | Нет доп. зависимостей, 1 ядро VPS не потянет Celery |
| YooKassa | API v3 | Платежи | Русский эквайер, рекуррентные платежи, webhook |

---

## 3. Архитектурные решения (31 правило)

Каждое правило зафиксировано после инцидента или аудита. **Нарушение любого правила запрещено.**

---

### Правило 1. Costs-tree: параллельные запросы per marketplace

**Правило:** Costs-tree загружается отдельными параллельными запросами для WB и Ozon (НЕ combined).

**Почему:** Combined-запрос смешивал категории WB и Ozon (разная структура дерева). Параллельные запросы изолируют данные и позволяют рендерить карточки независимо (одна может загрузиться раньше).

**Anti-pattern:** `useCostsTree('all')` или единый запрос с `marketplace=all` для tree.

---

### Правило 2. AccrualsCards: данные через props из DashboardPage

**Правило:** OzonAccrualsCard и WbAccrualsCard получают данные через props, а не делают собственные запросы.

**Почему:** DashboardPage уже загружает costs-tree для расчёта profit/waterfall. Дублирование запросов внутри карточек удваивает нагрузку на БД.

**Anti-pattern:** `useQuery` внутри AccrualsCard. Карточки должны быть "презентационными".

---

### Правило 3. DateRangePicker: captionLayout="label"

**Правило:** В react-day-picker v9 используется `captionLayout="label"` (НЕ dropdown).

**Почему:** Баг синхронизации года при `captionLayout="dropdown"` — при переключении месяца год сбрасывался. Label-режим стабилен.

**Anti-pattern:** `captionLayout="dropdown"` или `captionLayout="dropdown-months"`.

---

### Правило 4. Tailwind v3 (НЕ v4)

**Правило:** Используется Tailwind CSS 3.x. Миграция на v4 запрещена.

**Почему:** Tailwind v4 ломает конфигурацию (PostCSS → CSS-first), breaking changes в `@apply`, `theme()`, responsive. Проект стабилен на v3.

**Anti-pattern:** `npm install tailwindcss@4`, использование CSS-first конфигурации.

---

### Правило 5. PDF: Playwright backend (НЕ html2canvas)

**Правило:** PDF-экспорт через Playwright на бэкенде (headless Chromium рендерит PrintPage).

**Почему:** html2canvas не поддерживает CSS Grid, Tailwind-стили обрезает, canvas API ломает шрифты. Playwright рендерит 1-в-1 как в браузере.

**Anti-pattern:** html2canvas, jsPDF с DOM-to-canvas, любой client-side PDF.

---

### Правило 6. Auth: Hybrid (service_role + RLS + JWKS)

**Правило:** Backend использует `service_role_key` для запросов в Supabase + JWT JWKS для верификации пользователя. RLS — safety net, НЕ primary protection.

**Почему:** service_role обходит RLS для admin-операций (cron sync, subscription update). RLS — второй барьер на случай бага в коде. JWKS — стандарт верификации Supabase JWT.

**Anti-pattern:** Полагаться только на RLS (без user_id в WHERE). Использовать anon_key на бэкенде.

---

### Правило 7. Шифрование: Fernet backend (НЕ pgcrypto/Vault)

**Правило:** API-токены маркетплейсов шифруются Fernet (Python cryptography) на бэкенде перед записью в БД.

**Почему:** pgcrypto требует SQL-расширения (не всегда доступно в Supabase hosted). Vault — overengineering для 1 VPS. Fernet — symmetric, быстрый, ключ в .env.

**Anti-pattern:** Хранение токенов в открытом виде. pgcrypto в SQL. HashiCorp Vault.

---

### Правило 8. Подписки: планы в коде plans.py (НЕ в БД)

**Правило:** Определение тарифов (лимиты, фичи, цены) хранится в `backend/app/plans.py` как Python dict.

**Почему:** Планы меняются редко (раз в месяц максимум). Хранение в коде = version control, code review, zero-latency lookup. БД-таблица планов — лишняя абстракция для 2-3 тарифов.

**Anti-pattern:** Таблица `subscription_plans` в БД. Admin UI для редактирования планов.

---

### Правило 9. Sync: DB queue + cron (НЕ Celery)

**Правило:** Синхронизация через DB-based queue (`mp_sync_queue`) + cron каждые 30 минут.

**Почему:** VPS с 1 ядром. Celery + Redis/RabbitMQ — минимум 2 лишних процесса + 200-400MB RAM. DB queue + cron = zero overhead, достаточно для десятков пользователей.

**Anti-pattern:** Celery, Dramatiq, ARQ, любой воркер с брокером.

---

### Правило 10. Прибыль: пропорциональная коррекция через costsTreeRatio

**Правило:** Закупочная цена и реклама корректируются через `costsTreeRatio = costs_tree_SALES / mp_sales_revenue` (БЕЗ credits).

**Почему:** `mp_sales.revenue` содержит ВСЕ заказы (включая непроведённые), а `costs_tree` — только финализированные. Ratio = доля проведённых заказов. Без коррекции закупка завышена на 10-30%.

**Anti-pattern:** `purchase = purchase_price * orders_count` (без коррекции). Использование credits в ratio (завышает коэффициент).

---

### Правило 11. Order Monitor v1: из mp_sales

**Правило:** Воронка заказов (v1) строится из `mp_sales` (агрегированные данные). Индикатор непроведённых — через сравнение с costs-tree.

**Почему:** mp_sales уже загружается для дашборда. Отдельный запрос order-funnel — быстрый (агрегация). Непроведённые = разница mp_sales.revenue vs costs-tree settled.

**Anti-pattern:** Загрузка mp_orders для воронки (тяжёлый запрос с пагинацией).

---

### Правило 12. Order Monitor v2: mp_orders с 3-step enrichment

**Правило:** Позаказная детализация из `mp_orders`. WB: 3-step accumulate (orders → sales → report_detail). Ozon: FBS + FBO.

**Почему:** WB API требует 3 шага для полных данных по заказу (статус, финансы, детали). Ozon разделяет FBS и FBO posting. Единая таблица mp_orders унифицирует оба МП.

**Anti-pattern:** Попытка получить все данные WB-заказа одним запросом. Игнорирование FBO для Ozon.

---

### Правило 13. WB SPP: sale_price = retail_price_withdisc_rub

**Правило:** Цена продажи WB = `retail_price_withdisc_rub` (цена ПОСЛЕ скидки по СПП).

**Почему:** WB API возвращает `retail_price` (до скидки) и `retail_price_withdisc_rub` (после). Клиент платит вторую. Использование первой завышает revenue.

**Anti-pattern:** `sale_price = retail_price`. `sale_price = price_with_disc` (без проверки поля).

---

### Правило 14. Landing Hero: Canvas MatrixRain

**Правило:** Hero-секция лендинга использует Canvas-based MatrixRain анимацию (digital rain, indigo/violet).

**Почему:** CSS gradient waves — статичные, скучные. SVG chart — тяжёлый, ломается на mobile. Canvas — 60fps, GPU-ускоренный, настраиваемый.

**Anti-pattern:** CSS-only анимация. SVG-графики в hero. Lottie (лишняя зависимость).

---

### Правило 15. DataFlow PRO: скрыт через SHOW_PRO = false

**Правило:** PRO-блок на лендинге скрыт через флаг `SHOW_PRO = false`, НЕ удалён из кода.

**Почему:** Блок потребуется при запуске Business-тарифа. Удаление = потерянный код. Флаг = мгновенное включение без разработки.

**Anti-pattern:** Удаление компонента. Комментирование кода. `display: none` в CSS.

---

### Правило 16. Pricing: всегда grid-cols-2

**Правило:** Блок тарифов на лендинге — всегда `grid-cols-2`, даже на mobile.

**Почему:** Два тарифа (Free/Pro) визуально сравниваются бок о бок. `grid-cols-1` ломает сравнение — пользователь скроллит и забывает первый тариф.

**Anti-pattern:** `grid-cols-1` на mobile. `grid-cols-3` (Business скрыт).

---

### Правило 17. Product Management: 3-col, @dnd-kit, click modals

**Правило:** Управление товарами — 3-колоночный layout, @dnd-kit для drag & drop, click-to-open help modals (НЕ hover).

**Почему:** Hover modals не работают на touch-устройствах. @dnd-kit — headless, accessible, не блокирует скролл. 3 колонки = товар + группа + себестоимость.

**Anti-pattern:** Hover-тултипы для помощи. react-beautiful-dnd (deprecated). 2-колоночный layout.

---

### Правило 18. UE Profit: payout distribution

**Правило:** `profit_i = total_payout * (revenue_i / SUM(revenue)) - purchase_i*ratio - ad_i*ratio`

**Почему:** Формула `revenue - costs` не сходится с dashboard profit (разные источники: mp_sales vs costs-tree). Payout distribution гарантирует: SUM(profit_i) = dashboard_profit.

**Anti-pattern:** `profit_i = revenue_i - costs_i - purchase_i - ad_i`. Любая формула где SUM(UE) != dashboard.

---

### Правило 19. СПП: credits ВХОДЯТ в displayed_revenue

**Правило:** WB credits (СПП, возмещения) включены в отображаемую "Продажи": `displayed_revenue = costs_tree_sales + credits`. Ratio использует ЧИСТЫЕ sales (без credits).

**Почему:** СПП — реальные деньги от WB (компенсация скидки). Клиент видит их в ЛК как часть продаж. Но для ratio credits не учитываются (они не от покупателей).

**Anti-pattern:** Исключать credits из "Продажи". Включать credits в costsTreeRatio.

---

### Правило 20. WB Методология: ВЕРИФИЦИРОВАНА

**Правило:** Методология расчётов WB верифицирована аудитом 15.02.2026. Двойного учёта СПП нет.

**Почему:** Сверка CSV из ЛК WB vs API показала расхождение < 0.03 рублей по всем категориям. Инвариант: `total_accrued = SUM(all tree items) = Продажи + Credits + Удержания`. Прибыль считается от payout (НЕ от displayed_revenue).

**Anti-pattern:** Изменение формулы profit без повторной сверки. Использование displayed_revenue для расчёта прибыли.

---

### Правило 21. OZON Методология: ВЕРИФИЦИРОВАНА

**Правило:** Методология расчётов Ozon верифицирована аудитом 15.02.2026. Diff с ЛК = 0.00 руб. по всем 6 категориям.

**Почему:** У Ozon НЕТ credits (нет аналога СПП). "Продажи" = Выручка + Баллы + Партнёры (как в ЛК). total_accrued = SUM(all amounts). Расхождение = 0.00 руб.

**Anti-pattern:** Добавление credits для Ozon (их нет). Изменение классификации операций без сверки.

---

### Правило 22. ProfitChart: dual area (revenue + profit)

**Правило:** График прибыли — dual AreaChart (Recharts): revenue (зелёная) + profit (индиго). `profitMargin = netProfit / revenue`. Дневная оценка: `dailyProfit = dailyRevenue * profitMargin`.

**Почему:** Зазор между area = расходы. Визуально показывает долю прибыли в выручке. Точные дневные данные недоступны (costs-tree агрегирован по периоду), поэтому margin estimation.

**Anti-pattern:** Одна линия profit (не видно структуру). BarChart (не видно тренд). Точные daily costs (нет данных).

---

### Правило 23. ProfitWaterfall: div-based bars (НЕ Recharts)

**Правило:** Каскад прибыли (Продажи -> -Удерж. -> -Закупка -> -Реклама = Прибыль) реализован на div-элементах, НЕ на Recharts.

**Почему:** Recharts WaterfallChart не поддерживает отрицательные каскады с custom-позиционированием. Div-based = легковесный (~100 строк), не грузит Recharts бандл, точный контроль layout.

**Anti-pattern:** Recharts WaterfallChart. SVG-based waterfall. Canvas waterfall.

---

### Правило 24. TopProductsChart: top 5 + "все N ->"

**Правило:** Показывает top 5 товаров по net_profit. Горизонтальные бары. Ссылка "все N ->" на /unit-economics при >5 товарах. Фильтрует WB_ACCOUNT.

**Почему:** При 100+ SKU показывать все — нечитаемо. Top 5 = быстрый обзор. WB_ACCOUNT — системный продукт (вне разреза товаров), его profit бессмысленен для пользователя.

**Anti-pattern:** Показывать все товары. Не фильтровать WB_ACCOUNT. BarChart вертикальный (не помещается).

---

### Правило 25. ConversionChart: sales/orders * 100%

**Правило:** Конверсия выкупа = `sales / orders * 100%`. Lazy-loaded. Цвет: sky-blue (#0ea5e9).

**Почему:** Конверсия выкупа — ключевая метрика для МП (WB ~50%, Ozon ~80%). Отдельный график = instant visibility. Sky-blue — не конфликтует с green (revenue) и indigo (profit).

**Anti-pattern:** Объединение с SalesChart. Не lazy-load (Recharts тяжёлый).

---

### Правило 26. Dashboard layout: 2x2 charts + analytics row

**Правило:** Desktop (lg+): 2x2 grid графиков (Продажи|Прибыль, ДРР|Конверсия) + аналитическая строка (Waterfall|TopProducts|StockForecast).

**Почему:** 4 графика в сетке — оптимальное соотношение информации/скролла. Аналитическая строка — дополнительный контекст без перегрузки.

**Anti-pattern:** Все графики в одну колонку. Более 4 графиков в сетке.

---

### Правило 27. Sales Plan: 3 уровня, priority total > MP > product

**Правило:** План продаж: total -> per-MP (WB/Ozon) -> per-product per-MP. Приоритет completion: total > MP-sum > product-sum. Факт ТОЛЬКО за месяцы с планом.

**Почему:** Total plan — самый верхний KPI. Если задан total и per-MP, completion считается по total (не по сумме МП). Факт за месяцы БЕЗ плана = inflation (все продажи считаются "выполнением").

**Anti-pattern:** Факт за весь date range. Простая сумма per-MP вместо total. Completion без учёта приоритета.

---

### Правило 28. Dashboard Cards: 4x2 grid, SummaryCard с accent

**Правило:** Карточки метрик — `grid-cols-2 lg:grid-cols-4`. Enterprise SummaryCard с accent-иконками, secondaryValue, ChangeBadge. ДРР merged в "Реклама" (НЕ отдельная карточка).

**Почему:** 4x2 grid = 8 метрик без скролла на desktop. ДРР логически часть рекламы (показывается как secondaryValue). ChangeBadge — сравнение с предыдущим периодом inline, без отдельных карточек.

**Anti-pattern:** Отдельная карточка для ДРР. Карточки сравнения "Пред. период". `grid-cols-3`.

---

### Правило 29. Enterprise Settings: unified /settings?tab=

**Правило:** Все настройки в едином `/settings` с 5 табами: Подключения | Товары | План продаж | Тариф | Профиль. URL state через `useSearchParams`. Desktop: vertical sidebar. Mobile: horizontal scroll pills.

**Почему:** 3 отдельных страницы (SyncPage, SettingsPage, аккаунт-блок) — фрагментированный UX. Unified settings (паттерн SellerBoard/Stripe) — всё в одном месте, навигация через табы.

**Anti-pattern:** Отдельные /sync, /settings, /account. Табы без URL state (refresh = потеря контекста). Dropdown вместо табов.

---

### Правило 30. Sales Plan completion: взвешенное, не среднее

**Правило:** Actual только по МП с планами (`active_mps`). Per-MP actual из wbData/ozonData (НЕ planData.by_product). Footer = взвешенное completion (НЕ простое среднее). SaveInput: skip server sync при focus.

**Почему:** Простое среднее `(WB_completion + Ozon_completion) / 2` некорректно при разных объёмах (WB 1M руб., Ozon 100K руб. — вес WB должен быть 10x). Взвешенное = `SUM(actual) / SUM(plan)`.

**Anti-pattern:** `AVG(completion_percent)`. Actual по всем МП (даже без планов). Server sync перезаписывает ввод в фокусе.

---

### Правило 31. Sales Plan v2: pace/forecast/days + copy

**Правило:** PlanCompletionCard v2 с темпом/прогнозом/днями. StockPlanAlerts (self-contained). Copy plan (кнопка "Из {prev_month}"). Month state поднят в PlanTab.

**Почему:** Без темпа и прогноза пользователь не понимает, успевает ли выполнить план. Copy plan экономит время при ежемесячном планировании.

**Anti-pattern:** Статичный % completion без прогноза. Ручной ввод каждый месяц с нуля.

---

## 4. Data Flow

### 4.1. Sync Pipeline (данные МП -> БД)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SYNC PIPELINE                                 │
│                                                                      │
│  systemd timer (*/30 min)                                           │
│       │                                                              │
│       ▼                                                              │
│  POST /sync/process-queue                                           │
│       │                                                              │
│       ▼                                                              │
│  mp_sync_queue (DB)  ──►  SyncService._load_tokens()                │
│  [user_id, type,          │                                          │
│   scheduled_at,           ▼                                          │
│   status]            Fernet decrypt(mp_user_tokens)                  │
│                           │                                          │
│                           ▼                                          │
│                    ┌──────┴──────┐                                   │
│                    ▼             ▼                                    │
│              WB Client     Ozon Client                               │
│              │    │    │    │    │    │                               │
│              ▼    ▼    ▼    ▼    ▼    ▼                               │
│            sales stocks costs sales stocks costs                     │
│              │    │    │    │    │    │                               │
│              └────┴────┴────┴────┴────┘                              │
│                         │                                            │
│                         ▼                                            │
│              Supabase (upsert)                                       │
│              ├── mp_sales          (продажи по дням)                 │
│              ├── mp_stocks         (остатки по складам)              │
│              ├── mp_costs          (удержания, агрегация)            │
│              ├── mp_costs_details  (удержания, tree-детализация)     │
│              ├── mp_ad_costs       (реклама по кампаниям)            │
│              ├── mp_orders         (позаказная детализация)          │
│              ├── mp_stock_snapshots (динамика остатков)              │
│              └── mp_sync_log       (логи синхронизации)              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Расписание sync (по тарифам):**
| Тариф | Auto-sync | Ручной sync/день |
|-------|-----------|------------------|
| Free | 08:00, 20:00 MSK | 0 |
| Pro | +1ч от Business | 1 |
| Business | 06:00, 12:00, 18:00, 00:00 MSK | 2 |

### 4.2. Dashboard Render (БД -> UI)

```
┌──────────────────────────────────────────────────────────────────────┐
│                     DASHBOARD RENDER FLOW                            │
│                                                                      │
│  React Component (DashboardPage)                                     │
│       │                                                              │
│       ├── useQuery('summary')      ──► GET /dashboard/summary        │
│       ├── useQuery('salesChart')   ──► GET /dashboard/sales-chart    │
│       ├── useQuery('costsTree/wb') ──► GET /dashboard/costs-tree?mp=wb   │
│       ├── useQuery('costsTree/oz') ──► GET /dashboard/costs-tree?mp=ozon │
│       ├── useQuery('unitEcon')     ──► GET /dashboard/unit-economics │
│       ├── useQuery('stocks')       ──► GET /dashboard/stocks         │
│       └── useQuery('adCosts')      ──► GET /dashboard/ad-costs       │
│                                           │                          │
│                                           ▼                          │
│                                    FastAPI endpoint                   │
│                                    Depends(get_current_user_id)       │
│                                           │                          │
│                                           ▼                          │
│                                    Supabase RPC / Query               │
│                                    .eq("user_id", user_id)           │
│                                    .gte("date", date_from)           │
│                                           │                          │
│                                           ▼                          │
│                                    PostgreSQL (RLS safety net)        │
│                                           │                          │
│                                           ▼                          │
│                                    JSON Response                     │
│                                           │                          │
│       ┌───────────────────────────────────┘                          │
│       ▼                                                              │
│  React Query Cache (staleTime)                                       │
│       │                                                              │
│       ├── SummaryCards (props)                                        │
│       ├── AccrualsCards (props ← costsTree)                          │
│       ├── SalesChart (lazy, Recharts)                                │
│       ├── ProfitChart (lazy, Recharts)                               │
│       ├── ProfitWaterfall (div-based)                                │
│       ├── TopProductsChart (props ← unitEcon)                        │
│       ├── ConversionChart (lazy, Recharts)                           │
│       └── StocksTable (props ← stocks)                               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Ключевые расчёты в DashboardPage:**
```
costsTreeRatio = costs_tree_SALES / mp_sales_revenue   (БЕЗ credits!)
adjustedPurchase = purchase * costsTreeRatio
adjustedAds = ads * costsTreeRatio
profit = total_payout - adjustedPurchase - adjustedAds
profitMargin = profit / revenue
perMpShare = pureSales_mp / totalPureSales
profit_mp = payout_mp - adjustedPurchase * share - adjustedAds * share
```

### 4.3. Auth Flow (авторизация)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         AUTH FLOW                                     │
│                                                                      │
│  1. LOGIN                                                            │
│  LoginPage → Supabase Auth (signInWithPassword)                      │
│       │                                                              │
│       ▼                                                              │
│  JWT (access_token + refresh_token) → localStorage (Supabase SDK)    │
│       │                                                              │
│       ▼                                                              │
│  onAuthStateChange → useAuthStore.setUser(user)                      │
│       │                                                              │
│       ▼                                                              │
│  ProtectedRoute: user? → checkTokens → hasTokens? → Dashboard       │
│                                                └──► Settings (onboarding)  │
│                                                                      │
│  2. API REQUEST                                                      │
│  axios interceptor → Authorization: Bearer <access_token>            │
│       │                                                              │
│       ▼                                                              │
│  FastAPI: get_current_user_id (auth.py)                              │
│       │                                                              │
│       ├── Fetch JWKS from Supabase (cached)                          │
│       ├── Verify JWT signature (ES256 primary, HS256 fallback)       │
│       ├── Extract user_id from `sub` claim                           │
│       └── Return user_id → endpoint                                  │
│                                                                      │
│  3. TOKEN REFRESH                                                    │
│  axios 401 interceptor → Supabase refreshSession()                   │
│       │                                                              │
│       ├── Success → retry original request                           │
│       └── Failure → redirect /login                                  │
│                                                                      │
│  4. CRON AUTH (sync pipeline)                                        │
│  X-Cron-Secret + X-Cron-User-Id headers (НЕ JWT)                   │
│       │                                                              │
│       ▼                                                              │
│  get_current_user_or_cron → validate secret → return user_id         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.4. Payment Flow (YooKassa)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      PAYMENT FLOW (YooKassa)                         │
│                                                                      │
│  BillingTab → POST /subscription/upgrade                             │
│       │                                                              │
│       ▼                                                              │
│  Backend → YooKassa API (create payment, 990 RUB)                   │
│       │                                                              │
│       ▼                                                              │
│  Redirect → YooKassa checkout page                                   │
│       │                                                              │
│       ▼                                                              │
│  User pays → YooKassa → POST /subscription/webhook                  │
│       │                      │                                       │
│       │                      ├── IP whitelist check                   │
│       │                      ├── Payment verification (GET payment)   │
│       │                      ├── Update mp_user_subscriptions         │
│       │                      └── plan: free → pro, status: active    │
│       ▼                                                              │
│  Redirect back → /settings?tab=billing&payment=success               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Ключевые паттерны

### 5.1. React Query + Zustand (разделение state)

```
┌─────────────────────────────────────────────┐
│             STATE MANAGEMENT                 │
│                                              │
│  SERVER STATE (React Query)                  │
│  ├── summary, salesChart, costsTree          │
│  ├── stocks, adCosts, unitEconomics          │
│  ├── subscription, tokens, salesPlan         │
│  ├── staleTime: 5-10 min                    │
│  └── Auto-refetch on focus/reconnect         │
│                                              │
│  UI STATE (Zustand)                          │
│  ├── useFiltersStore: dateFrom, dateTo,      │
│  │   marketplace, productId                  │
│  └── useAuthStore: user, isLoading           │
│                                              │
│  LOCAL STATE (useState)                      │
│  └── Только для form inputs, modals, tabs    │
│                                              │
└─────────────────────────────────────────────┘
```

**Правило:** Серверные данные = React Query. UI-фильтры = Zustand. Форм-поля = useState. Никогда `useState` + `useEffect` для data fetching.

### 5.2. Feature Gates (подписки)

```tsx
// Backend: dependency factory
@router.get("/dashboard/unit-economics")
async def get_ue(
    ...,
    _: None = Depends(require_feature("unit_economics")),
):

// Frontend: компонент-обёртка
<FeatureGate feature="unit_economics" plan="pro">
  <UnitEconomicsPage />
</FeatureGate>
```

**Два уровня защиты:** Backend возвращает 403 (нельзя обойти). Frontend показывает blur + lock overlay (UX).

### 5.3. Lazy Loading (code splitting)

```tsx
// Recharts (~500KB) загружается только при рендере графика
const SalesChart = lazy(() => import('./components/Dashboard/SalesChart'));
const ProfitChart = lazy(() => import('./components/Dashboard/ProfitChart'));
const ConversionChart = lazy(() => import('./components/Dashboard/ConversionChart'));
const DrrChart = lazy(() => import('./components/Dashboard/DrrChart'));

// ProfitWaterfall — div-based, НЕ lazy (лёгкий)
import ProfitWaterfall from './components/Dashboard/ProfitWaterfall';
```

**Результат:** Initial bundle НЕ содержит Recharts. Графики загружаются по мере скролла.

### 5.4. Progressive Rendering (параллельные запросы)

```tsx
// DashboardPage: costs-tree грузится параллельно для WB и Ozon
const { data: wbCostsTree } = useCostsTree('wb');
const { data: ozonCostsTree } = useCostsTree('ozon');
// WB карточка отрендерится, даже если Ozon ещё грузится
```

**Принцип:** Каждый блок дашборда рендерится независимо. Нет единого "loading" на всю страницу.

### 5.5. Responsive (mobile-first)

```
Mobile (< 640px)     Tablet (640-1023px)    Desktop (1024px+)
┌──────────┐         ┌─────┬──────┐         ┌────┬────┬────┬────┐
│ Card 1   │         │  C1 │  C2  │         │ C1 │ C2 │ C3 │ C4 │
├──────────┤         ├─────┼──────┤         ├────┼────┼────┼────┤
│ Card 2   │         │  C3 │  C4  │         │ C5 │ C6 │ C7 │ C8 │
├──────────┤         ├─────┴──────┤         ├────┴────┼────┴────┤
│ Card 3   │         │  Chart 1   │         │Chart 1  │Chart 2  │
│ ...      │         │  Chart 2   │         │Chart 3  │Chart 4  │
└──────────┘         └────────────┘         └─────────┴─────────┘
```

**grid-cols-2 lg:grid-cols-4** — основной паттерн для карточек метрик.

---

## 6. Структура проекта

### Backend

```
backend/
├── app/
│   ├── api/v1/
│   │   ├── dashboard.py       # Summary, costs-tree, UE, stocks, ads, chart, orders
│   │   ├── sync.py            # Sales, stocks, costs, ads, all
│   │   ├── sync_queue.py      # Process-queue, manual, status
│   │   ├── products.py        # CRUD, sort, groups
│   │   ├── sales_plan.py      # GET/PUT plan, completion, reset, copy
│   │   ├── tokens.py          # Save, validate, save-and-sync
│   │   ├── subscription.py    # Current, plans, upgrade, webhook, cancel
│   │   ├── payment.py         # YooKassa integration
│   │   ├── export.py          # PDF (Playwright)
│   │   ├── account.py         # Delete account
│   │   └── admin.py           # Admin sync, subscription override
│   ├── services/
│   │   ├── sync_service.py    # SyncService: orchestrator
│   │   ├── wb_client.py       # WildberriesClient (5 APIs)
│   │   └── ozon_client.py     # OzonClient + OzonPerformanceClient
│   ├── db/
│   │   └── supabase.py        # Supabase client (service_role)
│   ├── auth.py                # JWT JWKS middleware
│   ├── crypto.py              # Fernet encrypt/decrypt
│   ├── plans.py               # Subscription plans (dict)
│   ├── subscription.py        # FastAPI Dependencies (feature gates)
│   ├── config.py              # Settings (.env)
│   └── main.py                # FastAPI app (CORS, routers)
├── migrations/                # 001-017 SQL migrations
├── scripts/                   # One-time scripts (reconstruct, reconcile)
└── requirements.txt
```

### Frontend

```
frontend/src/
├── components/
│   ├── Dashboard/             # 19 компонентов
│   │   ├── SummaryCard.tsx         # Метрика с accent, ChangeBadge
│   │   ├── SalesChart.tsx          # Продажи/заказы (lazy)
│   │   ├── ProfitChart.tsx         # Revenue + profit dual area (lazy)
│   │   ├── DrrChart.tsx            # ДРР % (lazy)
│   │   ├── ConversionChart.tsx     # Выкуп % (lazy)
│   │   ├── ProfitWaterfall.tsx     # Каскад прибыли (div-based)
│   │   ├── TopProductsChart.tsx    # Top 5 по прибыли
│   │   ├── StockForecastChart.tsx  # Запас по дням (горизонтальные бары)
│   │   ├── StockHistoryChart.tsx   # Динамика остатков (line chart)
│   │   ├── StocksTable.tsx         # Остатки (enterprise: search/sort/pagination)
│   │   ├── MarketplaceBreakdown.tsx # OZON + WB grid
│   │   ├── OzonAccrualsCard.tsx    # Начисления Ozon
│   │   ├── WbAccrualsCard.tsx      # Начисления WB + СПП
│   │   ├── CostsTreeView.tsx       # Дерево удержаний
│   │   ├── CostsDonutChart.tsx     # Структура удержаний
│   │   ├── PlanCompletionCard.tsx  # План: темп/прогноз/дни
│   │   ├── MetricCard.tsx          # Базовая карточка метрики
│   │   └── AvgCheckChart.tsx       # (deprecated, не используется)
│   ├── Settings/              # 13 компонентов
│   │   ├── SettingsTabs.tsx        # Tab navigation (sidebar/pills)
│   │   ├── ConnectionsTab.tsx      # API-токены + sync
│   │   ├── ProductsTab.tsx         # ProductManagement wrapper
│   │   ├── PlanTab.tsx             # SalesPlanEditor + FeatureGate
│   │   ├── BillingTab.tsx          # Подписка + оплата
│   │   ├── ProfileTab.tsx          # Email + logout + delete
│   │   ├── SalesPlanEditor.tsx     # 3-уровневый редактор плана
│   │   ├── ProductManagement.tsx   # Drag & drop товаров
│   │   ├── SubscriptionCard.tsx    # Карточка тарифа
│   │   ├── StockPlanAlerts.tsx     # Предупреждения запасов
│   │   ├── SecretInput.tsx         # Password input
│   │   ├── StatusBadge.tsx         # Статус подключения
│   │   └── SyncingOverlay.tsx      # Full-screen sync overlay
│   └── Shared/                # Layout, ProtectedRoute, FeatureGate, etc.
├── hooks/                     # 11 hooks
│   ├── useDashboard.ts             # React Query: все dashboard endpoints
│   ├── useSalesPlan.ts             # Plan CRUD + completion
│   ├── useSubscription.ts          # Subscription + plans
│   ├── useSync.ts                  # Sync mutations
│   ├── useTokens.ts                # Token CRUD
│   ├── useAuth.ts                  # Supabase Auth listener
│   ├── useProducts.ts              # Products CRUD
│   ├── useOrders.ts                # Order Monitor queries
│   ├── useExport.ts                # Excel/PDF export
│   ├── useMediaQuery.ts            # Responsive breakpoints
│   └── useInView.ts                # Intersection Observer (lazy)
├── pages/                     # 10 pages
│   ├── DashboardPage.tsx           # Главная (metrics + charts)
│   ├── UnitEconomicsPage.tsx       # Прибыль по товарам
│   ├── AdsPage.tsx                 # Реклама (KPI + campaigns)
│   ├── OrderMonitorPage.tsx        # Заказы (воронка + таблица)
│   ├── SettingsPage.tsx            # Unified settings (tab controller)
│   ├── LoginPage.tsx               # Auth (login/signup/reset)
│   ├── ResetPasswordPage.tsx       # Новый пароль
│   ├── LandingPage.tsx             # Лендинг (hero + features)
│   ├── PrintPage.tsx               # PDF layout (3x A4)
│   └── LegalPages.tsx              # Оферта, политика
├── services/
│   └── api.ts                      # Axios client + interceptors
├── store/
│   ├── useFiltersStore.ts          # Zustand: dates, marketplace, product
│   └── useAuthStore.ts             # Zustand: user, isLoading
├── types/
│   └── index.ts                    # Все TypeScript типы
└── lib/
    ├── utils.ts                    # formatCurrency, formatDate, etc.
    ├── supabase.ts                 # Supabase client (auth only)
    └── exportExcel.ts              # Excel generation (6 sheets)
```

### База данных (Supabase PostgreSQL)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE SCHEMA                                   │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                         │
│  │  auth.users      │    │  mp_products     │ ◄── master data       │
│  │  (Supabase Auth) │    │  barcode, name,  │                       │
│  └───────┬──────────┘    │  purchase_price, │                       │
│          │               │  wb_nm_id,       │                       │
│          │ user_id FK    │  ozon_product_id │                       │
│          │               └────────┬─────────┘                       │
│          │                        │ product_id FK                   │
│          ▼                        ▼                                  │
│  ┌───────────────┐    ┌──────────────────────────────┐              │
│  │ mp_user_tokens │    │ mp_sales         (продажи)   │              │
│  │ (Fernet enc.) │    │ mp_stocks        (остатки)   │              │
│  ├───────────────┤    │ mp_costs         (удержания) │              │
│  │ mp_user_subs  │    │ mp_costs_details (tree)      │              │
│  │ (подписки)    │    │ mp_ad_costs      (реклама)   │              │
│  ├───────────────┤    │ mp_orders        (заказы)    │              │
│  │ mp_sync_queue │    │ mp_stock_snapshots (история) │              │
│  │ (sync задачи) │    │ mp_sales_plan    (план/тов.) │              │
│  ├───────────────┤    │ mp_sales_plan_summary (план) │              │
│  │ mp_sync_log   │    └──────────────────────────────┘              │
│  │ (логи sync)   │                                                   │
│  └───────────────┘    RPC: get_dashboard_summary                    │
│                            get_costs_tree                            │
│                            get_costs_tree_combined                   │
│                            get_dashboard_summary_with_prev           │
│                                                                      │
│  ALL TABLES: user_id NOT NULL + RLS ENABLE + policies               │
│  17 migrations (001_initial → 017_stock_snapshots)                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Формулы (критичные)

### Прибыль (Dashboard)

```
costsTreeRatio = costs_tree_SALES / mp_sales_revenue      (БЕЗ credits!)
adjustedPurchase = purchase * costsTreeRatio
adjustedAds = ads * costsTreeRatio
profit = total_payout - adjustedPurchase - adjustedAds
```

### Выручка (отображение)

```
displayed_revenue = costs_tree_sales + credits    (СПП, возмещения)
```

### Unit Economics (per product)

```
profit_i = total_payout * (revenue_i / SUM(revenue)) - purchase_i * ratio - ad_i * ratio
// Гарантия: SUM(profit_i) = dashboard_profit
```

### Per-MP прибыль

```
share = pureSales_mp / totalPureSales             (OZON + WB)
profit_mp = payout_mp - adjustedPurchase * share - adjustedAds * share
// Гарантия: profit_ozon + profit_wb = dashboard_profit
```

### ДРР

```
DRR = ad_cost / revenue * 100%
```

### Прогноз остатков

```
days_remaining = total_quantity / avg_daily_sales(30d)
```

### Конверсия выкупа

```
conversion = sales / orders * 100%
```

### WB Начислено

```
total_accrued = SUM(все tree items) = Продажи + Credits + Удержания
```

### OZON Начислено

```
total_accrued = SUM(все tree items) = Продажи + Удержания (нет credits)
```

### План продаж

```
completion = actual / plan * 100%       (actual ТОЛЬКО за месяцы с планом)
pace_daily = actual / days_elapsed
required_pace = (plan - actual) / days_remaining
forecast = actual + pace_daily * days_remaining
```

### Каскад прибыли (Waterfall)

```
revenue -> -mpDeductions -> -purchase -> -ads = profit (margin%)
margin = profit / revenue * 100%
```

---

## 8. Ограничения и trade-offs

### Инфраструктурные

| Ограничение | Причина | Последствие | Как живём |
|-------------|---------|-------------|-----------|
| 1 ядро VPS | Бюджет стартапа | Нельзя Celery, нет параллелизма sync | DB queue + cron. Sync последовательный per user |
| Supabase hosted | Нет self-hosted PG | Ограничения на расширения (нет pgcrypto) | Fernet на Python-стороне |
| Supabase RPC | PostgreSQL-only | Нет materialized views refresh, ограничения на сложные запросы | RPC-функции с ручной оптимизацией |

### Frontend

| Ограничение | Причина | Последствие | Как живём |
|-------------|---------|-------------|-----------|
| Recharts ~500KB | Единственная mature React-chart library | Тяжёлый бандл | Lazy loading (React.lazy), code splitting |
| Tailwind v3 locked | Breaking changes в v4 | Нет новых фич v4 (container queries и др.) | Достаточно для текущих задач |
| CSR only (no SSR) | Vite SPA | Нет SEO для app pages | Landing — статический HTML, meta tags |

### Backend

| Ограничение | Причина | Последствие | Как живём |
|-------------|---------|-------------|-----------|
| Playwright на VPS | Headless Chromium ~200MB RAM | Пиковая нагрузка при PDF-генерации | PDF по запросу, не массовый экспорт |
| Sequential sync | 1 ядро, нет worker pool | Sync одного юзера ~2-5 мин | Расписание staggered по тарифам |
| WB API rate limits | 60 req/min на некоторые endpoints | Длительная синхронизация при большом объёме | Retry с exponential backoff, days_back=35 |

### Данные

| Ограничение | Причина | Последствие | Как живём |
|-------------|---------|-------------|-----------|
| costs-tree vs mp_sales | Разные источники (финотчёт vs статистика) | Расхождение revenue → необходим costsTreeRatio | Пропорциональная коррекция (правило #10) |
| Нет daily costs | costs_tree агрегирован по периоду | ProfitChart = margin estimation | profitMargin = netProfit / revenue * dailyRevenue |
| Ozon нет cost_price | API не отдаёт закупочную | Пользователь вводит вручную | purchase_price в mp_products (ручной ввод) |
| WB credits (СПП) | Положительные суммы помимо "Продажи" | Усложнение формул, необходимость разделения | Отдельный учёт credits, ratio без credits (правило #19) |

---

## 9. Безопасность

### Многослойная защита

```
Layer 1: Nginx (SSL, rate limiting)
Layer 2: FastAPI CORS (whitelist domains)
Layer 3: JWT JWKS verification (auth.py)
Layer 4: user_id в каждом SQL-запросе
Layer 5: Supabase RLS (safety net)
Layer 6: Fernet encryption (API tokens at rest)
Layer 7: YooKassa IP whitelist (webhook)
```

### Принципы

- **Zero trust:** Каждый endpoint проверяет JWT + извлекает user_id
- **Defense in depth:** RLS = safety net (НЕ primary), user_id в WHERE = primary
- **Secrets management:** .env на сервере, Fernet для user tokens, нет hardcoded secrets в коде
- **Minimal exposure:** anon_key только на фронте (auth only), service_role только на бэкенде

---

## 10. Связанная документация

| Документ | Путь | Содержимое |
|----------|------|-----------|
| CLAUDE.md | `/CLAUDE.md` | Главный конфиг проекта, правила, формулы |
| Coding Standards | `/.claude/rules/coding-standards.md` | Стандарты кода (React, FastAPI, Tailwind) |
| Backend README | `/backend/README.md` | API endpoints, БД-схема, auth |
| Frontend README | `/frontend/README.md` | Компоненты, hooks, pages |
| Phases History | `/docs/phases-history.md` | Подробная история всех фаз |
| Auth Flow | `/docs/auth-flow.md` | CJM авторизации |
| YooKassa | `/docs/yookassa-integration.md` | Платежи API + webhook |
| Product Management | `/docs/product-management.md` | DnD, группы, себестоимость |
