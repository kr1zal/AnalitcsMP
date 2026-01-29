Промпт для нового чата (Фокус: остатки WB)

Продолжаем разработку Analytics Dashboard для WB и Ozon. Backend: FastAPI
(http://localhost:8000) Frontend: React+TS (http://localhost:5173)

---

## Промпт для НОВОГО чата: СКОРОСТЬ ЗАГРУЗКИ (Dashboard perf)

Скопируй и вставь в новый чат:

""" Продолжаем разработку Analytics Dashboard для WB и Ozon. Backend: FastAPI
(http://localhost:8000), Frontend: React+TS (http://localhost:5173).

Задача: **ускорить загрузку DashboardPage** (время до первого meaningful render
и время до полной готовности).

Контекст (важное):

- OZON/WB costs-tree мэтчится 1-в-1 с ЛК — не ломать.
- Остатки WB починены: WB `/api/v1/supplier/stocks` нужно запрашивать с ранним
  `dateFrom` (например `2019-06-20`), иначе WB возвращает только изменения.
- `/api/v1/dashboard/stocks` отдаёт `last_updated_at` и
  `warehouses[].updated_at`.

Цели:

- Уменьшить количество запросов при первой загрузке страницы.
- Сделать загрузку инкрементальной: сначала критичные карточки/скелеты, затем
  тяжёлые блоки.
- Убрать лишние перерендеры и дорогие вычисления в React.
- Сократить payload/агрегации на backend (если нужно).

Как измеряем:

- Chrome DevTools Performance + Network (TTFB, transfer size, request count).
- React Profiler (лишние рендеры).

Что проверить в коде:

- React Query: параллелизация, `staleTime`, `enabled`, `select`, queryKey дедуп.
- DashboardPage: каскадные refetch, зависимость запросов друг от друга.
- Тяжёлые ответы: `/dashboard/costs-tree`, `/dashboard/stocks`, графики —
  возможно нужен “light” режим.
- Backend: Supabase запросы, возможные N+1/лишние join, сортировки/агрегации.

Ключевые файлы:

- frontend/src/pages/DashboardPage.tsx
- frontend/src/hooks/useDashboard.ts
- frontend/src/services/api.ts
- backend/app/api/v1/dashboard.py
- frontend/src/components/Dashboard/* (SalesChart, CostsTreeView, StocksTable)

Ограничения:

- Не делать git команды без явного согласия пользователя.
- Не запускать/останавливать серверы без явного согласия пользователя. """

---

## Промпт для НОВОГО чата: ОСТАТКИ WB (истина, качество, UX)

Скопируй и вставь в новый чат:

""" Продолжаем разработку Analytics Dashboard для WB и Ozon. Backend: FastAPI
(http://localhost:8000), Frontend: React+TS (http://localhost:5173).

Задача: **Остатки Wildberries (WB)** — добиться корректной передачи данных и
полезного отображения в блоке “Остатки на складах”.

Что уже сделано:

- OZON FBO остатки починены: `sync_stocks_ozon()` использует fallback на
  `POST /v2/analytics/stock_on_warehouses` и пишет в `mp_stocks` по складам РФЦ.
- `GET /api/v1/dashboard/stocks` отдаёт агрегат по товарам + детализацию по
  складам; фронт `StocksTable` корректно рендерит expandable строки.

Фокус этого чата — WB:

- Определить **источник истины** для остатков WB (какой endpoint/сущность в WB
  API соответствует ЛК).
- Разобраться с семантикой: что считаем “активным” (доступно к продаже) vs “в
  пути/резерв/брак”.
- Проверить маппинг nmID/баркоды/склады (и что не теряем товар при агрегации).
- Сделать UX блока складов полезным: сортировки, фильтры, сигналы OOS/low stock,
  “обновлено <время>”.

Как быстро проверить сейчас:

- `POST /api/v1/sync/stocks?marketplace=wb` (с `X-Sync-Token`)
- `GET /api/v1/dashboard/stocks?marketplace=wb`

Ключевые файлы:

- backend/app/services/wb_client.py (stocks endpoint)
- backend/app/services/sync_service.py (sync_stocks_wb)
- backend/app/api/v1/dashboard.py (GET /dashboard/stocks)
- frontend/src/components/Dashboard/StocksTable.tsx

Ограничения:

- Не запускать сервер и не делать git команды без явного согласия. """

ВАЖНО:

- OZON/WB мэтчинг начислений (costs-tree) уже 1‑в‑1 — НЕ ЛОМАТЬ.
- “Истина”: ЛК/фин.отчёты маркетплейса и/или их finance‑API, совпадающие с ЛК.
- Любые изменения проверяем reconcile‑скриптами (WB + Ozon), чтобы не ловить
  регресс.
- Backend/Frontend запускать только при явном согласии пользователя. Git команды
  — только при явном согласии пользователя.

---

1. Текущее состояние (контекст / что уже сделано)

---

OZON:

- Дерево начислений/удержаний (`/dashboard/costs-tree?marketplace=ozon`)
  совпадает с ЛК (reconcile: `ozon/reconcile_accruals.py`).
- В дереве % рядом с категориями — это “доля от Продаж”, как в ЛК (не тарифная
  ставка комиссии).

WB:

- Источник истины закреплён: `reportDetailByPeriod` (как в ЛК “Финансовые
  отчёты”).
- Дерево (`/dashboard/costs-tree?marketplace=wb`) строится из `mp_costs_details`
  и сходится с reconcile.

Frontend (семантика метрик / верхние плашки):

- Введена “нативная” семантика (фокус на точность):
  - Продажи: WB = mp_sales.revenue, Ozon = категория “Продажи” из costs-tree
    (Выручка+Баллы+Партнёры)
  - Расх. МП: сумма удержаний из costs-tree (должно мэтчиться с “Удержания” в
    карточках)
  - К перечисл.: costs-tree.total_accrued (Ozon “Начислено”, WB “К
    перечислению”)
  - Прибыль (оценка): payout − закупка − ads (с debug tooltip)
  - ДРР: Ads API / Продажи
- Добавлены аббревиатуры заголовков и tooltip-расшифровки на каждой карточке.
- Добавлены предупреждения `warnings` + `source` (fallback) в UI, чтобы было
  понятно происхождение цифр.

Frontend (даты / “сутки” / графики — фикс до “вчера”):

- “Вчера” — верхняя граница данных: UI и date inputs ограничены `max=yesterday`
  (маркетплейсы часто не отдают “сегодня” полноценно).
- Preset 7/30/90:
  - диапазон считается как [yesterday-6 .. yesterday], [yesterday-29 ..
    yesterday], [yesterday-89 .. yesterday]
  - при клике пресета сбрасываются `customDateFrom/To`
  - поля date inputs показывают effective range (но не переводят в custom)
- Custom даты:
  - любое ручное изменение переводит в preset `custom`
  - диапазон нормализуется: clamp до yesterday + swap если from > to
- Prev period: даты сравнения считаются через локальный формат `yyyy-MM-dd` (без
  `toISOString()`, чтобы не ловить TZ-сдвиг на сутки).
- Графики:
  - дневной ряд заполняется до полного N-дневного диапазона (backend отдаёт
    только дни с активностью).
  - SalesChart: “хвост” после последней фактической даты рисуется gap (null),
    чтобы не тянуть “нулевой хвост”.
  - AvgCheck и DRR: получают полный дневной ряд, чтобы ось всегда была на N
    дней.

Frontend (карточки начислений OZON/WB):

- `MarketplaceBreakdown` показывает 2 карточки: `OzonAccrualsCard` +
  `WbAccrualsCard` (3 колонки как в ЛК) + дерево в детализации.
- Кнопка “Детализация” синхронизирована: раскрытие/сворачивание одновременно в
  OZON и WB.
- Детализация уменьшена ~на 25% (шрифты/отступы), разделители выровнены
  (минимальная высота верхнего блока).
- Суммы в карточках округлены до ₽ (WB приведён к OZON).
- `WB_ACCOUNT`:
  - скрыт из пользовательского фильтра товаров (sidebar), чтобы не путать.
  - в детализации WB показывается секция “Служебные WB (без товара)” только
    когда есть строки; если она дублирует основное дерево — показывается краткий
    инфо-блок вместо дублирования.

---

2. Задача нового чата: UI/UX + Склады

---

Главная цель:

- Довести UX до “не вызывает вопросов к данным” + улучшить блок складов
  (читабельность/полезность).

Ключевое различие (обязательно зафиксировать):

1. НАША группировка (policy, не данные МП):
   - OZON: "Витамины" / "Прочее" — это аналитическая группировка в проекте (не
     тариф/ставка Ozon).
   - WB: аналогично — любые группировки/правила в проекте считаем справочными,
     не "истиной".
2. ЭФФЕКТИВНАЯ доля от продаж (fact, как в ЛК):
   - OZON: |Вознаграждение Ozon| / Продажи * 100 за период
   - WB: |(Вознаграждение Вайлдберриз + НДС ВВ)| / Продажи * 100 за период
   - Именно это сейчас показывается как % у категории в дереве (как в ЛК).

Definition of Done (DoD):

- Везде в UI корректная семантика “Продажи” vs “денежная выручка” и понятная
  база процентов.
- Любой fallback/неполнота данных помечается `warnings` и `source`.
- Costs-tree визуально максимально близко к ЛК (линии/отступы/шрифты/без hover),
  без потери точности.
- Блок “Склады” помогает принимать решения: группировка, сортировки, быстрые
  сигналы OOS/излишков.

---

3. План (строго по шагам)

---

Шаг A — UI/UX (Dashboard):

- Добить/дополировать визуал дерева “как в ЛК”
  (линии/отступы/шевроны/типографика) в детализации карточек.
- Пройтись по всем карточкам/подсказкам и убедиться, что “Продажи” везде
  единообразно трактуется.

Шаг B — Склады:

- Сделать сортировки/группировки по товару и по складу понятными (и полезными).
- Добавить сигналы: OOS (0), низкий остаток, перекос по складам (если есть).

---

4. Ключевые файлы

---

Frontend:

- frontend/src/pages/DashboardPage.tsx (верхние плашки, графики, фильтры,
  “истинная” выручка Ozon из costs-tree)
- frontend/src/components/Shared/FilterPanel.tsx (пресеты 7/30/90 + custom,
  max=yesterday)
- frontend/src/lib/utils.ts (getYesterdayYmd, normalizeDateRangeYmd,
  fillDailySeriesYmd, getDateRangeFromPreset)
- frontend/src/store/useFiltersStore.ts (логика preset vs custom)
- frontend/src/components/Dashboard/MarketplaceBreakdown.tsx (синхронная
  “Детализация” OZON/WB)
- frontend/src/components/Dashboard/OzonAccrualsCard.tsx (карточка OZON +
  дерево, warnings/source, ₽-округление)
- frontend/src/components/Dashboard/WbAccrualsCard.tsx (карточка WB + дерево,
  WB_ACCOUNT, ₽-округление)
- frontend/src/components/Dashboard/SalesChart.tsx (connectNulls=false)
- frontend/src/components/Dashboard/AvgCheckChart.tsx
- frontend/src/components/Dashboard/DrrChart.tsx
- frontend/src/components/Dashboard/StocksTable.tsx (склады)
- frontend/src/components/Dashboard/CostsTreeView.tsx (визуал дерева “как в ЛК”
  — если понадобится отдельной секцией/страницей)

Backend:

- backend/app/api/v1/dashboard.py (/dashboard/costs-tree; percent_base_sales)
- backend/app/services/sync_service.py (_classify_ozon_operation, комиссионное
  разделение)

Reconcile:

- ozon/reconcile_accruals.py
- wb/reconcile_wb.py
