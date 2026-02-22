# [Название блока]

> Одна строка — что делает блок

**Правила CLAUDE.md:** #N, #M

## Визуальная структура

```
[ASCII-схема UI блока]
```

## Файлы

| Компонент | Путь | Props |
|-----------|------|-------|
| ComponentName | `frontend/src/components/...` | `{ prop: type }` |

## Data Flow

```
UI Component (value={computedValue})
  └─ DashboardPage вычисление (строки XXX-YYY)
       └─ Hook: useXxx(filters)
            queryKey: ['dashboard', 'xxx', dateFrom, dateTo, marketplace]
            staleTime: 5min
            └─ API: dashboardApi.getXxx(params)
                 └─ GET /api/v1/dashboard/xxx
                      params: date_from, date_to, marketplace, fulfillment_type
                      └─ Backend: dashboard.py → get_xxx()
                           └─ RPC: rpc_function(p_date_from, p_date_to, ...)
                                └─ Tables: mp_sales, mp_costs, ...
```

## Формулы

```
variable = expression   -- описание
```

Ссылка: CLAUDE.md секция "Формулы"

## Вычисления на фронтенде

[Что вычисляет DashboardPage/оркестратор перед передачей в props.
IIFE vs useMemo, какие строки, какие промежуточные переменные.]

## Backend логика

[Описание endpoint: валидация, запросы к БД, трансформации, feature gates.]

## Состояние и кэширование

- **Zustand:** useFiltersStore (datePreset, marketplace, fulfillmentType)
- **React Query key:** `['dashboard', 'xxx', ...]`
- **staleTime / refetchInterval:** 5min / 5min
- **enabled:** `Boolean(condition)`

## Edge Cases

1. Данные ещё не загружены — [как обрабатывается]
2. Пустой ответ — [что показывается]
3. Ошибка API — [fallback]
4. Feature gate — [какой тариф нужен]

## Зависимости

- **Зависит от:** FilterPanel (фильтры), useXxx (данные)
- **Используется в:** DashboardPage, PrintPage
- **Feature gate:** `feature_name` (Pro+) / нет

## Известные проблемы

- [ ] [Описание проблемы если есть]
