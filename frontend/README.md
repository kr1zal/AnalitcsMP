# Analytics Dashboard - Frontend

React + TypeScript приложение для аналитики продаж на Wildberries и Ozon.

## Быстрый старт

```bash
npm install
npm run build    # проверка компиляции (НИКОГДА npm run dev для проверки)
```

Dev: http://localhost:5173 | Backend: http://localhost:8000

---

## Технологии

- React 19.2 + TypeScript 5.9 + Vite 7.2
- Tailwind CSS 3 (НЕ v4)
- React Query 5.90 + Zustand 5.0
- axios, recharts, sonner, date-fns 4.x
- react-day-picker 9.x (DateRangePicker)
- lucide-react (иконки)
- @supabase/supabase-js (auth only)

---

## Структура проекта

```
frontend/src/
├── components/
│   ├── Dashboard/
│   │   ├── SummaryCard.tsx         # Карточка метрики (адаптивная)
│   │   ├── SalesChart.tsx          # График продаж (100/140px, табы)
│   │   ├── AvgCheckChart.tsx       # Средний чек (80/100px)
│   │   ├── DrrChart.tsx            # ДРР (80/100px, zero-line)
│   │   ├── StocksTable.tsx         # Остатки (card-based mobile)
│   │   ├── MarketplaceBreakdown.tsx # OZON+WB grid-cols-2
│   │   ├── OzonAccrualsCard.tsx    # Начисления Ozon + дерево
│   │   └── WbAccrualsCard.tsx      # Начисления WB + СПП
│   └── Shared/
│       ├── Layout.tsx              # Desktop header + Mobile slide-in panel
│       ├── ProtectedRoute.tsx      # Auth guard + onboarding redirect
│       ├── FilterPanel.tsx         # Пресеты 7/30/90д
│       ├── DateRangePicker.tsx     # v9 compact, 32px cells
│       └── LoadingSpinner.tsx
├── hooks/
│   ├── useDashboard.ts             # React Query: summary, costs-tree, stocks, etc.
│   ├── useSync.ts                  # React Query: sync mutations
│   ├── useAuth.ts                  # Auth listener (getSession + onAuthStateChange)
│   ├── useTokens.ts               # Token CRUD (Phase 2)
│   ├── useMediaQuery.ts            # useIsMobile, useIsTablet, useIsDesktop
│   └── useExport.ts                # Excel/PDF экспорт
├── lib/
│   ├── utils.ts                    # formatCurrency, formatDate, etc.
│   ├── supabase.ts                 # Supabase client (auth only)
│   └── exportExcel.ts              # Генерация Excel (6 листов)
├── pages/
│   ├── DashboardPage.tsx           # Главная: фильтры + метрики + графики
│   ├── UnitEconomicsPage.tsx       # Прибыль по товарам
│   ├── AdsPage.tsx                 # Реклама: ДРР, таблица по дням
│   ├── SyncPage.tsx                # Синхронизация: логи, кнопки
│   ├── LoginPage.tsx               # Login/Register + eye toggle
│   ├── SettingsPage.tsx            # Настройки: профиль + API-токены + подсказки
│   └── PrintPage.tsx               # PDF layout (3 страницы A4)
├── services/
│   └── api.ts                      # Axios + auth interceptor + tokensApi
├── store/
│   ├── useFiltersStore.ts          # Zustand: даты, маркетплейс, товар
│   └── useAuthStore.ts             # Zustand: user, isLoading, setUser
├── types/
│   └── index.ts                    # Все TypeScript типы
├── App.tsx                         # Routes + useAuth + ProtectedRoute
├── index.css                       # RDP v9 стили, nav-tab-strip
└── main.tsx
```

---

## Auth (SaaS Phase 1)

- **Supabase Auth** — email/password, getSession + onAuthStateChange
- **Auth interceptor** (api.ts) — Bearer token в каждый запрос, 401 → /login
- **ProtectedRoute** — если !user → /login
- **LoginPage** — login/register с eye toggle для пароля
- **Layout** — email + кнопка "Выйти" (desktop + mobile)

## Onboarding (SaaS Phase 2)

- **ProtectedRoute** — если user есть, но нет токенов → redirect /settings
- **SettingsPage** — 3 секции (WB, Ozon Seller, Ozon Performance):
  - Password inputs + eye toggle
  - Кнопки "Проверить" (validate через API МП)
  - Подсказки: как получить токены в ЛК каждого МП
  - "Сохранить и синхронизировать" — автосинк после сохранения
- **useTokens.ts** — useTokensStatus, useSaveTokens, useValidateTokens, useSaveAndSync

---

## DashboardPage — Архитектура данных

```
DashboardPage
  ├── useCostsTree('ozon') → ozonCostsTree
  ├── useCostsTree('wb') → wbCostsTree
  │
  └── MarketplaceBreakdown (props: ozonCostsTree, wbCostsTree)
        ├── OzonAccrualsCard (props: costsTreeData, isLoading)
        └── WbAccrualsCard (props: costsTreeData, isLoading)
```

**Важно про источники данных:**
- `mp_sales.revenue` — все заказы (включая непроведённые)
- `mp_costs_details."Продажи"` — финализированные выкупы (как в ЛК)
- Верхняя плашка "Продажи" берёт из costs-tree, НЕ из summary

**AccrualsCards:** данные через props, НЕ свои запросы (оптимизация).

---

## Performance

- `recharts` (~500KB) → `React.lazy()` для графиков
- AccrualsCards через props (не дублируют запросы)
- `useMemo` для salesChartSeries, adCostsSeriesFull
- Zero-line при отсутствии данных (не "Нет данных")
- Backend: Supabase RPC (get_dashboard_summary, get_costs_tree)

---

## Mobile-first дизайн

### Layout
- **Desktop:** header (логотип + горизонтальная навигация), sticky
- **Mobile:** боковая плашка (градиент indigo→violet, 5s анимация)
  - Тап → slide-in панель 240px (было 280px)
  - Swipe вправо для закрытия (threshold 60px)
  - 48px touch target (Apple HIG)

### Компоненты
- SummaryCard: адаптивные padding/шрифты, скрытые иконки на mobile
- MarketplaceBreakdown: grid-cols-2 всегда (50/50)
- Графики: компактные (100px mobile / 140px desktop)
- StocksTable: card-based на mobile, цветовая индикация OOS

### DateRangePicker (react-day-picker v9)
- 32px desktop / 34px mobile ячейки
- `captionLayout="label"` (НЕ dropdown — баг синхронизации года)
- Пресеты: Сегодня, Вчера, 7д, 30д, Месяц
- Mobile: `fixed inset-x-4 top-[15vh]`

---

## Responsive breakpoints (Tailwind)

| Breakpoint | Ширина  | Использование          |
| ---------- | ------- | ---------------------- |
| default    | <640px  | Mobile (базовые стили) |
| `sm:`      | ≥640px  | Tablet portrait        |
| `md:`      | ≥768px  | Tablet landscape       |
| `lg:`      | ≥1024px | Desktop                |
| `xl:`      | ≥1280px | Wide desktop           |

**JS hooks:** useIsMobile (`max-width: 639px`), useIsTablet (`640-1023px`), useIsDesktop (`min-width: 1024px`)

---

## Export

### Excel
- 6 листов: Сводка (OZON/WB), Продажи, Реклама, Удержания, Unit-экономика, Остатки
- Библиотека: xlsx

### PDF
- Backend: `GET /export/pdf` → Playwright + Chromium
- Frontend: PrintPage (3 страницы A4, `?token=` для auth)
- Hook: useExport → exportPdf()

---

## Дизайн

- Стиль: Stripe Dashboard (минималистичный)
- Цвета: WB `#8B3FFD`, Ozon `#005BFF`
- Иконки: lucide-react
- CSS: `.rdp-compact`, `.nav-tab-strip` в index.css

---

## Документация

- [DESIGN_REFERENCE.md](DESIGN_REFERENCE.md) — гайд по дизайну (цвета, шрифты, spacing)
- [../CLAUDE.md](../CLAUDE.md) — главная документация проекта
- [../CHANGELOG.md](../CHANGELOG.md) — история изменений
- [../promt.md](../promt.md) — промпт для нового чата
- [../backend/README.md](../backend/README.md) — backend API
