# Analytics Dashboard - Frontend

React + TypeScript приложение для аналитики продаж на Wildberries и Ozon.

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- Backend запущен на http://localhost:8000

### Запуск

```bash
npm install
npm run dev
```

Приложение: http://localhost:5173

---

## ✅ Что реализовано (v1.0 - 30.01.2026)

### Core
- [x] Vite 7.2 + React 19.2 + TypeScript 5.9 + Tailwind CSS 3
- [x] TypeScript типы на основе backend API
- [x] Axios client + React Query 5.90
- [x] Zustand store для фильтров
- [x] Toast уведомления (Sonner)

### DashboardPage
- [x] 8 карточек метрик (Выручка, Прибыль, ДРР, Реклама, Расх.МП, К перечисл., Пред.пер., Δ к пред.)
- [x] FilterPanel с пресетами 7/30/90д + DateRangePicker (react-day-picker v9)
- [x] Боковые фильтры: Маркетплейс (все/WB/OZON) + Товары

### MarketplaceBreakdown (OZON/WB карточки)
- [x] **Всегда 50/50 горизонтально** (`grid-cols-2` на всех экранах)
- [x] OzonAccrualsCard: Продажи, Начислено, Удержания (все категории видны)
- [x] WbAccrualsCard: Продажи + СПП, Начислено, Удержания
- [x] Компактный layout для узких колонок
- [x] Раскрываемая детализация (дерево удержаний)

### Графики (компактные)
- [x] SalesChart: 100px mobile / 140px desktop, табы Заказы/Выкупы/Выручка
- [x] AvgCheckChart: 80px mobile / 100px desktop, BarChart среднего чека
- [x] DrrChart: 80px mobile / 100px desktop, AreaChart ДРР
- [x] Zero-line fallback: при отсутствии данных показывается нулевой график

### StocksTable
- [x] Card-based на mobile с внутренним scroll
- [x] Сортировка: OOS/критичные товары вверху
- [x] Фильтры: Все / OOS WB / OOS Ozon / Low
- [x] Статусы раздельно: `WB: ...` и `Ozon: ...`

### Mobile-first адаптация (30.01.2026)
- [x] **Mobile:** верхнего меню нет; фиксированная плашка справа (25% от верха), медленное переливание градиента; по тапу — выезжающая панель с 4 ссылками (Дашборд, Unit-экономика, Реклама, Синхронизация)
- [x] **Desktop:** header (логотип + горизонтальное меню) без изменений
- [x] Фильтры всегда слева вертикально
- [x] Адаптивные шрифты: text-[9px]-text-[11px] mobile / text-xs-text-sm desktop

---

## 📝 Следующие шаги

1. ~~Custom Date Picker~~ ✅ (DateRangePicker готов)
2. ~~Mobile-first адаптация~~ ✅
3. Excel export
4. Unit-Economics страница (углубление)
5. CostsTreeView визуал — довести до 1-в-1 как в ЛК Ozon

---

## ⚡️ Performance заметки (DashboardPage)

- `recharts` тяжёлый (~500KB) → графики грузятся лениво через `React.lazy()`
- Backend использует Supabase RPC (`get_dashboard_summary`, `get_costs_tree`)
- Props drilling: AccrualsCards получают данные через props (не делают свои запросы)
- Убран `deferredEnabled` — создавал каскадные ре-рендеры
- `useMemo` для мемоизации `salesChartSeries`, `adCostsSeriesFull`
- При отсутствии данных графики показывают zero-line (не "Нет данных")

---

## 🛠 Технологии

- React 19.2 + TypeScript 5.9
- Vite 7.2
- Tailwind CSS 3
- React Query 5.90
- axios, recharts, sonner, date-fns 4.x, zustand 5.0
- react-day-picker 9.x (DateRangePicker)
- lucide-react (иконки)

---

---

## 📱 Responsive breakpoints (Tailwind)

| Breakpoint | Ширина | Использование |
|------------|--------|---------------|
| default    | <640px | Mobile (базовые стили) |
| `sm:`      | ≥640px | Tablet portrait |
| `md:`      | ≥768px | Tablet landscape |
| `lg:`      | ≥1024px| Desktop |
| `xl:`      | ≥1280px| Wide desktop |

**Хуки для JS:**
- `useIsMobile()` — `max-width: 639px`
- `useIsTablet()` — `640px - 1023px`
- `useIsDesktop()` — `min-width: 1024px`

---

## 📚 Документация

- [DESIGN_REFERENCE.md](DESIGN_REFERENCE.md) — гайд по дизайну
- [../CLAUDE.md](../CLAUDE.md) — главная документация проекта
- [../DECISIONS.md](../DECISIONS.md) — архитектурные решения
- [../backend/README.md](../backend/README.md) — backend API
