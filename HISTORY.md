# Хронология изменений (human log)

Этот файл — **история ключевых решений/правок** по проекту.\
`promt.md` используется только как “промпт для нового чата” и не хранит историю.

---

## 2026‑01‑24 — WB matching + карточка начислений + reconcile

### Цели

- Добиться **1‑в‑1 мэтча** WB с ЛК “Финансовые отчёты”.
- Сделать WB карточку начислений по аналогии с Ozon (3 колонки + дерево).
- Добавить инструмент контроля (reconcile), чтобы ловить регрессы при изменениях
  отчётов WB (раз в 1–2 месяца обновлять выгрузки).

### Backend

- **WB “истина”**: закреплён источник
  `statistics-api /api/v5/supplier/reportDetailByPeriod`.
- `WildberriesClient.get_report_detail()`:
  - добавлена пагинация через `rrdid` (догрузка до 204)
  - добавлен параметр `period="daily"`
  - корректная обработка 204 (No Content)
- `sync_sales_wb()`:
  - переведён на `reportDetailByPeriod` (выручка/выкупы по `rr_dt` “как в ЛК”)
- `sync_costs_wb()`:
  - пишет **`mp_costs` + `mp_costs_details`** (детализация для дерева)
  - категории/подкатегории названы **как в кабинетной выгрузке**
  - знаки по `ppvz_vw`/`ppvz_vw_nds` берутся **как в отчёте** (без `abs()`)
  - добавлен системный “товар” **`WB_ACCOUNT`** (“WB: вне разреза товаров”) для
    строк отчёта без привязки к товару/без маппинга, чтобы totals не терялись
- `GET /dashboard/costs-tree`:
  - добавлен порядок категорий для WB
  - добавлен fallback на `mp_sales/mp_costs` при отсутствии `mp_costs_details` +
    `warnings/source` (чтобы UI не падал)
- `GET /dashboard/summary`:
  - для `marketplace=wb` не применяется orphan‑фильтр costs по товарам с
    продажами (иначе “Хранение” и account-level начисления пропадали)

### Frontend

- Добавлена карточка WB: `frontend/src/components/Dashboard/WbAccrualsCard.tsx`
  - источник: `GET /dashboard/costs-tree?marketplace=wb`
  - деградация без падения: при отсутствии дерева — показывает агрегаты из
    `/dashboard/summary` и алерт на недоступных полях
- `frontend/src/components/Dashboard/MarketplaceBreakdown.tsx`:
  - WB блок заменён на `WbAccrualsCard`
- Унификация названия первой колонки:
  - Ozon: “Продажи и возвраты” → **“Выручка”**
  - WB: “Продажи” → **“Выручка”**

### Reconcile (контроль точности)

- Добавлены:
  - `wb/reconcile_wb.py`
  - `wb/RECONCILE.md`
- Скрипт считает “как в ЛК” по выгрузкам
  `wb/Еженедельн*детализированн*отчет*.csv` и сравнивает с нашим API.
- На периоде **2026‑01‑01..2026‑01‑18** reconcile сводится к расхождениям уровня
  копеек (округления).

---

## 2026‑01‑26 — Dashboard UX: даты “до вчера”, полные N‑дней на графиках, синхронная детализация OZON/WB

### Даты / пресеты / “сутки”

- Добавлены утилиты:
  - `getYesterdayYmd()` — единая “верхняя” дата по умолчанию.
  - `normalizeDateRangeYmd(from,to,{max})` — clamp до yesterday + swap если from
    > to.
  - `fillDailySeriesYmd(range,data,makeEmpty)` — заполнение дневного ряда
    [from..to].
- `getDateRangeFromPreset(7d/30d/90d)` теперь строит диапазон **до вчера**
  (чтобы не упираться в неполные данные “сегодня”).
- `useFiltersStore`:
  - `setDatePreset()` сбрасывает `customDateFrom/To`.
  - `setCustomDates()` переводит `datePreset` в `custom`.
- `FilterPanel`:
  - date inputs ограничены `max=yesterday`.
  - ручной ввод нормализуется через `normalizeDateRangeYmd`.
  - при пресетах в инпутах показывается effective range, но состояние остаётся
    preset (не custom).
- `DashboardPage`:
  - prev period больше не использует `toISOString()` (фикс TZ-сдвига на сутки);
    форматирование через `formatDateForAPI`.

### Графики (7/30/90 должны показывать полный диапазон)

- Backend отдаёт только дни с активностью → фронт заполняет ряд до полного
  диапазона.
- SalesChart:
  - рисует **gap (null)** только для дней **после** последней фактической даты
    (чтобы не было “нулевого хвоста”).
  - `connectNulls={false}`.
- AvgCheck / DRR:
  - получают полный дневной ряд, чтобы ось всегда была на N дней.

### MarketplaceBreakdown / карточки начислений

- `MarketplaceBreakdown`: синхронизированная кнопка “Детализация” для
  `OzonAccrualsCard` и `WbAccrualsCard`.
- Детализация уменьшена ~на 25% (шрифты/отступы), разделители верхних блоков
  выровнены (min-height).
- Валюта: WB приведён к стилю OZON — суммы в карточке отображаются **в ₽ без
  копеек** (точные значения остаются в `title`).

### `WB_ACCOUNT`

- Системный `WB_ACCOUNT` скрыт из пользовательского списка товаров в sidebar
  (защита от “невидимой фильтрации” при случайном выборе).
- В детализации WB добавлена секция “Служебные WB (без товара)” только при
  наличии строк; если дерево полностью дублирует основное — показывается краткий
  инфо-блок вместо дублирования.

---

## 2026‑01‑29 — Dashboard perf “топ‑приоритет”: меньше initial JS/CPU + безопасные логи API

### Цель

- Ускорить **первый meaningful render** и снизить “ощущение тормозов” без
  изменения семантики/точности данных.

### Frontend (performance quick wins)

- `frontend/src/services/api.ts`
  - dev‑логирование API больше **не печатает `response.data`** (payload) в
    консоль.
  - логи стали “метрики”: url + status + time + content-length (если есть).
- `frontend/src/pages/DashboardPage.tsx`
  - графики переведены на **lazy‑load** (отложенная загрузка, чтобы `recharts`
    не попадал в initial bundle).
  - подготовка рядов для графиков (`salesChartSeries`, `adCostsSeriesFull`)
    мемоизирована.
- `frontend/src/components/Dashboard/*Chart.tsx`
  - внутренняя подготовка `chartData` мемоизирована, чтобы не пересчитывать
    массивы на каждый ререндер.
- `frontend/src/components/Dashboard/StocksTable.tsx`
  - вычисление totals/filter/sort мемоизировано, чтобы клики/перерисовки не
    гоняли сортировку заново.

### Важный gotcha (React hooks)

- Нельзя вызывать хуки (`useMemo`, `useEffect`, …) **после ранних `return`**
  (loading/error/empty).
  - Иначе ловим runtime: `Rendered more hooks than during the previous render`.
  - В этом изменении все `useMemo` перемещены **выше** ранних `return` (в
    `DashboardPage`, `SalesChart`, `AvgCheckChart`, `DrrChart`, `StocksTable`).

### Репозиторий

- Проект залит в GitHub: `https://github.com/kr1zal/AnalitcsMP` (branch `main`).
