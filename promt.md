# Промпт для нового чата: Analytics Dashboard WB & Ozon

Продолжаем разработку Analytics Dashboard для WB и Ozon. Backend: FastAPI
(http://localhost:8000), Frontend: React+TS (http://localhost:5173).

---

## ПРОМПТ ДЛЯ КОПИРОВАНИЯ В НОВЫЙ ЧАТ:

```
Продолжаем разработку Analytics Dashboard для WB и Ozon. Backend: FastAPI
(http://localhost:8000), Frontend: React+TS (http://localhost:5173).

**Текущее состояние (30.01.2026):** DashboardPage полностью готова, mobile-first дизайн реализован.

---

## Что сделано по mobile-first (30.01.2026):

### Layout (идентичен на всех экранах):
- OZON/WB карточки ВСЕГДА 50/50 горизонтально (`grid-cols-2`)
- Боковые фильтры ВСЕГДА слева вертикально
- Hamburger menu справа, drawer справа
- Sticky header (z-index: 40)

### MarketplaceBreakdown (OZON/WB карточки):
- Компактный layout для 50% ширины: Продажи + Начислено в строке
- WB: Продажи включают СПП, полоска разделена
- WB: "Возмещения" → "СПП" (Скидка постоянного покупателя)
- OZON: показываются ВСЕ категории удержаний (убран "+1 ещё")

### Графики (компактные):
- SalesChart: 100px mobile / 140px desktop (было 200-300px)
- AvgCheckChart: 80px mobile / 100px desktop
- DrrChart: 80px mobile / 100px desktop
- Zero-line fallback: нулевой график вместо "Нет данных"

### DateRangePicker (react-day-picker v9):
- classNames для v9: `selected`, `today`, `range_start`, `range_end`
- Мобильное позиционирование: `fixed inset-x-2 top-[10vh]`
- Debounce 300ms для API запросов

### Хуки responsive:
- `useIsMobile()` — max-width: 639px
- `useIsTablet()` — 640px - 1023px
- `useIsDesktop()` — min-width: 1024px

---

## Что сделано по оптимизации:

### Backend:
- Supabase RPC `get_dashboard_summary` — агрегация одним запросом
- Supabase RPC `get_costs_tree` — иерархия на PostgreSQL
- Индексы для mp_sales, mp_costs, mp_costs_details, mp_ad_costs

### Frontend:
- Props drilling: AccrualsCards получают данные через props
- Убран `deferredEnabled` — каскадные ре-рендеры
- Lazy-load графиков через `React.lazy()`
- Мемоизация через `useMemo`

---

## Ключевые файлы:

Frontend:
- `frontend/src/pages/DashboardPage.tsx` — главная страница
- `frontend/src/components/Dashboard/MarketplaceBreakdown.tsx` — OZON+WB 50/50
- `frontend/src/components/Dashboard/OzonAccrualsCard.tsx` — карточка OZON
- `frontend/src/components/Dashboard/WbAccrualsCard.tsx` — карточка WB + СПП
- `frontend/src/components/Dashboard/SalesChart.tsx` — график с zero-line fallback
- `frontend/src/components/Shared/Layout.tsx` — hamburger справа
- `frontend/src/hooks/useMediaQuery.ts` — responsive хуки

Backend:
- `backend/app/api/v1/dashboard.py` — API endpoints
- `backend/migrations/002_optimized_rpc.sql` — RPC функции

---

## Архитектура (props drilling):

```
DashboardPage
  ├── useCostsTree(ozon) → ozonCostsTreeData
  ├── useCostsTree(wb) → wbCostsTreeData
  │
  └── MarketplaceBreakdown (grid-cols-2 ВСЕГДА)
        ├── OzonAccrualsCard (props: costsTreeData)
        └── WbAccrualsCard (props: costsTreeData)
```

---

## Возможные задачи:

### Готово:
- [x] Mobile-first layout (50/50 карточки, фильтры слева)
- [x] Компактные графики (80-140px) + zero-line fallback
- [x] WB: СПП в продажах, унификация терминологии
- [x] OZON: все категории удержаний видны
- [x] DateRangePicker с react-day-picker v9

### Backlog:
- [ ] Excel export
- [ ] Unit-Economics страница
- [ ] CostsTreeView визуал — довести до 1-в-1 как в ЛК Ozon

---

## ВАЖНО:

- OZON/WB мэтчинг начислений уже 1-в-1 с ЛК — НЕ ЛОМАТЬ
- react-day-picker v9 — classNames отличаются от v8
- Backend: `uvicorn app.main:app --reload --port 8000` (папка backend/)
- Frontend: `npm run dev` (папка frontend/)
- Не делать git команды без явного согласия
- Не запускать/останавливать серверы без явного согласия

Документация: CLAUDE.md, frontend/README.md, backend/README.md
```

---

## Прошлые ошибки (не повторять):

1. `deferredEnabled` — создавал каскадные ре-рендеры при изменении фильтров
2. `useInView` с `rootMargin` — не триггерился для далёких элементов
3. Дублирование запросов — каждая AccrualsCard делала свой useCostsTree
4. `include_children: false` — возвращал пустое дерево
5. react-day-picker v8 classNames в v9 — day_selected → selected
6. `grid-cols-1 sm:grid-cols-2` — карточки стекались на mobile (исправлено на `grid-cols-2`)
7. Большое "Нет данных" в графиках — заменено на zero-line fallback

---

## Reconcile (не ломать):

- `ozon/reconcile_accruals.py` — сверка OZON начислений с ЛК
- `wb/reconcile_wb.py` — сверка WB начислений с CSV выгрузкой

---

## Технологии:

- **Frontend:** React 19.2, TypeScript 5.9, Vite 7.2, Tailwind CSS 3.4
- **Calendar:** react-day-picker 9.x + date-fns 4.x
- **State:** React Query 5.90, Zustand 5.0
- **Backend:** FastAPI, Supabase (PostgreSQL)
