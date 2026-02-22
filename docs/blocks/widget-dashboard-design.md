# Widget Dashboard Design — Customizable Metric Cards

> Детальная спецификация UI/UX для кастомизируемой системы виджетов дашборда.
>
> Дата: 2026-02-21 | Обновлено: 2026-02-22 | Статус: **РЕАЛИЗОВАНО**
> Связан: [widget-dashboard-architecture.md](./widget-dashboard-architecture.md) (техническая архитектура)

**Правила CLAUDE.md:** #12 (@dnd-kit), #28 (Dashboard Cards grid), #38 (FilterPanel sticky)

> **ВАЖНО (2026-02-22):** Mobile FilterPanel обновлён на **Variant B** (семантическая группировка,
> 2 строки). Gear icon и Lock toggle теперь внутри FilterPanel. Desktop gear и lock — в FilterPanel
> после экспорт-кнопок. Подробности → [01-filter-panel.md](./dashboard/01-filter-panel.md)

---

## Содержание

1. [Settings Panel Design (Gear Icon)](#1-settings-panel-design)
2. [Widget Card Design](#2-widget-card-design)
3. [Empty State](#3-empty-state)
4. [First-Time Experience](#4-first-time-experience)
5. [Mobile Design (375px)](#5-mobile-design)
6. [Responsive Breakpoints](#6-responsive-breakpoints)
7. [Drag & Drop Visual Specs](#7-drag--drop-visual-specs)
8. [Axis Badge Design](#8-axis-badge-design)
9. [Settings Panel Interaction Flow](#9-settings-panel-interaction-flow)
10. [Lock Feature (миграция 022)](#10-lock-feature)

---

## 1. Settings Panel Design

### 1.1 Gear Icon Placement

Иконка шестерёнки размещается **между блоком карточек метрик и FilterPanel**, справа. Это кнопка-ссылка в строке заголовка карточек, НЕ внутри FilterPanel (FilterPanel не меняется).

```
Desktop (lg+):
┌─────────────────────────────────────────────────────────────────────────────┐
│  FilterPanel  [7д] [30д] [90д] | 01.02—21.02 | МП:[Все▼] | FBO/FBS | PDF │
└─────────────────────────────────────────────────────────────────────────────┘
                                                           ⚙ Настроить ←─── gear button
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Заказы      │ │  Выкупы      │ │  Себестоимость│ │  Прибыль     │
│  42          │ │  38 500 ₽    │ │  15 200 ₽    │ │  8 300 ₽     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘


Mobile (<640px) — Variant B (semantic grouping):
┌──────────────────────────────────────┐
│ Row 1: [7д][30д][90д]   [Все▼] FBO|FBS│  ← фильтры
│ Row 2: [01.02—21.02 ▾]  xlsx pdf 🔒⚙│  ← действия
└──────────────────────────────────────┘
┌───────┐ ┌───────┐
│Заказы │ │Выкупы │
│  42   │ │38500₽ │
└───────┘ └───────┘

Row 1: "какие данные показать" — период (left) + МП + FBO/FBS (right)
Row 2: "что с данными сделать" — DateRangePicker (flex-1) + actions (shrink-0)
🔒 = Lock/Unlock toggle (Lock/LockOpen icon, aria-pressed)
⚙ = Widget Settings button
```

**Tailwind классы кнопки:**
```tsx
// Desktop: текст + иконка
<button className="flex items-center gap-1.5 px-3 py-1.5
                   text-xs font-medium text-gray-500
                   hover:text-gray-700 hover:bg-gray-50
                   rounded-lg transition-colors">
  <Settings2 className="w-3.5 h-3.5" />
  <span className="hidden sm:inline">Настроить</span>
</button>

// Mobile: только иконка (внутри FilterPanel row 2, перед экспортом)
<button className="flex items-center justify-center
                   h-8 w-8 rounded-lg
                   text-gray-500 hover:text-gray-700 hover:bg-gray-50
                   transition-colors active:scale-95">
  <Settings2 className="w-4 h-4" />
</button>
```

### 1.2 Settings Panel — Desktop (Slide-out)

Панель выезжает справа. Дашборд остаётся видимым и обновляется в реальном времени при переключении виджетов.

```
┌────────────────────────────────────────┬─────────────────────────────────────┐
│                                        │ ╔═══════════════════════════════╗   │
│        Dashboard (visible,             │ ║  Настройка виджетов      ✕   ║   │
│        updates live)                   │ ╠═══════════════════════════════╣   │
│                                        │ ║                               ║   │
│  ┌─────────┐ ┌─────────┐              │ ║  Колонок:  (2) (3) [4] (5)   ║   │
│  │ Заказы  │ │ Выкупы  │              │ ║                               ║   │
│  └─────────┘ └─────────┘              │ ║  ─── Настройки ───            ║   │
│  ┌─────────┐ ┌─────────┐              │ ║  ○─── Оси данных        off   ║   │
│  │ Закупка │ │ Прибыль │              │ ║  ○─── Компактный режим  off   ║   │
│  └─────────┘ └─────────┘              │ ║                               ║   │
│                                        │ ║  ─── Продажи ───             ║   │
│  [Sales chart]                         │ ║  Данные по дате заказа       ║   │
│                                        │ ║                               ║   │
│                                        │ ║  ●─── Заказы                  ║   │
│                                        │ ║  ●─── Сумма заказов           ║   │
│                                        │ ║  ○─── Выкупы (шт)             ║   │
│                                        │ ║  ○─── Возвраты                ║   │
│                                        │ ║  ○─── Процент выкупа          ║   │
│                                        │ ║  ○─── Средний чек             ║   │
│                                        │ ║  ●─── Себестоимость           ║   │
│                                        │ ║                               ║   │
│                                        │ ║  ─── Финансы ───             ║   │
│                                        │ ║  Данные из финотчёта МП      ║   │
│                                        │ ║                               ║   │
│                                        │ ║  ●─── Выкупы (₽)             ║   │
│                                        │ ║  ●─── К перечислению          ║   │
│                                        │ ║  ●─── Удержания МП            ║   │
│                                        │ ║  ●─── Чистая прибыль          ║   │
│                                        │ ║  ●─── Маржинальность          ║   │
│                                        │ ║  ○─── Комиссия МП    🔒 Pro  ║   │
│                                        │ ║  ○─── Логистика       🔒 Pro  ║   │
│                                        │ ║  ○─── Хранение        🔒 Pro  ║   │
│                                        │ ║                               ║   │
│                                        │ ║  ─── Реклама ───             ║   │
│                                        │ ║  Данные по дате расхода      ║   │
│                                        │ ║                               ║   │
│                                        │ ║  ●─── Реклама                 ║   │
│                                        │ ║  ●─── ДРР                     ║   │
│                                        │ ║  ○─── ACOS          🔒 Pro   ║   │
│                                        │ ║  ○─── CPO           🔒 Pro   ║   │
│                                        │ ║                               ║   │
│                                        │ ║  ─── Остатки ───             ║   │
│                                        │ ║  ○─── Остатки (шт)            ║   │
│                                        │ ║  ○─── Ср. запас дней          ║   │
│                                        │ ║  ○─── Товары OOS              ║   │
│                                        │ ║                               ║   │
│                                        │ ║  ─── План продаж ───         ║   │
│                                        │ ║  ○─── Выполнение     🔒 Pro  ║   │
│                                        │ ║                               ║   │
│                                        │ ║  ─── Динамика ───            ║   │
│                                        │ ║  ●─── Δ к пред. пер. 🔒 Pro  ║   │
│                                        │ ║                               ║   │
│                                        │ ║  ┌─────────────────────────┐ ║   │
│                                        │ ║  │  Сбросить по умолчанию  │ ║   │
│                                        │ ║  └─────────────────────────┘ ║   │
│                                        │ ╚═══════════════════════════════╝   │
└────────────────────────────────────────┴─────────────────────────────────────┘
```

**Обозначения:**
- `●───` = toggle switch ON (виджет включен)
- `○───` = toggle switch OFF (виджет выключен)
- `🔒 Pro` = требуется подписка Pro+. Текст серый, switch disabled
- `[4]` = активная кнопка колонок (bg-indigo-600)
- `(2)(3)(5)` = неактивные кнопки (bg-gray-100)

### 1.3 Panel Dimensions & Positioning

```
Desktop (lg+):
- Width: 380px (w-[380px])
- Position: fixed right-0 top-0 bottom-0
- Z-index: z-40 (выше FilterPanel z-30, ниже модалей z-50)
- Background: bg-white
- Shadow: shadow-2xl
- Border: border-l border-gray-200
- Padding: p-6
- Overflow: overflow-y-auto (scrollable content)

Tablet (sm..lg):
- Width: 320px (w-80)
- Остальное — аналогично desktop

Mobile (<sm):
- Full-screen overlay (see section 5)
```

### 1.4 Panel Header

```tsx
// Header: title + close button
<div className="flex items-center justify-between mb-6">
  <h2 className="text-lg font-semibold text-gray-900">
    Настройка виджетов
  </h2>
  <button
    onClick={onClose}
    className="flex items-center justify-center w-8 h-8 rounded-lg
               text-gray-400 hover:text-gray-600 hover:bg-gray-100
               transition-colors"
    aria-label="Закрыть"
  >
    <X className="w-5 h-5" />
  </button>
</div>
```

### 1.5 Column Selector

```
  Колонок:
  ┌─────┐ ┌─────┐ ┌═════┐ ┌─────┐
  │  2  │ │  3  │ ║  4  ║ │  5  │
  └─────┘ └─────┘ └═════┘ └─────┘
   gray    gray    indigo   gray
```

```tsx
// Column count radio buttons
<div className="mb-6">
  <label className="text-sm font-medium text-gray-700 mb-2 block">
    Колонок:
  </label>
  <div className="flex gap-2">
    {[2, 3, 4, 5].map((n) => (
      <button
        key={n}
        onClick={() => setColumnCount(n)}
        className={cn(
          'h-9 w-12 text-sm font-semibold rounded-lg transition-all',
          columnCount === n
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        )}
      >
        {n}
      </button>
    ))}
  </div>
</div>
```

### 1.6 Toggle Switches (NOT Checkboxes)

Toggle switches используются вместо чекбоксов для большей touch-friendly площади касания.

```
  ON (enabled):
  ┌──────────────────────────────────────────────┐
  │  [●] Заказы              [████████●──]  ON   │
  │      ShoppingBag icon     indigo switch       │
  └──────────────────────────────────────────────┘

  OFF (disabled):
  ┌──────────────────────────────────────────────┐
  │  [○] Средний чек         [──●────────]  OFF  │
  │      Calculator icon      gray switch         │
  └──────────────────────────────────────────────┘

  Locked (Pro required):
  ┌──────────────────────────────────────────────┐
  │  [○] Комиссия МП         🔒 Pro              │
  │      CreditCard icon     (no switch, locked)  │
  └──────────────────────────────────────────────┘
```

```tsx
// Toggle switch
<div className="flex items-center justify-between py-2.5 group">
  <div className="flex items-center gap-2.5 min-w-0">
    <div className={cn(
      'flex items-center justify-center w-7 h-7 rounded-lg',
      isEnabled ? accentStyles[def.accent].bg : 'bg-gray-50'
    )}>
      <def.icon className={cn(
        'w-3.5 h-3.5',
        isEnabled ? accentStyles[def.accent].text : 'text-gray-400'
      )} />
    </div>
    <span className={cn(
      'text-sm font-medium truncate',
      isEnabled ? 'text-gray-900' : 'text-gray-500'
    )}>
      {def.title}
    </span>
  </div>

  {isLocked ? (
    <span className="flex items-center gap-1 text-xs text-gray-400">
      <Lock className="w-3 h-3" />
      Pro
    </span>
  ) : (
    <button
      role="switch"
      aria-checked={isEnabled}
      onClick={() => toggleWidget(def.id)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        isEnabled ? 'bg-indigo-600' : 'bg-gray-200'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-4 w-4 rounded-full',
        'bg-white shadow-sm ring-0 transition-transform duration-200',
        isEnabled ? 'translate-x-4' : 'translate-x-0.5',
        'mt-0.5'
      )} />
    </button>
  )}
</div>
```

### 1.7 Category Headers

```tsx
// Category divider
<div className="mt-5 mb-2">
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
      {category.label}
    </span>
    <div className="flex-1 h-px bg-gray-100" />
  </div>
  {category.axisNote && (
    <p className="text-[10px] text-gray-400 mt-0.5">
      {category.axisNote}
    </p>
  )}
</div>
```

### 1.8 Reset Button

```tsx
// Reset to defaults — bottom of panel
<div className="mt-6 pt-4 border-t border-gray-100">
  <button
    onClick={handleReset}
    className="w-full h-9 text-sm font-medium text-gray-500
               hover:text-gray-700 bg-gray-50 hover:bg-gray-100
               rounded-lg transition-colors"
  >
    Сбросить по умолчанию
  </button>
</div>
```

### 1.9 Backdrop (Click Outside to Close)

```tsx
// Backdrop — transparent overlay behind panel
<div
  className="fixed inset-0 z-[39] bg-black/5 backdrop-blur-[1px]"
  onClick={onClose}
  aria-hidden="true"
/>
```

`bg-black/5` — еле заметное затемнение, чтобы дашборд оставался видимым.
`backdrop-blur-[1px]` — минимальный блюр для фокуса внимания на панель.

---

## 2. Widget Card Design

### 2.1 Standard Card (1x1)

SummaryCard **не меняется**. Виджетная обёртка добавляет только drag handle и опциональный axis badge.

```
  IDLE STATE:
  ┌──────────────────────────────────┐
  │  [🛍]  Заказы           +12% ↗  │
  │                                  │
  │  42                              │
  │  38 500 ₽                       │
  │  3 возвр.                        │
  └──────────────────────────────────┘

  HOVER STATE (desktop only):
  ┌──────────────────────────────────┐
  │⠿ [🛍]  Заказы           +12% ↗  │    ← grip dots appear (text-gray-300)
  │                                  │
  │  42                              │
  │  38 500 ₽                       │
  │  3 возвр.                        │
  └──────────────────────────────────┘
   ↑
   6 dots (2x3 grid), cursor: grab

  HOVER + AXIS BADGE (when showAxisBadges=true, marketplace=ozon):
  ┌──────────────────────────────────┐
  │⠿ [🛍]  Заказы           +12% ↗  │
  │         [заказы]                 │   ← small blue pill badge
  │  42                              │
  │  38 500 ₽                       │
  └──────────────────────────────────┘
```

### 2.2 Drag Handle (Grip Dots)

```
  Grip dots pattern (2 columns x 3 rows):

    ●  ●
    ●  ●
    ●  ●

  Size: 10px wide x 18px tall
  Dot radius: 1.5px each
  Color: text-gray-300 (idle hover), text-gray-500 (active hover)
  Position: absolute, left edge of card, vertically centered
```

```tsx
// Drag handle — appears on hover (desktop), always visible on touch devices
<div
  {...listeners}
  className="absolute -left-1 top-1/2 -translate-y-1/2
             w-5 h-8 flex items-center justify-center
             cursor-grab active:cursor-grabbing
             opacity-0 group-hover:opacity-100
             sm:transition-opacity duration-150
             text-gray-300 hover:text-gray-500 z-10"
  aria-label="Перетащить виджет"
>
  <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor">
    <circle cx="2" cy="2" r="1.5" />
    <circle cx="8" cy="2" r="1.5" />
    <circle cx="2" cy="9" r="1.5" />
    <circle cx="8" cy="9" r="1.5" />
    <circle cx="2" cy="16" r="1.5" />
    <circle cx="8" cy="16" r="1.5" />
  </svg>
</div>
```

### 2.3 Drag States (Visual Progression)

```
  1. IDLE (normal):
  ┌──────────────────┐
  │  Заказы          │   shadow-sm, border-gray-100
  │  42              │   bg-white, rounded-2xl
  │  38 500 ₽       │   opacity-100
  └──────────────────┘

  2. HOVER (desktop):
  ┌──────────────────┐
  │⠿ Заказы          │   shadow-md (hover:shadow-md)
  │  42              │   grip dots: opacity-100
  │  38 500 ₽       │   cursor: grab
  └──────────────────┘

  3. GRABBED (mousedown on handle):
  ┌──────────────────┐
  │⠿ Заказы          │   cursor: grabbing
  │  42              │   (no visual change yet)
  │  38 500 ₽       │
  └──────────────────┘

  4. DRAGGING (moved 8px+ or long-press 200ms):

     Original position → placeholder:
     ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
     ╎                    ╎   border-2 border-dashed border-gray-200
     ╎    (empty)         ╎   bg-gray-50/50
     ╎                    ╎   rounded-2xl
     ╎                    ╎   same dimensions as card
     └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘

     Floating card (follows cursor):
     ╔══════════════════╗
     ║⠿ Заказы          ║   shadow-xl (elevation)
     ║  42              ║   scale-[1.02] (slightly larger)
     ║  38 500 ₽       ║   opacity-95
     ╚══════════════════╝   rotate-[1deg] (subtle tilt)
                            z-50 (above everything)
                            transition: none (follows cursor)

  5. OVER TARGET (card hovers over a drop zone):

     Target slot highlights:
     ┌──────────────────┐
     │                  │   bg-indigo-50
     │   (drop here)    │   border-2 border-dashed border-indigo-200
     │                  │   rounded-2xl
     └──────────────────┘

  6. DROP (released):
     Card animates to final position:
     - duration: 200ms
     - easing: cubic-bezier(0.34, 1.56, 0.64, 1) — spring overshoot
     - scale: 1.02 → 1.0
     - shadow: xl → sm
     - opacity: 95 → 100
     - rotate: 1deg → 0deg
```

**CSS Transitions:**

```tsx
// Dragging card overlay
const draggingStyle: CSSProperties = {
  transform: CSS.Transform.toString(transform),
  transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  zIndex: isDragging ? 50 : undefined,
};

// Card wrapper classes
const cardClasses = cn(
  'relative group',
  isDragging && 'shadow-xl scale-[1.02] opacity-95 rotate-[1deg]',
  isOver && !isDragging && 'ring-2 ring-indigo-300 ring-offset-2',
);

// Placeholder (DragOverlay sortable)
const placeholderClasses = cn(
  'border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50',
  'transition-colors duration-150',
  isOver && 'border-indigo-200 bg-indigo-50/50',
);
```

---

## 3. Empty State

Когда пользователь отключает все виджеты в настройках.

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  FilterPanel  [7д] [30д] [90д] | 01.02—21.02 | МП:[Все▼]     ⚙        │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │                                                                          │
  │                                                                          │
  │                         ┌──────────┐                                     │
  │                         │          │                                     │
  │                         │    +     │   w-14 h-14, bg-indigo-50           │
  │                         │          │   text-indigo-400, rounded-2xl      │
  │                         └──────────┘   hover:bg-indigo-100              │
  │                                                                          │
  │                   Нет активных виджетов                                  │
  │                                                                          │
  │             Добавьте метрики через  ⚙  Настройки                        │
  │                                                                          │
  │                                                                          │
  └──────────────────────────────────────────────────────────────────────────┘

  (Charts, MarketplaceBreakdown, StocksTable — всё ниже остаётся как было)
```

```tsx
// Empty state component
function WidgetEmptyState({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center
                    py-12 sm:py-16 mb-4 sm:mb-5 lg:mb-6
                    bg-white rounded-2xl border border-gray-100 shadow-sm">
      <button
        onClick={onOpenSettings}
        className="flex items-center justify-center w-14 h-14 mb-4
                   bg-indigo-50 hover:bg-indigo-100
                   text-indigo-400 hover:text-indigo-600
                   rounded-2xl transition-colors"
        aria-label="Добавить виджеты"
      >
        <Plus className="w-7 h-7" />
      </button>
      <p className="text-sm font-medium text-gray-600 mb-1">
        Нет активных виджетов
      </p>
      <p className="text-xs text-gray-400">
        Добавьте метрики через{' '}
        <button
          onClick={onOpenSettings}
          className="inline-flex items-center gap-0.5
                     text-indigo-600 hover:text-indigo-700
                     font-medium underline-offset-2 hover:underline"
        >
          <Settings2 className="w-3 h-3" />
          Настройки
        </button>
      </p>
    </div>
  );
}
```

---

## 4. First-Time Experience

### 4.1 Default Layout

Для новых пользователей (нет записи в `user_dashboard_config`) показываются **текущие 8 карточек** в привычном порядке. Пользователь не видит никаких изменений до момента клика на шестерёнку.

Default `enabled_widgets`:
```
orders_count, orders_revenue, revenue_settled, purchase_costs,
net_profit, mp_deductions, ad_cost, payout,
drr, profit_margin, period_delta
```

### 4.2 Onboarding Tooltip

При первом посещении (one-time, localStorage flag `dashboard_onboarding_shown`) показывается мини-tooltip рядом с шестерёнкой. Исчезает через 5 секунд ИЛИ по клику.

```
                                              ⚙ Настроить
                                              ┌─────────────────────────────┐
                                              │  Настройте дашборд          │
                                              │  Добавляйте и              │
                                              │  перемещайте карточки       │
                                              │                  [Понятно]  │
                                              └──────────┬──────────────────┘
                                                         ▼ (arrow points to gear)
```

```tsx
// Onboarding tooltip (one-time)
function OnboardingTooltip({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="absolute right-0 top-full mt-2 z-50
                    w-56 p-3 bg-gray-900 text-white
                    text-xs leading-relaxed rounded-xl shadow-2xl
                    animate-in fade-in slide-in-from-top-2 duration-300">
      <p className="font-medium mb-1">Настройте дашборд</p>
      <p className="text-gray-300 mb-2">
        Добавляйте, убирайте и перемещайте карточки метрик
      </p>
      <button
        onClick={onDismiss}
        className="text-indigo-300 hover:text-indigo-200 text-xs font-medium"
      >
        Понятно
      </button>
      {/* Arrow */}
      <div className="absolute -top-1 right-6 w-2 h-2 bg-gray-900 rotate-45" />
    </div>
  );
}
```

**LocalStorage key:** `dashboard_onboarding_v1`

---

## 5. Mobile Design (375px)

### 5.1 Settings Panel — Full Screen Overlay

На мобильных устройствах настройки открываются как **полноэкранный оверлей** с возможностью скролла. НЕ slide-out — экран слишком узкий.

```
  ┌───────────────────────────────────┐
  │ ← Настройка виджетов              │   sticky header
  ├───────────────────────────────────┤
  │                                   │
  │  Колонок:  [1] [2]               │   mobile: only 1 or 2 cols
  │                                   │
  │  ○── Оси данных             off   │
  │  ○── Компактный режим       off   │
  │                                   │
  │  ─── ПРОДАЖИ ───                  │
  │  По дате заказа                   │
  │                                   │
  │  ●── Заказы          [████●─]     │
  │  ●── Сумма заказов   [████●─]     │
  │  ○── Выкупы (шт)     [─●────]     │
  │  ○── Возвраты        [─●────]     │
  │  ○── Процент выкупа  [─●────]     │
  │  ○── Средний чек     [─●────]     │
  │  ●── Себестоимость   [████●─]     │
  │                                   │
  │  ─── ФИНАНСЫ ───                  │
  │  Данные из финотчёта МП           │
  │                                   │
  │  ●── Выкупы (₽)     [████●─]     │
  │  ●── К перечислению  [████●─]     │
  │  ●── Удержания МП    [████●─]     │
  │  ●── Чистая прибыль  [████●─]     │
  │  ●── Маржинальность  [████●─]     │
  │  ○── Комиссия МП     🔒 Pro      │
  │  ○── Логистика       🔒 Pro      │
  │  ○── Хранение        🔒 Pro      │
  │                                   │
  │  ─── РЕКЛАМА ───                  │
  │  ●── Реклама         [████●─]     │
  │  ●── ДРР             [████●─]     │
  │  ○── ACOS            🔒 Pro      │
  │  ○── CPO             🔒 Pro      │
  │                                   │
  │  ─── ОСТАТКИ ───                  │
  │  ○── Остатки (шт)    [─●────]     │
  │  ○── Ср. запас дней  [─●────]     │
  │  ○── Товары OOS      [─●────]     │
  │                                   │
  │  ─── ПЛАН ПРОДАЖ ───              │
  │  ○── Выполнение      🔒 Pro      │
  │                                   │
  │  ─── ДИНАМИКА ───                 │
  │  ●── Δ к пред. пер.  🔒 Pro      │
  │                                   │
  │  ┌─────────────────────────────┐  │
  │  │    Сбросить по умолчанию    │  │
  │  └─────────────────────────────┘  │
  │                                   │
  └───────────────────────────────────┘
```

```tsx
// Mobile full-screen overlay
<div className="fixed inset-0 z-50 bg-white overflow-y-auto
                sm:hidden">
  {/* Sticky header */}
  <div className="sticky top-0 z-10 bg-white border-b border-gray-100
                  flex items-center gap-3 px-4 py-3">
    <button
      onClick={onClose}
      className="flex items-center justify-center w-8 h-8 -ml-1
                 rounded-lg text-gray-500 hover:text-gray-700
                 hover:bg-gray-100 transition-colors"
      aria-label="Назад"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
    <h2 className="text-base font-semibold text-gray-900">
      Настройка виджетов
    </h2>
  </div>

  {/* Content */}
  <div className="px-4 py-4">
    {/* Column selector: only 1 and 2 on mobile */}
    {/* Category groups with toggles */}
    {/* Reset button */}
  </div>
</div>
```

### 5.2 Mobile Cards Layout

```
  1 column (mobile default):         2 columns (mobile option):
  ┌───────────────────────┐          ┌──────────┐ ┌──────────┐
  │ Заказы          +12%  │          │ Заказы   │ │ Выкупы   │
  │ 42                    │          │ 42       │ │ 38 500₽  │
  │ 38 500 ₽              │          └──────────┘ └──────────┘
  └───────────────────────┘          ┌──────────┐ ┌──────────┐
  ┌───────────────────────┐          │ Закупка  │ │ Прибыль  │
  │ Выкупы          +8%   │          │ 15 200₽  │ │ 8 300₽   │
  │ 38 500 ₽              │          └──────────┘ └──────────┘
  └───────────────────────┘
```

**Mobile card specifics:**
- Padding: `p-3 sm:p-4` (compact on mobile)
- Gap: `gap-2 sm:gap-2.5`
- Grip dots: hidden on mobile (drag via long-press anywhere on card)
- Touch area: entire card is draggable (long-press 200ms activates)
- Font size: uses `mobileTitle` if available (shorter text)

### 5.3 Mobile Drag Behavior

```
  Long-press flow (200ms):

  1. User touches card → 200ms timer starts
  2. After 200ms → haptic pulse (navigator.vibrate(10))
  3. Card "lifts": shadow-xl, scale-[1.05], opacity-90
  4. User drags → auto-scroll if near edge (top/bottom 80px zone)
  5. Release → spring animation to new position (250ms)
  6. Cancel → tap (< 200ms) triggers card tooltip as usual
```

```tsx
// Touch sensor config (@dnd-kit)
useSensor(TouchSensor, {
  activationConstraint: {
    delay: 200,       // long-press delay
    tolerance: 5,     // movement tolerance during delay (px)
  },
});

// Haptic feedback on drag start
const handleDragStart = useCallback(() => {
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}, []);
```

---

## 6. Responsive Breakpoints

### 6.1 Breakpoint Table

| Breakpoint | Range | Default Cols | Max Cols | Settings Panel | Card Padding | Gap |
|-----------|-------|-------------|----------|---------------|-------------|-----|
| Mobile | `< 640px` (sm) | 2 | 2 | Full-screen overlay | `p-3` | `gap-2` |
| Tablet | `640px - 1023px` | 2 | 3 | Slide-out 320px | `p-4` | `gap-2.5` |
| Desktop | `1024px+` (lg) | 4 | 5 | Slide-out 380px | `p-4 sm:p-5` | `gap-3` |

### 6.2 Grid Classes per Column Count

```tsx
const GRID_CLASSES: Record<number, string> = {
  1: 'grid grid-cols-1 gap-2',
  2: 'grid grid-cols-2 gap-2 sm:gap-2.5',
  3: 'grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5 lg:gap-3',
  4: 'grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3',                 // DEFAULT
  5: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5',
};
```

### 6.3 Card Minimum Width

```
min-width: 160px (enforced by grid columns)
max-width: none (fills available column width)
aspect-ratio: not fixed (content-driven height)
```

On 375px viewport with 2 columns:
- Available width: 375 - 16*2 (container padding) - 8 (gap) = 335px
- Per card: ~167px (meets 160px minimum)

On 1024px viewport with 4 columns:
- Available width: ~960px (with sidebar) or ~1024px (no sidebar)
- Per card: ~230px

### 6.4 Column Count Persistence

Column count выбранный пользователем сохраняется в `user_dashboard_config.column_count`. На мобильных всегда применяется `grid-cols-2` (или `grid-cols-1` если выбрано 1), независимо от сохранённого значения.

```tsx
// Applied grid class respects viewport
const effectiveColumns = useMemo(() => {
  if (isMobile) return Math.min(columnCount, 2);  // cap at 2 on mobile
  return columnCount;
}, [columnCount, isMobile]);
```

---

## 7. Drag & Drop Visual Specs

### 7.1 State Machine

```
                ┌─────────┐
                │  IDLE    │
                └────┬────┘
                     │ hover (desktop) / touch (mobile)
                     ▼
                ┌─────────┐
                │  HOVER   │   grip dots visible (desktop)
                └────┬────┘
                     │ mousedown on handle / long-press 200ms
                     ▼
                ┌─────────┐
                │  GRAB    │   cursor: grabbing
                └────┬────┘
                     │ moved 8px (pointer) or long-press confirmed
                     ▼
                ┌──────────┐
                │ DRAGGING  │   card elevated, placeholder shown
                └────┬─────┘
                     │ hover over target slot
                     ▼
                ┌───────────┐
                │ OVER_TARGET│  target slot highlights indigo
                └────┬──────┘
                     │ mouse up / touch end
                     ▼
                ┌──────────┐
                │  DROP     │   spring animation → new position
                └────┬─────┘
                     │ animation complete (200ms)
                     ▼
                ┌─────────┐
                │  IDLE    │
                └─────────┘
```

### 7.2 Detailed Visual Specs per State

| State | Shadow | Scale | Opacity | Border | Rotate | Z-Index | Cursor |
|-------|--------|-------|---------|--------|--------|---------|--------|
| IDLE | `shadow-sm` | 1.0 | 100% | `border-gray-100` | 0 | auto | default |
| HOVER | `shadow-md` | 1.0 | 100% | `border-gray-100` | 0 | auto | grab |
| GRAB | `shadow-md` | 1.0 | 100% | `border-gray-100` | 0 | auto | grabbing |
| DRAGGING | `shadow-xl` | 1.02 | 95% | `border-gray-200` | 1deg | 50 | grabbing |
| PLACEHOLDER | none | 1.0 | n/a | `border-2 dashed gray-200` | 0 | auto | n/a |
| OVER_TARGET | n/a | n/a | n/a | `border-2 dashed indigo-200` | 0 | auto | n/a |
| DROP (anim) | `xl→sm` | `1.02→1.0` | `95→100` | restoring | `1→0` | `50→auto` | default |

### 7.3 @dnd-kit Configuration

```tsx
// Sensors
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,   // 8px movement threshold before drag starts
    },
  }),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,     // 200ms long-press
      tolerance: 5,   // 5px movement allowed during delay
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
);

// Collision detection
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={enabledWidgets}
    strategy={rectSortingStrategy}  // grid-optimized strategy
  >
    {/* ... */}
  </SortableContext>

  {/* DragOverlay for smooth portal-based dragging */}
  <DragOverlay>
    {activeId ? (
      <div className="shadow-xl scale-[1.02] opacity-95 rotate-[1deg]
                      rounded-2xl">
        <SummaryCard {...getWidgetProps(activeId)} />
      </div>
    ) : null}
  </DragOverlay>
</DndContext>
```

### 7.4 Accessibility (Keyboard DnD)

```
Tab → focus on card
Space/Enter → pick up card
Arrow keys → move position in grid
Space/Enter → drop card
Escape → cancel drag

ARIA:
- aria-roledescription="sortable" on each card
- aria-label="Виджет {title}, позиция {n} из {total}. Нажмите пробел для перемещения."
- Live region announces: "Виджет {title} перемещён на позицию {n}"
```

---

## 8. Axis Badge Design

### 8.1 Badge Variants

Badges показывают источник данных для прозрачности cross-axis (особенно важно для Ozon).

```
  "Заказы" badge:     ┌──────────┐
  (ORDER-based)       │  заказы  │   bg-blue-50 text-blue-600 border-blue-200
                      └──────────┘

  "Финансы" badge:    ┌──────────┐
  (SETTLEMENT-based)  │ финансы  │   bg-emerald-50 text-emerald-600 border-emerald-200
                      └──────────┘

  "Реклама" badge:    ┌──────────┐
  (AD-DATE-based)     │ реклама  │   bg-amber-50 text-amber-600 border-amber-200
                      └──────────┘

  "Остатки" badge:    ┌──────────┐
  (NEUTRAL/real-time) │ остатки  │   bg-gray-50 text-gray-600 border-gray-200
                      └──────────┘

  "Смешанные" badge:  ┌──────────┐
  (MIXED axes)        │ смешанн. │   bg-orange-50 text-orange-600 border-orange-200
                      └──────────┘

  "Расчёт" badge:     ┌──────────┐
  (CALCULATED)        │  расчёт  │   bg-violet-50 text-violet-600 border-violet-200
                      └──────────┘
```

### 8.2 Badge Component

```tsx
const AXIS_BADGE_STYLES: Record<DataAxis, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  order:      { label: 'заказы',   bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200' },
  settlement: { label: 'финансы',  bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  ad:         { label: 'реклама',  bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200' },
  neutral:    { label: 'остатки',  bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200' },
  calculated: { label: 'расчёт',   bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200' },
  mixed:      { label: 'смешанн.', bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-200' },
};

function AxisBadge({ axis }: { axis: DataAxis }) {
  const style = AXIS_BADGE_STYLES[axis];
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded-full',
      'text-[10px] font-medium leading-none border',
      style.bg, style.text, style.border,
    )}>
      {style.label}
    </span>
  );
}
```

### 8.3 Badge Placement in Card

Badge размещается **после title, на той же строке** (если влезает) или **под title на следующей строке** (на узких карточках).

```
  Desktop (wide card):
  ┌──────────────────────────────────┐
  │  [🛍]  Заказы  [заказы]   +12%  │    ← badge inline after title
  │  42                              │
  └──────────────────────────────────┘

  Mobile (narrow card):
  ┌───────────────────┐
  │  [🛍] Заказы +12% │
  │  [заказы]         │    ← badge wraps to second line
  │  42               │
  └───────────────────┘
```

```tsx
// Badge placement in card header
<div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 flex-wrap">
  {Icon && (
    <div className={cn('flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl ring-1', colors.bg, colors.ring)}>
      <Icon className={cn('w-4 h-4 sm:w-[18px] sm:h-[18px]', colors.text)} />
    </div>
  )}
  <span className="text-xs sm:text-sm font-medium text-gray-500 truncate">
    {title}
  </span>
  {showAxisBadge && <AxisBadge axis={axis} />}
</div>
```

### 8.4 Visibility Rules

1. **Default: OFF** (`show_axis_badges = false` in config)
2. **Toggle in settings:** "Оси данных" toggle switch
3. **Ozon-only mode (optional future):** Show only when `marketplace === 'ozon'` (WB doesn't have cross-axis issue). For Phase 1, show for all marketplaces when enabled.
4. **User can toggle off anytime** -- preference persisted in `user_dashboard_config`

### 8.5 Ozon Cross-Axis Info Banner

Когда `marketplace === 'ozon'` И у пользователя включены виджеты из разных осей (например, `orders_count` ORDER + `revenue_settled` SETTLEMENT), показывается информационный баннер.

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  ℹ  Ozon: карточки «Заказы» и «Выкупы» используют разные даты.          │
  │     Заказы — дата заказа, Выкупы — дата фин. операции (±7-30 дней).     │
  │                                                              [Скрыть]   │
  └──────────────────────────────────────────────────────────────────────────┘
```

```tsx
// Ozon cross-axis banner
<div className="flex items-start gap-2 px-3 py-2.5 mb-3
                bg-blue-50 border border-blue-100 rounded-xl
                text-xs text-blue-700 leading-relaxed">
  <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
  <div className="flex-1">
    <span className="font-medium">Ozon:</span>{' '}
    карточки «Заказы» и «Выкупы» используют разные источники дат.{' '}
    Заказы — по дате заказа, Выкупы — по дате фин. операции (расхождение 7-30 дней).
  </div>
  <button
    onClick={() => setShowCrossAxisBanner(false)}
    className="shrink-0 text-blue-400 hover:text-blue-600"
  >
    <X className="w-3.5 h-3.5" />
  </button>
</div>
```

---

## 9. Settings Panel Interaction Flow

### 9.1 Step-by-Step Flow

```
  STEP 1: User clicks gear icon
  ┌─────────────────────────┐
  │  Dashboard              │ ⚙ ← click
  │  ┌────┐ ┌────┐          │
  │  │ 42 │ │ ₽  │          │
  │  └────┘ └────┘          │
  └─────────────────────────┘

  STEP 2: Panel slides from right (desktop) / full-screen (mobile)
  Animation: transform translateX(100%) → translateX(0)
  Duration: 300ms ease-out
  Backdrop: bg-black/5 fades in

  ┌───────────────────┬──────────────┐
  │                   │ Настройка    │
  │  Dashboard        │ виджетов     │
  │  (dimmed slightly)│              │
  │  ┌────┐ ┌────┐    │ Колонок: [4] │
  │  │ 42 │ │ ₽  │    │              │
  │  └────┘ └────┘    │ ── Продажи   │
  │                   │ ●── Заказы   │
  └───────────────────┴──────────────┘

  STEP 3: User toggles widget off
  Dashboard updates LIVE (no save button):

  "Себестоимость" toggled OFF:
  ┌───────────────────┬──────────────┐
  │                   │              │
  │  ┌────┐ ┌────┐    │ ○── Себест.  │  ← toggled off
  │  │ 42 │ │ ₽  │    │              │
  │  └────┘ └────┘    │              │
  │  ┌────┐            │              │  ← card removed from grid
  │  │Приб│            │              │     with exit animation
  │  └────┘            │              │
  └───────────────────┴──────────────┘

  STEP 4: User toggles widget ON
  Card appears in grid with enter animation:
  - opacity: 0 → 1 (150ms)
  - transform: scale(0.95) → scale(1) (150ms spring)

  STEP 5: User changes column count (4 → 3)
  Grid re-flows with 200ms transition:
  ┌─────────────────────┬──────────────┐
  │                     │ Колонок:     │
  │  ┌──────┐ ┌──────┐  │ (2) [3] (4)  │  ← 3 selected
  │  │ 42   │ │ ₽    │  │              │
  │  └──────┘ └──────┘  │              │
  │  ┌──────┐            │              │
  │  │Приб  │            │              │
  │  └──────┘            │              │
  └─────────────────────┴──────────────┘

  STEP 6: User closes panel
  Option A: Click ✕ button
  Option B: Click backdrop (dimmed area)
  Option C: Press Escape key

  Animation: panel slides out (translateX(0) → translateX(100%))
  Duration: 200ms ease-in
  Backdrop: fades out
```

### 9.2 Auto-Save Mechanism

```
  User action (toggle / reorder / column change)
       │
       ▼
  Zustand store updated immediately
  (isDirty = true)
       │
       ▼
  Dashboard UI updates instantly (optimistic)
       │
       ▼
  Debounce timer starts/resets (1500ms)
       │
       ▼ (after 1500ms of inactivity)
  PUT /dashboard/config → Supabase
       │
       ▼
  isDirty = false
  Subtle save indicator: small check icon near gear (500ms, then fades)
```

Save indicator (optional, subtle):
```tsx
// Save indicator — appears briefly after successful save
{isSaving && (
  <span className="text-gray-400 text-[10px] animate-pulse">
    Сохранение...
  </span>
)}
{justSaved && (
  <Check className="w-3 h-3 text-emerald-500 animate-in fade-in duration-300" />
)}
```

### 9.3 Panel Animation CSS

```tsx
// Panel slide-in/out
const panelClasses = cn(
  'fixed right-0 top-0 bottom-0 z-40',
  'bg-white shadow-2xl border-l border-gray-200',
  'w-[380px] lg:w-[380px] sm:w-80',
  'overflow-y-auto',
  'transform transition-transform duration-300 ease-out',
  isOpen ? 'translate-x-0' : 'translate-x-full',
);

// Backdrop fade
const backdropClasses = cn(
  'fixed inset-0 z-[39]',
  'bg-black/5 backdrop-blur-[1px]',
  'transition-opacity duration-300',
  isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
);
```

### 9.4 Panel Close via Escape

```tsx
// Escape key handler
useEffect(() => {
  if (!isOpen) return;
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', handleEsc);
  return () => document.removeEventListener('keydown', handleEsc);
}, [isOpen, onClose]);
```

---

## Приложение A: Color Reference

### Card Accent Colors (existing, from SummaryCard)

| Accent | BG | Text | Ring | Use |
|--------|-----|------|------|-----|
| indigo | `bg-indigo-50` | `text-indigo-600` | `ring-indigo-100` | Заказы, default |
| emerald | `bg-emerald-50` | `text-emerald-600` | `ring-emerald-100` | Выкупы, прибыль+ |
| amber | `bg-amber-50` | `text-amber-600` | `ring-amber-100` | Себестоимость |
| red | `bg-red-50` | `text-red-600` | `ring-red-100` | Убыток, OOS |
| sky | `bg-sky-50` | `text-sky-600` | `ring-sky-100` | Перечисление, остатки |
| violet | `bg-violet-50` | `text-violet-600` | `ring-violet-100` | Реклама |
| slate | `bg-gray-100` | `text-gray-600` | `ring-gray-200` | Удержания |

### Axis Badge Colors (new)

| Axis | BG | Text | Border | Label |
|------|-----|------|--------|-------|
| order | `bg-blue-50` | `text-blue-600` | `border-blue-200` | заказы |
| settlement | `bg-emerald-50` | `text-emerald-600` | `border-emerald-200` | финансы |
| ad | `bg-amber-50` | `text-amber-600` | `border-amber-200` | реклама |
| neutral | `bg-gray-50` | `text-gray-600` | `border-gray-200` | остатки |
| calculated | `bg-violet-50` | `text-violet-600` | `border-violet-200` | расчёт |
| mixed | `bg-orange-50` | `text-orange-600` | `border-orange-200` | смешанн. |

---

## Приложение B: Tailwind Animation Utilities

```css
/* In tailwind config or @layer utilities */

/* Panel slide-in */
@keyframes slide-in-from-right {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

/* Card enter (widget toggle on) */
@keyframes widget-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Card exit (widget toggle off) */
@keyframes widget-exit {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

/* Drop spring */
@keyframes drop-spring {
  0%   { transform: scale(1.02) rotate(1deg); }
  60%  { transform: scale(0.99) rotate(0deg); }
  100% { transform: scale(1) rotate(0deg); }
}
```

Classes:
```tsx
'animate-widget-enter' // → widget-enter 150ms cubic-bezier(0.34, 1.56, 0.64, 1)
'animate-widget-exit'  // → widget-exit 150ms ease-in
'animate-drop-spring'  // → drop-spring 200ms cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## Приложение C: File Structure

```
frontend/src/
├── components/
│   └── Dashboard/
│       ├── SummaryCard.tsx          (existing, unchanged)
│       ├── WidgetGrid.tsx           (NEW — grid container + DnD)
│       ├── SortableWidget.tsx       (NEW — drag wrapper for SummaryCard)
│       ├── WidgetSettingsPanel.tsx   (NEW — settings slide-out/overlay)
│       ├── WidgetEmptyState.tsx      (NEW — empty state when 0 widgets)
│       ├── AxisBadge.tsx            (NEW — data source badge)
│       ├── OnboardingTooltip.tsx    (NEW — first-time tooltip)
│       └── widgets/
│           ├── registry.ts          (NEW — types, categories)
│           └── definitions.ts       (NEW — 24 widget definitions)
├── store/
│   └── useDashboardLayoutStore.ts   (NEW — Zustand store)
├── hooks/
│   └── useDashboardConfig.ts        (NEW — load/save config)
└── pages/
    └── DashboardPage.tsx            (MODIFIED — widgetValues + WidgetGrid)
```

---

## 10. Lock Feature

### 10.1 Назначение

Фиксация позиций виджетов — предотвращает случайное перемещение карточек drag & drop. Особенно важно на мобильных (long-press может сработать случайно).

### 10.2 Lock Toggle Button

**Desktop (в FilterPanel, после export buttons):**
```
... | [Excel] [PDF] | 🔒 | ⚙ Виджеты |
                      ↑
                  Lock toggle
```

**Mobile (в FilterPanel Row 2, action icons):**
```
[01.02—21.02 ▾]     [xlsx][pdf][🔒][⚙]
                               ↑
                           Lock toggle (h-8 w-8)
```

### 10.3 Visual States

```
  UNLOCKED:
  [🔓]  text-gray-400 hover:text-gray-600 hover:bg-gray-100
        LockOpen icon, aria-pressed="false"

  LOCKED:
  [🔒]  text-indigo-600 bg-indigo-50 hover:bg-indigo-100
        Lock icon, aria-pressed="true"
```

### 10.4 Effect on WidgetGrid

```
  locked=false (default):
  - DnD sensors active (PointerSensor + TouchSensor)
  - Grip dots visible on hover (desktop)
  - cursor: grab on handle, cursor: grabbing during drag
  - Long-press drag on mobile

  locked=true:
  - DnD sensors = [] (empty array — no drag possible)
  - Grip dots hidden (listeners not spread)
  - cursor: default on all cards
  - Long-press does nothing (no haptic)
  - Cards still show data, tooltips work, links work
```

### 10.5 Data Flow

```
FilterPanel: toggleLocked()
  └─ useDashboardLayoutStore.toggleLocked()
       └─ locked = !locked, isDirty = true
            └─ useDashboardConfig (debounce 1.5s)
                 └─ PUT /dashboard/config { locked: true/false }
                      └─ user_dashboard_config.locked (миграция 022)
```

### 10.6 Миграция

```sql
-- 022_dashboard_config_locked.sql
ALTER TABLE user_dashboard_config
ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## Приложение D: Implementation Checklist

- [x] SummaryCard.tsx: НЕ менять (wrapped в SortableWidget)
- [x] FilterPanel.tsx: Lock toggle + gear icon (desktop & mobile Variant B)
- [x] DashboardPage: hardcoded grid → `<WidgetGrid />`
- [x] DashboardPage: `widgetValues` и `loadingStates` useMemo
- [x] @dnd-kit: уже в проекте (Product Management)
- [x] Supabase: миграция 021 + 022
- [x] Backend: GET/PUT /dashboard/config (partial update, validation)
- [x] Lock feature: миграция 022, Zustand, FilterPanel, WidgetGrid
- [x] Mobile: Variant B layout (2 rows, all controls visible)
- [x] Accessibility: aria-pressed (lock), aria-label (icon buttons), role=switch (settings toggles)
