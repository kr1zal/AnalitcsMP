# FilterPanel (панель фильтров)

> Sticky-панель с фильтрами периода, маркетплейса и FBO/FBS + действия (экспорт, замочек, настройки виджетов) -- единый источник фильтров для всего дашборда

**Правила CLAUDE.md:** #3, #32, #38, #40, #42

## Визуальная структура

### Desktop (md+): одна строка, `sticky top-16 z-30`

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Период: [7д] [30д] [90д] │ 📅 01.02–21.02 │ МП: [Все ▾] │ Тип: Все|FBO|FBS │ Excel PDF │ 🔒 ⚙️ │
└────────────────────────────────────────────────────────────────────────────────────────┘
     ↑ indigo-600           ↑ DateRangePicker   ↑ <select>   ↑ pill-кнопки     ↑ экспорт   ↑ замочек + настройки
     active = bg-indigo-600   isActive при       value из     bg-gray-100        emerald/     locked: indigo-50
     text-white               custom preset      Zustand      rounded-lg p-0.5   rose         unlocked: gray-500
```

`sticky top-16` -- 16 = высота навбара (64px = 4rem). Desktop ниже навбара.

### Mobile: 2 строки (Variant B -- семантическая группировка), `sticky top-0 z-30`

```
┌──────────────────────────────────────────────────┐
│ Row 1 (фильтры):                                 │
│   [7д] [30д] [90д]        [Все▾] [Все|FBO|FBS]  │
│   ← период (left) →       ← МП + тип (right) →  │
│                                                   │
│ Row 2 (действия):                                 │
│   [📅 16 фев – 22 фев]         [📊] [📄] [🔒] [⚙️] │
│   ← календарь flex-1 →         ← action icons →  │
└──────────────────────────────────────────────────┘
```

**Дизайн-решение (Variant B):** Row 1 отвечает на "какие данные показать?" (период + сегменты), Row 2 -- "что с ними сделать?" (выбор дат + действия). Все 8 контролов видны, ноль overflow. Паттерн Shopify Admin / Mixpanel (фильтры + toolbar separation).

**Расчёт на 344px (320px content):**
- Row 1: ~114px (период) + ~158px (МП+FT) = 272px -- 48px slack
- Row 2: ~174px (calendar) + ~134px (4 icons x 32px + gaps) = 308px -- 12px slack

`sticky top-0` -- на мобильных навбар скрыт, панель прилипает к самому верху.

## Файлы

| Компонент | Путь | Props |
|-----------|------|-------|
| FilterPanel | `frontend/src/components/Shared/FilterPanel.tsx` | `{ onExportExcel?, onExportPdf?, onWidgetSettings?, isExporting?, exportType? }` |
| useFiltersStore | `frontend/src/store/useFiltersStore.ts` | Zustand store (фильтры) |
| useDashboardLayoutStore | `frontend/src/store/useDashboardLayoutStore.ts` | Zustand store (locked, toggleLocked) |
| useFilterUrlSync | `frontend/src/hooks/useFilterUrlSync.ts` | Хук URL-синхронизации |
| useFulfillmentInfo | `frontend/src/hooks/useDashboard.ts:85` | Проверка наличия FBS данных |
| DateRangePicker | `frontend/src/components/Shared/DateRangePicker.tsx` | Календарь с `captionLayout="label"` |
| getMaxAvailableDateYmd | `frontend/src/lib/utils.ts:30` | Макс. доступная дата (МСК TZ) |
| getDateRangeFromPreset | `frontend/src/lib/utils.ts:145` | Диапазон дат по пресету |
| formatDateMoscow | `frontend/src/lib/utils.ts:12` | YYYY-MM-DD в МСК TZ |

### FilterPanelProps (строка 19, FilterPanel.tsx)

```ts
interface FilterPanelProps {
  onExportExcel?: () => void;      // callback экспорта Excel
  onExportPdf?: () => void;        // callback экспорта PDF (только Pro+)
  onWidgetSettings?: () => void;   // callback открытия настроек виджетов
  isExporting?: boolean;           // блокирует кнопки во время экспорта
  exportType?: ExportType;         // 'excel' | 'pdf' | null
}
```

## Data Flow

```
FilterPanel
  ├─ useFiltersStore() → Zustand state (фильтры данных)
  │     datePreset: '7d' | '30d' | '90d' | 'custom'
  │     marketplace: 'all' | 'wb' | 'ozon'
  │     fulfillmentType: 'all' | 'FBO' | 'FBS'
  │     customDateFrom: string | null
  │     customDateTo: string | null
  │
  ├─ useDashboardLayoutStore() → Zustand state (UI layout)
  │     locked: boolean          → замочек фиксации виджетов
  │     toggleLocked: () => void → переключение замочка
  │
  ├─ useFilterUrlSync() → двусторонняя синхронизация URL ↔ Zustand
  │     URL → Zustand: один раз при mount
  │     Zustand → URL: при каждом изменении фильтра
  │
  ├─ useFulfillmentInfo() → { has_fbs_data: boolean }
  │     queryKey: ['dashboard', 'fulfillment-info']
  │     staleTime: 30 мин
  │     └─ GET /api/v1/dashboard/fulfillment-info
  │          └─ SELECT id FROM mp_sales WHERE fulfillment_type='FBS' LIMIT 1
  │
  ├─ getMaxAvailableDateYmd() → "YYYY-MM-DD" (МСК TZ)
  │     до 10:00 МСК = вчера, после 10:00 = сегодня
  │
  └─ getDateRangeFromPreset(datePreset, customFrom, customTo, maxDate)
       → { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
```

### Как фильтры распространяются на дашборд

```
FilterPanel → useFiltersStore (Zustand)
                    │
                    ▼
        DashboardPage.tsx
        ├─ const { datePreset, marketplace, fulfillmentType, ... } = useFiltersStore();
        ├─ const dateRange = getDateRangeFromPreset(datePreset, customDateFrom, customDateTo);
        ├─ const ftParam = fulfillmentType === 'all' ? undefined : fulfillmentType;
        │
        ├─ filters = { date_from, date_to, marketplace, fulfillment_type }
        │     └─ useDashboardSummaryWithPrev(filters)
        │     └─ useUnitEconomics(filters)
        │     └─ useSalesPlanCompletion(filters)
        │
        ├─ chartFilters = { ...filters, product_id: selectedProduct }
        │     └─ useSalesChart(chartFilters)
        │     └─ useAdCosts(chartFilters)
        │
        ├─ costs-tree (ВСЕГДА оба МП -- правило #36):
        │     └─ useCostsTree({ ...filters, marketplace: 'ozon' })
        │     └─ useCostsTree({ ...filters, marketplace: 'wb' })
        │
        └─ stocks (ВСЕГДА все МП -- правило #37):
              └─ useStocks('all', fulfillmentType)
```

**Ключевое:** costs-tree ВСЕГДА загружает оба МП независимо от `marketplace` фильтра -- MarketplaceBreakdown показывает OZON и WB всегда (правило #36). Stocks тоже всегда `marketplace='all'` (правило #37).

## Lock / Unlock виджетов

Замочек фиксации предотвращает drag-and-drop перетаскивание карточек метрик.

### Data flow замочка

```
FilterPanel (🔒 кнопка)
  │ onClick → toggleLocked()
  ▼
useDashboardLayoutStore.locked (Zustand)
  │ isDirty = true
  ▼
useDashboardConfig (debounced auto-save, 1.5 сек)
  │ PUT /api/v1/dashboard/config { locked: true/false }
  ▼
user_dashboard_config.locked (Supabase, migration 022)
```

### UI состояния замочка

| Состояние | Иконка | Стиль | aria |
|-----------|--------|-------|------|
| Locked | `Lock` | `text-indigo-600 bg-indigo-50` | `aria-pressed="true"` |
| Unlocked | `LockOpen` | `text-gray-400 hover:bg-gray-100` | `aria-pressed="false"` |

### Влияние на WidgetGrid

```
WidgetGrid.tsx:
  const locked = useDashboardLayoutStore((s) => s.locked);
  const activeSensors = useSensors(pointerSensor, touchSensor, keyboardSensor);
  const noSensors = useSensors();  // пустые сенсоры = DnD отключен
  const sensors = locked ? noSensors : activeSensors;

SortableWidget.tsx:
  locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
  {...(locked ? {} : listeners)}  // не передаём DnD listeners когда locked
```

## Zustand Store (useFiltersStore)

Файл: `frontend/src/store/useFiltersStore.ts`

```ts
interface FiltersState {
  datePreset: DateRangePreset;      // '7d' | '30d' | '90d' | 'custom'
  marketplace: Marketplace;          // 'all' | 'wb' | 'ozon'
  fulfillmentType: FulfillmentType;  // 'all' | 'FBO' | 'FBS'
  customDateFrom: string | null;     // YYYY-MM-DD при custom
  customDateTo: string | null;       // YYYY-MM-DD при custom
  setDatePreset: (preset) => void;   // сбрасывает customDateFrom/To → null
  setMarketplace: (mp) => void;
  setFulfillmentType: (ft) => void;
  setCustomDates: (from, to) => void; // устанавливает datePreset='custom' + даты
  reset: () => void;                 // → defaults: 7d, all, all, null, null
}
```

**Начальные значения:** `datePreset='7d'`, `marketplace='all'`, `fulfillmentType='all'`.

**Поведение `setDatePreset`:** сбрасывает `customDateFrom` и `customDateTo` в `null`. Переключение с custom на пресет автоматически "забывает" выбранные даты.

**Поведение `setCustomDates`:** устанавливает `datePreset='custom'` автоматически.

## URL Sync (useFilterUrlSync)

Файл: `frontend/src/hooks/useFilterUrlSync.ts`

### URL параметры

| Param | Значения | Дефолт (не пишется в URL) |
|-------|----------|---------------------------|
| `period` | `7d`, `30d`, `90d`, `custom` | `7d` |
| `mp` | `all`, `wb`, `ozon` | `all` |
| `ft` | `all`, `FBO`, `FBS` | `all` |
| `from` | `YYYY-MM-DD` (только при period=custom) | -- |
| `to` | `YYYY-MM-DD` (только при period=custom) | -- |

Примеры URL:
- `/dashboard` -- все фильтры по умолчанию (7д, все МП, все типы)
- `/dashboard?period=30d&mp=wb` -- 30 дней, только WB
- `/dashboard?period=custom&from=2026-01-15&to=2026-02-15&ft=FBS` -- custom период, только FBS

### Фазы синхронизации

**Фаза 1: URL -> Zustand** (при mount):
1. Читает `window.location.search`
2. Если URL пуст -- оставляет Zustand defaults, выходит
3. Валидирует каждый param через Set (`VALID_PRESETS`, `VALID_MP`, `VALID_FT`)
4. Устанавливает в store через `setMarketplace()`, `setFulfillmentType()`, `setDatePreset()` / `setCustomDates()`
5. `isUpdatingFromUrl` ref предотвращает обратную запись в URL во время инициализации
6. Сброс через `queueMicrotask` (до следующего рендера)

**Фаза 2: Zustand -> URL** (при каждом изменении фильтра):
1. Пропускает во время инициализации (`isUpdatingFromUrl.current`)
2. Берёт текущие URL params, удаляет только свои ключи (`FILTER_KEYS`)
3. Пишет только non-default значения (чистый URL при дефолтах)
4. `window.history.replaceState` (НЕ pushState -- не засоряет history)
5. Сохраняет чужие query params (utm_source, ref и т.д.)

### Где подключен

`useFilterUrlSync()` вызывается ВНУТРИ FilterPanel (строка 43, FilterPanel.tsx). Не в каждой странице -- только один раз в компоненте, который на всех страницах дашборда.

## FBS disabled логика (useFulfillmentInfo)

Файл: `frontend/src/hooks/useDashboard.ts:85`

```ts
const { data: fulfillmentInfo } = useFulfillmentInfo();
const hasFbsData = fulfillmentInfo?.has_fbs_data ?? false;
```

**Правило #32:** FBS pill ВСЕГДА видим в панели. Если FBS-данных нет -- кнопка `disabled` (серая, `cursor-not-allowed`, `text-gray-300`). Это product feature -- пользователь должен видеть, что аналитика FBS поддерживается.

Backend (dashboard.py):
```python
# GET /dashboard/fulfillment-info
result = supabase.table("mp_sales")
    .select("id", count="exact")
    .eq("user_id", current_user.id)
    .eq("fulfillment_type", "FBS")
    .limit(1)
    .execute()
has_fbs = result.count > 0
```

queryKey: `['dashboard', 'fulfillment-info']`, staleTime: 30 минут (данные меняются редко -- только после синхронизации).

Логика disabled (FilterPanel.tsx mobile строка 116; desktop строка 290):
```tsx
const disabled = ft.value === 'FBS' && !hasFbsData;
// disabled → text-gray-300 cursor-not-allowed, onClick игнорируется
// title="Нет FBS-данных"
```

## Вычисление дат (Moscow TZ -- правило #42)

### `getMaxAvailableDateYmd()` (utils.ts:30)

Максимальная дата для выбора в календаре и для `dateTo` в пресетах.

```ts
const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
const moscowHour = moscowTime.getHours();

if (moscowHour < 10) {
  // до 10:00 МСК — данные за сегодня ещё не доступны
  return formatDateMoscow(yesterday);  // T-1
}
return formatDateMoscow(now);  // T-0
```

**Почему 10:00 МСК:** WB/Ozon обновляют данные за предыдущий день к ~08:00-09:00 МСК. Порог 10:00 даёт запас.

### `formatDateMoscow()` (utils.ts:12)

```ts
const formatDateMoscow = (date: Date): string =>
  date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
```

Формат `sv-SE` дает `YYYY-MM-DD` (ISO). `timeZone: 'Europe/Moscow'` гарантирует одинаковый результат независимо от TZ браузера пользователя.

**КРИТИЧНО (правило #42):** НИКОГДА не использовать `format(new Date(), 'yyyy-MM-dd')` для "текущей даты" -- результат зависит от TZ браузера. Bug discovery: пользователь в UTC+0 видел другую дату, чем пользователь в UTC+3, что приводило к разнице в данных costs-tree (payout diff 1100 руб).

### `getDateRangeFromPreset()` (utils.ts:145)

```ts
getDateRangeFromPreset(preset, customFrom, customTo, maxDate?)
```

| Preset | from | to |
|--------|------|-----|
| `7d` | `maxDate - 6 days` | `maxDate` |
| `30d` | `maxDate - 29 days` | `maxDate` |
| `90d` | `maxDate - 89 days` | `maxDate` |
| `custom` | `customFrom` | `customTo` (capped at maxDate) |

При custom: нормализует через `normalizeDateRangeYmd()` -- гарантирует `from <= to`, ограничивает сверху `maxDate`.

## DateRangePicker

Компонент: `frontend/src/components/Shared/DateRangePicker.tsx`

- Использует `captionLayout="label"` (правило #3 -- НЕ dropdown)
- Props: `{ from, to, maxDate, onChange, isActive }`
- При isActive (custom preset) -- выделяется визуально
- onChange вызывает `handleDateRangeChange` в FilterPanel:
  ```ts
  const normalized = normalizeDateRangeYmd(from, to, { max: maxAvailableDate });
  setCustomDates(normalized.from, normalized.to);
  ```

## Состояние и кэширование

- **Zustand (useFiltersStore):** синхронный store, без persist (фильтры живут в URL)
- **Zustand (useDashboardLayoutStore):** locked state, auto-save через useDashboardConfig (debounce 1.5s)
- **React Query:**
  - `useFulfillmentInfo`: `queryKey: ['dashboard', 'fulfillment-info']`, staleTime 30 мин
  - `useDashboardConfigQuery`: `queryKey: ['dashboard', 'config']`, staleTime 30 мин
- **URL state:** `useFilterUrlSync` -- replaceState, не pushState. Дефолты не пишутся в URL
- **Backend persist:** `user_dashboard_config.locked` (migration 022), upsert on_conflict user_id

## Edge Cases

1. **URL с невалидными параметрами** -- `VALID_PRESETS`, `VALID_MP`, `VALID_FT` (Set) отсекают невалидные значения; Zustand остается на defaults.
2. **URL с `period=custom` без `from`/`to`** -- условие `urlFrom && urlTo && isValidDate(...)` не проходит, пресет игнорируется.
3. **Даты `from > to`** -- `normalizeDateRangeYmd` меняет местами.
4. **Дата в будущем** -- clamp через `{ max: maxAvailableDate }`.
5. **FBS-данных нет** -- кнопка FBS disabled, но видна. Пользователь видит что фича существует.
6. **Пользователь в другом TZ** -- `formatDateMoscow` и `getMaxAvailableDateYmd` всегда работают в МСК. Проверено: UTC-5 и UTC+9 дают одинаковый результат.
7. **Чужие URL params** -- utm_source, ref и т.д. сохраняются при replaceState.
8. **Переход между страницами** -- useFilterUrlSync подключен в FilterPanel, который присутствует на DashboardPage. AdsPage имеет свою локальную панель фильтров (правило #41).
9. **Lock/unlock без onWidgetSettings** -- замочек и настройки показываются ТОЛЬКО когда передан `onWidgetSettings` callback. На страницах без виджетов -- скрыты.
10. **Lock persist failure** -- при ошибке сети locked state остаётся в Zustand (UX не ломается), retry при следующем изменении через isDirty.

## Зависимости

- **Зависит от:** useFiltersStore (Zustand), useDashboardLayoutStore (Zustand), useFulfillmentInfo (React Query), DateRangePicker, utils.ts
- **Используется в:** DashboardPage
- **НЕ используется:** AdsPage (имеет свою панель -- правило #41), SettingsPage
- **Feature gate:** нет (FilterPanel доступен всем тарифам). PDF экспорт за `pdf_export` feature (Pro+) -- callback не передаётся если нет фичи

## Sticky поведение (правило #38)

- Desktop: `sticky top-16 z-30`
- Mobile: `sticky top-0 z-30`
- `z-30` перекрывает контент ниже при скролле (паттерн GA/Mixpanel/Shopify)
- НЕ убирать z-30 -- контент будет "проглядывать" сквозь панель
- Root layout использует `[overflow-x:clip]` (НЕ `overflow-x-hidden`) -- clip не создаёт scroll container и не ломает sticky

## Миграции

| Миграция | Описание |
|----------|----------|
| 022 | `ALTER TABLE user_dashboard_config ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE` |

## Известные проблемы

- [ ] При быстром переключении фильтров возможен race condition в React Query -- решается staleTime (5 мин) и автоотменой предыдущих запросов (React Query v5)
