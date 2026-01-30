# Analytics Dashboard - Marketplace WB & Ozon

> 🚀 **Промпт для продолжения в новом чате:**
>
> См. файл `promt.md` — там актуальный промт для копирования.
>
> **Текущее состояние (30.01.2026):**
> DashboardPage работает стабильно, адаптивный дизайн реализован.
>
> **Что сделано по адаптиву (30.01.2026, обновлено):**
> - `DateRangePicker` — react-day-picker v9 с правильными classNames
> - `Layout` — hamburger меню справа, slide-out drawer справа
> - `useMediaQuery` / `useIsMobile` — хуки для responsive breakpoints
> - **OZON/WB карточки** — 50/50 горизонтально на всех экранах (grid-cols-2)
> - **Графики компактные** — высота 100px mobile / 140px desktop (было 200-300px)
> - **Боковые фильтры** — вертикально слева на всех экранах (как desktop)
> - **StocksTable** — card-based на mobile с внутренним scroll
> - Tailwind responsive: sm:640px, md:768px, lg:1024px
>
> **Что сделано по оптимизации:**
> - Supabase RPC: `get_dashboard_summary`, `get_costs_tree`
> - Индексы БД для ускорения запросов
> - Props drilling вместо дублирующих запросов в AccrualsCards
> - Убран `deferredEnabled` (каскадные ре-рендеры)
> - Lazy-load графиков, мемоизация данных
>
> **ВАЖНО:** OZON/WB мэтчинг начислений уже 1-в-1 — не ломать.

## Описание проекта

Интерактивный дашборд для аналитики продаж на Wildberries и Ozon.

## Статус: Backend ✅ | Frontend Pages ✅ | Данные синхронизированы ✅ | Ads sync ✅ | Ozon Accruals ✅ | WB Accruals ✅

### Выполнено (Backend):

- [x] Сбор API ключей (WB, Ozon Seller, Ozon Performance, Supabase)
- [x] Структура backend на FastAPI + Python
- [x] API клиенты для WB и Ozon (проверены, работают)
  - WildberriesClient: Content API, Statistics API, Analytics API, Ads API
  - OzonClient: v3/v4 endpoints (products, stocks, finance, analytics)
  - OzonPerformanceClient: OAuth 2.0, campaigns, statistics
- [x] Таблицы в Supabase (mp_products, mp_sales, mp_stocks, mp_costs,
      mp_costs_details, mp_sales_geo, mp_ad_costs, mp_sync_log)
- [x] Сервис синхронизации данных (sync_service.py)
  - sync_products() - обновление WB/Ozon ID
  - sync_sales_wb/ozon() - продажи, заказы, возвраты
  - sync_stocks_wb/ozon() - остатки на складах
  - sync_costs_wb/ozon() - удержания МП
  - sync_all() - полная синхронизация
- [x] FastAPI endpoints (app/api/v1/)
  - Products: GET /products, /products/{id}, /products/barcode/{barcode}
  - Dashboard: GET /dashboard/summary, /unit-economics, /sales-chart, /stocks,
    /costs-tree, /ad-costs
  - Sync: POST /sync/products, /sales, /stocks, /costs, /all + GET /sync/logs
- [x] FastAPI сервер запущен (http://localhost:8000)
- [x] Swagger документация (http://localhost:8000/docs)
- [x] Backend README.md с полной документацией
- [x] Тестирование: test_api.py, test_sync.py
- [x] Данные синхронизированы:
  - 5 товаров с WB и Ozon ID
  - Продажи WB: ~51 запись, Ozon: 43 записи (по дням, 35 дней)
  - Остатки WB: 2 склада
  - Удержания WB: 46 записей, Ozon: 53 записи (mp_costs) + 353 записи
    (mp_costs_details)
  - Реклама: 1 запись WB (0.18₽), Ozon: 0

### Выполнено (Frontend v1.0):

- [x] Vite + React 19.2 + TypeScript 5.9
- [x] Tailwind CSS 3
- [x] Все зависимости установлены (axios, react-query, recharts,
      react-router-dom, sonner, date-fns, zustand, lucide-react)
- [x] TypeScript типы на основе backend API
- [x] Axios client с interceptors
- [x] React Query hooks (useDashboard, useSalesChart, useStocks,
      useUnitEconomics, useSync)
- [x] Утилиты форматирования (formatCurrency, formatDate,
      getDateRangeFromPreset)
- [x] **Даты работают до вчера** (API МП с задержкой - исправлено в utils.ts)
- [x] Компоненты:
  - SummaryCard, MetricCard - карточки метрик
  - FilterPanel - фильтры периода и маркетплейса
  - SalesChart - график продаж с Recharts
  - StocksTable - таблица остатков с раскрываемыми строками
- MarketplaceBreakdown - разбивка WB/Ozon (OZON = OzonAccrualsCard, WB =
  WbAccrualsCard)
- OzonAccrualsCard - карточка начислений Ozon + детализация деревом
- WbAccrualsCard - карточка начислений WB + детализация деревом
- LoadingSpinner - индикатор загрузки
- Layout - навигация между страницами
- [x] Страницы:
  - DashboardPage - главная с метриками, графиком, таблицей
  - ProductsDetailPage - детализация по товарам
  - UnitEconomicsPage - прибыль по товарам
  - SyncPage - синхронизация данных
  - AdsPage - реклама (метрики, графики ДРР, таблица по дням)
- [x] React Router с 5 страницами
- [x] Zustand store для фильтров
- [x] Frontend запущен на http://localhost:5173

### Выполнено (Предыдущие чаты):

- [x] Orphan-затраты исправлены (синхронизация продаж за 35 дней)
- [x] Backend: POST /sync/ads эндпоинт добавлен
- [x] sync_ads_wb: обработка кампаний по одной + rate limit
- [x] OzonPerformanceClient: UUID-based async + CSV-парсинг отчётов
- [x] ProductsDetailPage: полная реализация (карточки, структура затрат, таблица
      эффективности)
- [x] AdsPage: реализация (метрики, графики ДРР, таблица по дням) — TS исправлен
- [x] Frontend API: syncApi.syncAds() добавлен
- [x] AdsPage.tsx — TS ошибки исправлены
- [x] SyncPage — кнопка синхронизации рекламы добавлена
- [x] Ads sync выполнена (WB: 1 запись 0.18₽, Ozon: 0)
- [x] backend/diagnose_data.py удалён
- [x] Dashboard: costs фильтруются по product_id с продажами (orphan-fix)
- [x] Sync sales default: 7 → 35 дней (sync.py)
- [x] Ozon sync по дням: dimensions=["sku","day"] вместо ["sku"]
      (sync_service.py + ozon_client.py)
- [x] Ozon пересинхронизирован: 43 записи по дням
- [x] Unit-economics: orphan-costs тоже исключены (dashboard.py)

### Выполнено (Текущий чат — WB matching + Accruals):

- [x] Зафиксирован источник истины WB: `reportDetailByPeriod` (как в ЛК
      "Финансовые отчёты")
- [x] Исправлена комиссия WB (ранее ошибочно писали `commission_percent` как ₽)
- [x] sync_sales_wb() переведён на `reportDetailByPeriod` (выручка/выкупы “как в
      ЛК”)
- [x] sync_costs_wb() переписан: пишет `mp_costs` + `mp_costs_details`
      (категории/подкатегории как в кабинетной выгрузке)
- [x] Добавлен системный товар `WB_ACCOUNT` (“WB: вне разреза товаров”) для
      строк без товара/без маппинга
- [x] `/dashboard/costs-tree` поддерживает WB дерево (order категорий) +
      fallback на mp_costs/mp_sales при отсутствии деталей
- [x] Frontend: WB карточка начислений `WbAccrualsCard` (как в ЛК) + унификация
      названия колонки "Выручка" (WB+Ozon)
- [x] Reconcile для WB: `wb/reconcile_wb.py` + `wb/RECONCILE.md` (CSV vs API),
      рекомендуется обновлять выгрузки раз в 1–2 месяца

### WB Stocks (gotchas / как в ЛК)

- **Источник**: `statistics-api.wildberries.ru/api/v1/supplier/stocks`
- **Критично про `dateFrom`**: чтобы получить **полный срез “как в ЛК WB”**,
  `dateFrom` должен быть максимально ранним (например `2019-06-20`). Иначе WB
  может вернуть только изменения, из-за чего склады без недавних изменений
  (часто “Электросталь”) “пропадают”.
- **Семантика**:
  - `quantity` = **доступно к продаже** (сколько можно добавить в корзину)
  - `quantityFull` = всего (включая “в пути”)
  - `inWayToClient` / `inWayFromClient` = в пути к клиенту / от клиента
- **Маппинг**: в sync маппим **сначала по `barcode`**, fallback по `nmId` (иначе
  можно терять строки).
- **UI/операционный вид**: на главной `StocksTable` показывает раздельные
  статусы WB/Ozon, фильтры OOS/Low и “обновлено … назад”.
- **Диагностика**:
  - `GET /api/v1/sync/stocks/check?marketplace=wb&days_back=365` — сверка WB API
    vs `mp_stocks` (ищем `diffs[]` и `unmapped_rows`)
  - `POST /api/v1/sync/stocks?marketplace=wb` — пересинхронизация

### Выполнено (OZON — предыдущие чаты):

- [x] Ozon finance API проверен — 291 операция за 30 дней (5 типов: Доставка,
      Звёздные товары, Бонусы, Эквайринг, Хранение)
- [x] sync_costs_ozon() переписан: пагинация, маппинг SKU, параллельная запись
      mp_costs + mp_costs_details
- [x] _classify_ozon_operation() — маппинг operation_type → category/subcategory
- [x] Операции хранения (без items) распределяются равномерно между товарами
- [x] Комиссия сгруппирована: Витамины (D3+K2, L-карнитин, Магний) / Прочее
      (Тестобустер) — группировка проекта, не ставка Ozon
- [x] GET /dashboard/costs-tree endpoint — иерархия с % от выручки
- [x] OzonAccrualsCard — карточка начислений (как в ЛК) + детализация деревом
- [x] Данные синхронизированы: 53 mp_costs + 353 mp_costs_details

### Выполнено (Текущий чат — MATCH верхних плашек + "нативная" семантика):

- [x] Верхние плашки приведены к семантике карточек начислений (costs-tree),
      чтобы цифры не противоречили "как в ЛК".
- [x] Выручка: WB = mp_sales.revenue, Ozon = costs-tree категория "Продажи".
- [x] Расходы МП: считаются из costs-tree (и должны мэтчиться с "Удержания" в
      карточках OZON/WB).
- [x] Добавлена плашка "К перечислению": costs-tree.total_accrued (Ozon
      "Начислено", WB "К перечислению").
- [x] Прибыль: помечена как "оценка" и считается как payout − закупка − ads,
      добавлен debug tooltip.
- [x] ДРР: пересчитан как Ads API / Выручка (на той же базе, что "Выручка").
- [x] UI: сокращены заголовки (аббревиатуры) + добавлены расшифровки в tooltip
      на каждой плашке; тултипы многострочные.
- [x] Исправлены подписи % в деревьях OZON/WB: "% считаются от продаж" +
      подсказка, что это доля от "Продажи", а не тариф.

### Выполнено (Оптимизация загрузки — 29.01.2026):

**Backend (Supabase RPC):**
- [x] Создана RPC функция `get_dashboard_summary` — агрегирует sales/costs/ads/purchase_costs одним запросом вместо 5-6
- [x] Создана RPC функция `get_costs_tree` — строит иерархию удержаний на стороне PostgreSQL
- [x] Добавлены индексы: `idx_mp_sales_date_mp`, `idx_mp_costs_date_mp`, `idx_mp_costs_details_date_mp`, `idx_mp_ad_costs_date_mp`
- [x] `/dashboard/summary` и `/dashboard/costs-tree` теперь вызывают `supabase.rpc()` вместо множества запросов

**Frontend (устранение дублирования и каскадов):**
- [x] `OzonAccrualsCard` и `WbAccrualsCard` получают данные через props из DashboardPage (не делают свои запросы)
- [x] `MarketplaceBreakdown` передаёт `costsTreeData` и `isLoading` в дочерние карточки
- [x] Убран механизм `deferredEnabled` — он создавал +2 каскадных ре-рендера при изменении фильтров
- [x] Убран `useInView` для графиков/остатков — RPC теперь достаточно быстрые
- [x] Графики lazy-load через `React.lazy()` (recharts ~500KB)
- [x] Мемоизация `salesChartSeries` и `adCostsSeriesFull` через `useMemo`

**Архитектура props drilling:**
```
DashboardPage
  ├── useCostsTree(ozon) → ozonCostsTreeData
  ├── useCostsTree(wb) → wbCostsTreeData
  │
  └── MarketplaceBreakdown (props: ozonCostsTree, wbCostsTree)
        ├── OzonAccrualsCard (props: costsTreeData, isLoading)
        └── WbAccrualsCard (props: costsTreeData, isLoading)
```

### Выполнено (Оптимизация — 30.01.2026):

**Backend (новые endpoints):**
- [x] `/dashboard/summary` — добавлены параметры `include_prev_period`, `include_ozon_truth`
- [x] `/dashboard/costs-tree-combined` — объединённый запрос для Ozon + WB

**SQL миграция (backend/migrations/002_optimized_rpc.sql):**
- [x] Создана RPC `get_costs_tree_combined` — объединяет ozon и wb в 1 запрос
- [x] Создана RPC `get_dashboard_summary_with_prev` — summary + prev-period в 1 запрос
- ⚠️ **ВАЖНО:** Эти RPC зависят от `get_costs_tree`, которая должна быть создана в Supabase

**Frontend (типы и hooks):**
- [x] Добавлены типы: `CostsTreeCombinedResponse`, `DashboardSummaryWithPrevResponse`
- [x] Добавлены API методы: `getCostsTreeCombined`, `getSummaryWithPrev`
- [x] Добавлены hooks: `useCostsTreeCombined`, `useDashboardSummaryWithPrev`
- [x] DashboardPage очищен от мёртвого кода и упрощён

**Текущее состояние:**
- Страница загружается быстрее благодаря очистке кода
- Оптимизированные RPC (`get_costs_tree_combined`, `get_dashboard_summary_with_prev`) готовы, но **отключены** — требуют создания базовой RPC `get_costs_tree` в Supabase
- Для включения оптимизаций см. `backend/migrations/002_optimized_rpc.sql`

**Ошибки, которые были исправлены:**
- `deferredEnabled` создавал каскадные ре-рендеры при каждом изменении фильтров
- `useInView` с `rootMargin='600px'` не триггерился для элементов далеко внизу страницы
- Каждая AccrualsCard делала свой useCostsTree — дублирование запросов
- `include_children: false` возвращал пустое дерево в детализации

### Выполнено (Адаптивный дизайн — 30.01.2026):

**DateRangePicker (react-day-picker v9):**
- [x] Установлен react-day-picker v9 (совместим с date-fns 4.x)
- [x] Исправлены classNames для v9 API: `selected`, `today`, `range_start`, `range_middle`, `range_end`
- [x] Используется `getDefaultClassNames()` для расширения дефолтных стилей
- [x] Мобильное позиционирование: `fixed inset-x-2 top-[10vh]` (не уезжает за экран)
- [x] Touch-friendly: увеличенные touch targets (40px на мобильных)
- [x] Debounce (300ms) для уменьшения API запросов

**Layout с адаптивной навигацией:**
- [x] Desktop: горизонтальная навигация в header
- [x] Mobile: hamburger menu + slide-out drawer (слева)
- [x] Закрытие drawer: по клику на overlay, по ESC, при переходе на страницу
- [x] Блокировка scroll body при открытом menu
- [x] Sticky header с z-index: 40

**Адаптивные компоненты Dashboard:**
- [x] `SummaryCard` — адаптивные padding, шрифты, скрытые иконки на mobile
- [x] `SalesChart` — горизонтальный scroll, адаптивная высота (220px mobile / 300px desktop)
- [x] `StocksTable` — скрытые колонки на mobile, цветовая индикация OOS
- [x] `FilterPanel` — компактные кнопки, скрытые labels на mobile

**Хуки для responsive:**
- [x] `useMediaQuery(query)` — универсальный хук
- [x] `useIsMobile()` — `max-width: 639px`
- [x] `useIsTablet()` — `640px - 1023px`
- [x] `useIsDesktop()` — `min-width: 1024px`

**CSS (index.css):**
- [x] CSS переменные для react-day-picker v9
- [x] Mobile-first стили для календаря
- [x] Анимации fade-in, zoom-in для popover

### Выполнено (Mobile-first рефакторинг — 30.01.2026, сессия 2):

**MarketplaceBreakdown (OZON/WB карточки):**
- [x] Карточки всегда 50/50 горизонтально (`grid-cols-2` вместо `grid-cols-1 sm:grid-cols-2`)
- [x] Компактный layout для узких колонок: Продажи + Начислено в одной строке
- [x] WB: Продажи теперь включают СПП (возмещение), полоска разделена на продажи/СПП
- [x] WB: "Возмещения" переименовано в "СПП" (Скидка постоянного покупателя)
- [x] WB: "К перечисл." → "Начислено" (унификация терминологии)
- [x] OZON: убран "+1 ещё" — показываются все категории удержаний
- [x] Уменьшены шрифты для mobile: text-lg/text-[10px] vs text-2xl/text-xs desktop
- [x] Уменьшены отступы: p-3 mobile / p-5 desktop

**Графики (SalesChart, AvgCheckChart, DrrChart):**
- [x] Высота уменьшена в ~2 раза: 100px mobile / 140px desktop (было 200-300px)
- [x] Padding уменьшен: p-2 sm:p-3 (было p-5)
- [x] Заголовки компактнее: text-xs sm:text-sm (было text-base)
- [x] Табы SalesChart: h-5 sm:h-6 (было h-7 sm:h-8)
- [x] При отсутствии данных: показывается нулевой график (flat line) вместо большого "Нет данных"
- [x] Loading skeleton адаптирован под компактную высоту

**DashboardPage (фильтры + графики):**
- [x] Боковые фильтры всегда вертикально слева (убрана горизонтальная мобильная версия)
- [x] `flex-row` вместо `flex-col lg:flex-row` — единый layout на всех экранах
- [x] Ширина фильтров адаптивная: w-28 sm:w-32 lg:w-36
- [x] Шрифты фильтров: text-[9px]/text-[11px] mobile, text-[10px]/text-xs desktop

**Layout:**
- [x] Hamburger menu перемещён вправо (для правшей)
- [x] Drawer открывается справа (translate-x-full)
- [x] Убрана кнопка Settings (placeholder)

### Следующий этап - Доработки:

- [x] ~~Затраты за декабрь 2025 без продаж~~ — исправлено
- [x] ~~Метрика "Площади/настроений %"~~ — реализована через Prior Period + YoY
- [x] ~~Визуализация комиссии МП~~ — CostsTreeView (backend готов, frontend визуал в процессе)
- [x] ~~Оптимизация загрузки~~ — RPC функции, убраны дублирующие запросы, lazy-load

**Средний приоритет (при необходимости):**
- [ ] Активировать `get_costs_tree_combined` RPC (объединяет ozon+wb в 1 запрос)
- [ ] Активировать `get_dashboard_summary_with_prev` RPC (summary + prev period в 1 запрос)
- [ ] Скелетоны на тяжёлые блоки (графики, остатки)

**Backlog:**
- [x] Custom Date Picker для выбора произвольного периода ✅ (DateRangePicker готов)
- [x] Адаптивный дизайн для мобильных устройств ✅
- [ ] Excel export функциональность
- [ ] CostsTreeView визуал — довести до 1-в-1 как в ЛК Ozon
- [ ] Улучшить компоновку блоков на DashboardPage

## Технический стек

- **Backend:** Python 3.14 + FastAPI
- **Database:** Supabase (PostgreSQL)
- **Frontend:** React 19.2 + TypeScript 5.9 + Vite 7.2 + Tailwind CSS 3
- **State Management:** React Query 5.90 + Zustand 5.0
- **Деплой:** Beget + Supabase (планируется)

## Товары (5 SKU)

| Штрихкод      | Название                 | Закупка | WB nmID   | Ozon product_id |
| ------------- | ------------------------ | ------- | --------- | --------------- |
| 4670157464824 | Магний + В6 хелат 800 мг | 280₽    | 254327396 | 1144779512      |
| 4670157464831 | Магний цитрат 800 мг     | 250₽    | 254299021 | 1144795275      |
| 4670157464848 | L-карнитин 720 мг        | 360₽    | 254278127 | 1145915272      |
| 4670157464770 | Витамин D3 + К2 260 мг   | 280₽    | 254281289 | 1145845755      |
| 4670227414995 | Тестобустер              | 404₽    | 260909523 | 1183426642      |

## Ключевые метрики для дашборда

- Продажи (заказы, выкупы, возвраты)
- Процент выкупа
- Добавления в корзину
- Остатки на складах
- Удержания МП (комиссия, логистика, хранение, продвижение, штрафы, эквайринг)
- Unit-экономика (прибыль на единицу)
- География продаж
- Рекламные расходы (ACOS, ДРР)

## Структура БД (Supabase)

Все таблицы с префиксом `mp_`:

- `mp_products` - товары с закупочными ценами и идентификаторами МП
- `mp_sales` - продажи (ежедневная агрегация)
- `mp_stocks` - остатки на складах
- `mp_costs` - удержания маркетплейса (агрегация: commission, logistics,
  storage...)
- `mp_costs_details` - гранулярные удержания для tree-view (category,
  subcategory, amount)
- `mp_sales_geo` - география продаж
- `mp_ad_costs` - рекламные расходы
- `mp_sync_log` - логи синхронизации

## Структура проекта

```
Analitics/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # FastAPI роуты
│   │   ├── services/        # WB и Ozon клиенты (готовы)
│   │   ├── models/          # Pydantic модели
│   │   └── db/              # Supabase клиент
│   ├── migrations/          # SQL миграции
│   ├── tests/
│   ├── requirements.txt
│   └── test_api.py          # Тест подключения к API
├── frontend/                # React + TypeScript (готов MVP v0.1)
├── .env                     # API ключи (не коммитить!)
├── .gitignore
├── BRIEF.md                 # Детальный бриф проекта
└── CLAUDE.md                # Этот файл
```

## API ключи (.env)

Все ключи уже настроены в `.env`:

- WB_API_TOKEN - Wildberries (статистика, аналитика, финансы, продвижение)
- OZON_CLIENT_ID, OZON_API_KEY - Ozon Seller API
- OZON_PERFORMANCE_CLIENT_ID, OZON_PERFORMANCE_CLIENT_SECRET - Ozon реклама
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

## Текущая задача: Исправить данные и перейти к следующим страницам

### Что работает (DashboardPage полностью готова ✅):

✅ **8 карточек метрик** (6 основных + 2 сравнения при пресетах 7/30/90d)

- Выручка: по “истине” (WB mp_sales, Ozon costs-tree “Продажи”)
- Прибыль (оценка): payout − закупка − ads (debug tooltip)
- ДРР: Ads API / Выручка
- Реклама: Ads API (не равно “Бонусы продавца” в удержаниях)
- Расх. МП: удержания из costs-tree (должно совпадать с карточками начислений)
- К перечисл.: costs-tree.total_accrued
- Пред. пер.: выручка предыдущего периода
- Δ к пред.: изменение выручки к предыдущему периоду (не YoY) ✅ **2 блока
  MarketplaceBreakdown** (OZON/WB) с реальными данными
- OZON: 12,907₽ / 24 выкупа / 5,459₽ прибыль
- WB: 3,598₽ / 6 выкупов / 1,707₽ прибыль
- Детализация: Комиссия, Логистика, Хранение (раздельно) ✅ **FilterPanel**
  (7/30/90d + custom date picker) ✅ **Боковые фильтры** (Маркетплейс:
  все/WB/OZON + Товары: список из API) ✅ **3 графика**:
- SalesChart с табами (Заказы/Выкупы/Выручка) — компактный 100/140px
- AvgCheckChart (BarChart среднего чека) — компактный 80/100px
- DrrChart (AreaChart ДРР) — компактный 80/100px, zero-line при отсутствии данных ✅ **StocksTable** с expandable rows (52 шт Витамин D3+K2 на
  Электростали) ✅ **Ozon stocks (FBO) подтянуты**: sync пишет `mp_stocks` по
  складам РФЦ, UI показывает Ozon остатки ✅ **Ozon данные синхронизированы** по
  дням (43 записи через dimensions=["sku","day"]) ✅ **Orphan-costs исключены**
  (costs фильтруются по product_id с продажами) ✅ **Логика периодов** проверена
  (7/30/90d, предыдущий период рассчитывается корректно)

### Текущее состояние:

#### Оптимизация (актуально на 29.01.2026):

- **Backend:** `/dashboard/summary` и `/dashboard/costs-tree` используют Supabase RPC
- **Frontend:** AccrualsCards получают данные через props (не дублируют запросы)
- **Lazy-load:** графики загружаются через React.lazy()
- **Убрано:** `deferredEnabled`, `useInView` для графиков/остатков
- **Осталось:** ~10-12 запросов на first render, нужно сократить

#### Данные (актуально на 29.01.2026):

- **WB продажи:** ~51 запись (по дням, 35 дней)
- **Ozon продажи:** 43 записи (по дням, 35 дней)
- **WB costs:** ~46 записей (комиссия, логистика, эквайринг)
- **Ozon costs:** 53 записи mp_costs + 353 записи mp_costs_details (30 дней)
- **Ozon finance API:** 291 операция за 30 дней (5 типов operation_type)
- **Реклама:** 1 запись WB (0.18₽) — кампания неактивна
- **7d:** Выручка 16,505₽ / 30 продаж / Прибыль 4,245₽ (25.7%)
- **30d (Ozon tree):** Начислено 18,859₽ = Продажи 36,182₽ - Комиссия 10,597₽ -
  Доставка 3,524₽ - Агенты 836₽ - FBO 2,238₽ - Продвижение 128₽

#### Рекламная кампания WB неактивна

- 1 запись (0.18₽, 1 показ за 23.01.2026)
- Ozon Performance: 0 записей
- ДРР = 0% на всех днях

#### CostsTreeView — визуал в процессе:

- Backend полностью готов (endpoint, синхронизация, данные)
- Frontend компонент рендерится, но визуально отличается от ЛК Ozon
- Нужно: линии-коннекторы, правильные отступы, % под суммой, шрифты
- Карточка OZON в MarketplaceBreakdown заменена на CostsTreeView
- WB остаётся как простая карточка (комиссия, логистика, хранение, прибыль)

### Задачи для следующего чата:

1. **Визуализация комиссии МП** — отдельная секция/страница с детализацией
   удержаний (комиссия, логистика, хранение, штрафы, эквайринг) по дням и
   товарам
2. **Custom Date Picker** — выбор произвольного периода (сейчас только пресеты
   7/30/90d)
3. **Excel export** — выгрузка данных дашборда в Excel

### Готовые файлы (можно использовать):

- ✅ `src/types/index.ts` - все TypeScript типы (включая CostsTreeResponse,
  CostsTreeItem, CostsTreeChild)
- ✅ `src/services/api.ts` - axios client с endpoints (включая getCostsTree)
- ✅ `src/hooks/useDashboard.ts` - React Query hooks (включая useCostsTree)
- ✅ `src/lib/utils.ts` - утилиты форматирования
- ✅ `src/components/Dashboard/SummaryCard.tsx` - карточка метрики
- ✅ `src/components/Dashboard/CostsTreeView.tsx` - дерево удержаний Ozon
  (ВИЗУАЛ В ПРОЦЕССЕ)
- ✅ `src/components/Dashboard/MarketplaceBreakdown.tsx` - OZON=CostsTreeView,
  WB=карточка
- ✅ `src/components/Shared/LoadingSpinner.tsx` - спиннер

### Текущая структура frontend/

```
frontend/
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   │   ├── SummaryCard.tsx         ✅ Адаптивный
│   │   │   ├── SalesChart.tsx          ✅ Компактный (100/140px), zero-line fallback
│   │   │   ├── AvgCheckChart.tsx       ✅ Компактный (80/100px), zero-line fallback
│   │   │   ├── DrrChart.tsx            ✅ Компактный (80/100px), zero-line fallback
│   │   │   ├── StocksTable.tsx         ✅ Card-based на mobile
│   │   │   ├── MarketplaceBreakdown.tsx ✅ grid-cols-2 всегда
│   │   │   ├── OzonAccrualsCard.tsx    ✅ Compact layout (50% width)
│   │   │   └── WbAccrualsCard.tsx      ✅ Compact layout (50% width), СПП
│   │   ├── Shared/
│   │   │   ├── LoadingSpinner.tsx      ✅ Готово
│   │   │   ├── Layout.tsx              ✅ Hamburger справа, drawer справа
│   │   │   ├── FilterPanel.tsx         ✅ Адаптивный
│   │   │   └── DateRangePicker.tsx     ✅ react-day-picker v9
│   │   ├── UnitEconomics/              (TODO)
│   │   └── Sync/                       (TODO)
│   ├── hooks/
│   │   ├── useDashboard.ts             ✅ Готово
│   │   ├── useSync.ts                  ✅ Готово
│   │   └── useMediaQuery.ts            ✅ useIsMobile, useIsTablet, useIsDesktop
│   ├── lib/
│   │   └── utils.ts                    ✅ Готово
│   ├── pages/
│   │   └── DashboardPage.tsx           ✅ Фильтры слева, графики справа
│   ├── services/
│   │   └── api.ts                      ✅ Готово
│   ├── store/
│   │   └── useFiltersStore.ts          ✅ Zustand store
│   ├── types/
│   │   └── index.ts                    ✅ Готово
│   ├── App.tsx                         ✅ Готово
│   ├── index.css                       ✅ RDP v9 стили
│   └── main.tsx                        ✅ Готово
├── .env                                ✅ Готово
├── tailwind.config.js                  ✅ Готово
├── postcss.config.js                   ✅ Готово
└── package.json                        ✅ Готово
```

## Команды для работы

### Backend

```bash
# Активация venv
cd backend && source venv/bin/activate

# Тест API подключения
python test_api.py

# Тест синхронизации
python test_sync.py

# Запуск FastAPI сервера
uvicorn app.main:app --reload --port 8000
```

**Backend работает на:** http://localhost:8000 **Документация API:**
http://localhost:8000/docs

### Frontend

```bash
cd frontend

# Установка зависимостей (уже установлено)
npm install

# Запуск dev сервера
npm run dev

# Сборка для продакшена
npm run build
```

**Frontend работает на:** http://localhost:5173

## Важные примечания

### API маркетплейсов:

- **Ozon:** `offer_id` = штрихкод (barcode пустой в API)
- **WB:** использует `skus` в `sizes` для штрихкодов
- **Ozon API версии:** v3 (products), v4 (stocks) - обновлено в коде
- **WB Analytics API:** некоторые эндпоинты (воронка) возвращают 404, не
  критично

### База данных:

- Supabase таблицы используют UUID для id
- Unique constraints: `(product_id, marketplace, date)` для sales/costs
- `total_costs` в mp_costs - computed column (автоматически рассчитывается)

### Синхронизация:

- Ozon FBO остатки берём через analytics `stock_on_warehouses` (кейс “Склад
  Ozon”, когда FBS=0)
- WB данные загружаются корректно (7 продаж, 46 удержаний, 2 склада)
- Логи всех синхронизаций сохраняются в `mp_sync_log`

### Frontend:

- Используется Tailwind CSS v3 (v4 нестабильная, откатились)
- React Query автоматически кэширует данные (staleTime: 5 минут)
- Процент возвратов рассчитывается как: `returns / (sales + returns) * 100%`
- Утилиты форматирования используют Intl API для локализации

### API keys:

- Supabase ключи обновлены на новые (publishable/secret)
- WB токен валиден до 2025-09-04
- Все ключи в `.env` - **НЕ КОММИТИТЬ В GIT!**

### Backend архитектура:

- `sync_service.py` - центральный сервис синхронизации
- Асинхронные клиенты (httpx) для API запросов
- FastAPI с CORS для frontend
- Swagger docs автоматически генерируется

## Полная документация

📖 Детальная документация:

- [backend/README.md](backend/README.md) - Backend API, схема БД, примеры
- [frontend/README.md](frontend/README.md) - Frontend структура, компоненты
- [DESIGN_REFERENCE.md](frontend/DESIGN_REFERENCE.md) - Гайд по дизайну (цвета,
  шрифты, spacing)
- [DECISIONS.md](DECISIONS.md) - Утверждённые решения по архитектуре

## Согласованные решения

### Процент возвратов (вместо процента выкупа)

**Формула:** `return_rate = (returns / (sales + returns)) * 100%`

- Пример: 1 возврат, 7 продаж → 12.5%
- Всегда ≤ 100%
- Логичная метрика качества товара

### Приоритет разработки

1. ✅ Overview (главный дашборд) - **выполнено MVP**
2. 🔄 Завершить Overview (фильтры, график, таблица)
3. ⏳ Unit-Economics
4. ⏳ Рекламные расходы
5. ⏳ Синхронизация

### Дизайн

- Стиль: Stripe Dashboard (минималистичный)
- Цвета: WB #8B3FFD (фиолетовый), Ozon #005BFF (синий)
- Tailwind CSS v3
- Иконки: lucide-react

### Автообновление

- MVP: по кнопке "Обновить"
- v2.0: автообновление каждые 5 минут (React Query refetchInterval)
