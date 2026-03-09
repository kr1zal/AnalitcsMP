# Руководство по локальной разработке

> Версия: 18.02.2026 | Проект: Analytics Dashboard (https://reviomp.ru)
> Стек: Python 3.14 + FastAPI | React 19 + TypeScript 5.9 + Vite 7 + Tailwind 3 | Supabase

---

## Содержание

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Переменные окружения](#3-переменные-окружения)
4. [Структура проекта](#4-структура-проекта)
5. [Coding Standards](#5-coding-standards)
6. [Именование файлов](#6-именование-файлов)
7. [Работа с Backend](#7-работа-с-backend)
8. [Работа с Frontend](#8-работа-с-frontend)
9. [Миграции БД](#9-миграции-бд)
10. [Тестирование](#10-тестирование)
11. [Чеклист перед коммитом](#11-чеклист-перед-коммитом)
12. [Git Workflow](#12-git-workflow)
13. [Полезные команды](#13-полезные-команды)

---

## 1. Prerequisites

| Инструмент | Версия | Назначение |
|-----------|--------|-----------|
| **Python** | 3.14+ | Backend (FastAPI) |
| **Node.js** | 22+ | Frontend (Vite + React) |
| **npm** | 10+ | Менеджер пакетов frontend |
| **Git** | 2.40+ | Контроль версий |
| **Supabase** | -- | Облачная БД (PostgreSQL + Auth + RLS) |

### Дополнительно (опционально)

- **Playwright** -- для локального тестирования PDF-экспорта (установка: `playwright install chromium`)
- **curl** / **httpie** -- для ручного тестирования API

### Supabase

Для работы необходим доступ к Supabase-проекту. Варианты:

1. **Существующий проект** -- получить URL, anon key и service role key у администратора
2. **Новый проект** -- создать на [supabase.com](https://supabase.com), применить `backend/migrations/FULL_SCHEMA_NEW_PROJECT.sql`

---

## 2. Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Linux/macOS
# venv\Scripts\activate         # Windows

pip install -r requirements.txt
cp .env.example .env            # Заполнить переменные (см. раздел 3)

uvicorn app.main:app --reload --port 8000
```

Backend будет доступен на `http://localhost:8000`. Swagger UI: `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev                     # Порт 5173
```

Frontend будет доступен на `http://localhost:5173`.

> **ВАЖНО:** `npm run dev` используется ТОЛЬКО для локальной разработки (hot reload).
> Для проверки корректности кода -- ВСЕГДА `npm run build`.

---

## 3. Переменные окружения

### Backend (`.env` в корне проекта)

| Переменная | Описание | Обязательна |
|-----------|----------|:-----------:|
| `WB_API_TOKEN` | API-токен Wildberries Seller | Да |
| `OZON_CLIENT_ID` | Client ID Ozon Seller API | Да |
| `OZON_API_KEY` | API-ключ Ozon Seller API | Да |
| `OZON_PERFORMANCE_CLIENT_ID` | Client ID Ozon Performance (реклама) | Да |
| `OZON_PERFORMANCE_CLIENT_SECRET` | Secret Ozon Performance (реклама) | Да |
| `SUPABASE_URL` | URL Supabase-проекта (`https://xxx.supabase.co`) | Да |
| `SUPABASE_ANON_KEY` | Anon (public) ключ Supabase | Да |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role ключ (полный доступ, без RLS) | Да |
| `FERNET_KEY` | Ключ шифрования пользовательских токенов (Fernet) | Да |
| `SYNC_CRON_SECRET` | Секрет для cron-заданий синхронизации | Нет |
| `YOOKASSA_SHOP_ID` | ShopID YooKassa (платежи) | Нет |
| `YOOKASSA_SECRET_KEY` | Секретный ключ YooKassa | Нет |
| `FRONTEND_URL` | URL фронтенда для PDF-экспорта (по умолчанию `https://reviomp.ru`) | Нет |
| `DEBUG` | Режим отладки (`true`/`false`) | Нет |

> Для локальной разработки добавьте `FRONTEND_URL=http://localhost:5173` в `.env`.

### Frontend (`.env` в `frontend/`)

| Переменная | Описание |
|-----------|----------|
| `VITE_API_URL` | URL backend API (`http://localhost:8000` для локальной разработки) |
| `VITE_SUPABASE_URL` | URL Supabase-проекта |
| `VITE_SUPABASE_ANON_KEY` | Anon (public) ключ Supabase |

Пример `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://xpushkwswfbkdkbmghux.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 4. Структура проекта

```
Analitics/
├── backend/
│   ├── app/
│   │   ├── api/v1/           # Endpoints (dashboard, sync, products, ...)
│   │   ├── services/         # Бизнес-логика (sync_service, wb_client, ozon_client)
│   │   ├── models/           # Pydantic-модели
│   │   ├── db/               # Supabase-клиент
│   │   ├── auth.py           # JWT JWKS-аутентификация
│   │   ├── config.py         # Settings (pydantic-settings)
│   │   ├── crypto.py         # Fernet-шифрование
│   │   ├── plans.py          # Тарифные планы (hardcoded)
│   │   ├── subscription.py   # Проверка подписки, feature gate
│   │   └── main.py           # FastAPI app, CORS, роутеры
│   ├── migrations/           # SQL-миграции (001..017 + FULL_SCHEMA)
│   ├── scripts/              # Одноразовые скрипты (реконструкция данных)
│   ├── tests/                # Тесты
│   ├── test_api.py           # Legacy API-тесты
│   ├── test_sync.py          # Legacy sync-тесты
│   └── requirements.txt      # Python-зависимости
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Dashboard/    # Графики, карточки, таблицы дашборда
│       │   ├── Settings/     # Табы настроек (Подключения, Товары, План, ...)
│       │   ├── Shared/       # Переиспользуемые компоненты (Layout, DatePicker, ...)
│       │   ├── Ads/          # Страница рекламы
│       │   ├── UnitEconomics/# Юнит-экономика
│       │   ├── Print/        # PDF-экспорт
│       │   └── Sync/         # (Legacy) Синхронизация
│       ├── hooks/            # React Query хуки (useDashboard, useProducts, ...)
│       ├── pages/            # Страницы (DashboardPage, SettingsPage, ...)
│       ├── services/         # API-клиент (api.ts)
│       ├── store/            # Zustand-сторы (useAuthStore, useFiltersStore)
│       ├── types/            # TypeScript-типы (index.ts)
│       └── lib/              # Утилиты (utils.ts, supabase.ts, exportExcel.ts)
│
├── docs/                     # Документация
├── .claude/                  # Claude Code конфигурация
├── memory/                   # Контекст для AI-разработки
└── CLAUDE.md                 # Главный файл проекта (архитектурные решения)
```

Подробная архитектурная схема: [docs/architecture.md](architecture.md)

---

## 5. Coding Standards

Полный документ: [.claude/rules/coding-standards.md](../.claude/rules/coding-standards.md)

### Ключевые принципы

**React (Frontend):**

- **React Query** для серверных данных (НЕ `useState` + `useEffect` для fetch)
- **Zustand** для UI-состояния (фильтры, модалки)
- НЕТ типу `any` -- всегда явные интерфейсы
- Компоненты > 200 строк -- разбивать на подкомпоненты
- `useMemo` для тяжелых вычислений, `useCallback` для хендлеров, передаваемых в children
- `formatCurrency()` / `formatNumber()` / `formatPercent()` для чисел (из `lib/utils.ts`)
- Mobile-first подход (Tailwind v3)
- Recharts: ВСЕГДА `height={NUMBER}`, НИКОГДА `height="100%"` (вызывает warnings)

**Python (Backend):**

- ВСЕГДА `user_id` в Supabase-запросах (RLS -- страховочная сеть, а не основной фильтр)
- Feature gate через `require_feature("feature_name")` dependency
- Конкретные HTTP-ошибки (`404`, `403`), а не дженерик `500`
- Pydantic для валидации входных данных

---

## 6. Именование файлов

| Тип | Конвенция | Пример |
|-----|----------|--------|
| Component | PascalCase.tsx | `StocksTable.tsx` |
| Page | PascalCase.tsx | `DashboardPage.tsx` |
| Hook | camelCase.ts | `useDashboard.ts` |
| Service | camelCase.ts | `api.ts` |
| Store | camelCase.ts | `useFiltersStore.ts` |
| Утилиты | camelCase.ts | `utils.ts` |
| Types | index.ts | `types/index.ts` |
| Backend module | snake_case.py | `dashboard.py`, `sync_service.py` |
| Migration | NNN_description.sql | `013_product_groups.sql` |

---

## 7. Работа с Backend

### Создание нового endpoint

1. Создать файл в `backend/app/api/v1/` (или добавить в существующий):

```python
# backend/app/api/v1/my_feature.py
from fastapi import APIRouter, Depends, Query

from ...auth import CurrentUser, get_current_user
from ...db.supabase import get_supabase_client

router = APIRouter(prefix="/my-feature", tags=["my-feature"])


@router.get("/data")
async def get_data(
    date_from: str = Query(..., description="Начало периода YYYY-MM-DD"),
    date_to: str = Query(..., description="Конец периода YYYY-MM-DD"),
    current_user: CurrentUser = Depends(get_current_user),  # ОБЯЗАТЕЛЬНО
):
    supabase = get_supabase_client()
    result = (
        supabase.table("my_table")
        .select("*")
        .eq("user_id", current_user.id)  # ОБЯЗАТЕЛЬНО
        .gte("date", date_from)
        .lte("date", date_to)
        .execute()
    )
    return {"data": result.data}
```

2. Зарегистрировать роутер в `backend/app/main.py`:

```python
from .api.v1.my_feature import router as my_feature_router
app.include_router(my_feature_router, prefix="/api/v1")
```

### Добавление проверки авторизации

```python
from ...auth import CurrentUser, get_current_user

# Базовая авторизация -- JWT
current_user: CurrentUser = Depends(get_current_user)

# Авторизация + cron (для sync endpoints)
from ...auth import get_current_user_or_cron
current_user: CurrentUser = Depends(get_current_user_or_cron)
```

### Feature Gate (ограничение по тарифу)

```python
from ...subscription import UserSubscription, require_feature

@router.get("/premium-data")
async def get_premium_data(
    sub: UserSubscription = Depends(require_feature("pdf_export")),
):
    # Доступно только на Pro+ тарифе
    # sub.user_id, sub.plan, sub.plan_config доступны
    ...
```

Доступные features (определены в `plans.py`):
`dashboard`, `costs_tree_basic`, `costs_tree_details`, `unit_economics`,
`ads_page`, `pdf_export`, `period_comparison`, `order_monitor`, `api_access`

### Работа с Supabase

```python
from ...db.supabase import get_supabase_client

supabase = get_supabase_client()

# SELECT
result = supabase.table("mp_sales").select("*").eq("user_id", uid).execute()

# INSERT
supabase.table("mp_sales").insert({"user_id": uid, "date": "2026-02-18", ...}).execute()

# UPSERT (insert or update)
supabase.table("mp_products").upsert(
    {"user_id": uid, "sku": "12345", "name": "Vitamin D"},
    on_conflict="user_id,sku"
).execute()

# RPC (вызов PostgreSQL-функции)
result = supabase.rpc("get_costs_tree", {"p_user_id": uid, "p_date_from": df, "p_date_to": dt}).execute()

# DELETE
supabase.table("mp_sales_plan").delete().eq("user_id", uid).eq("month", "2026-02").execute()
```

---

## 8. Работа с Frontend

### Создание нового компонента

```tsx
// frontend/src/components/Dashboard/MyWidget.tsx

interface MyWidgetProps {
  data: MyDataType[];
  isLoading?: boolean;
}

export default function MyWidget({ data, isLoading }: MyWidgetProps) {
  // 1. Hooks (все в начале)
  const { marketplace } = useFiltersStore();

  // 2. Derived state
  const filtered = useMemo(
    () => data.filter((item) => item.marketplace === marketplace),
    [data, marketplace]
  );

  // 3. Handlers
  const handleClick = useCallback(() => {
    // ...
  }, []);

  // 4. Early returns
  if (isLoading) return <LoadingSpinner />;
  if (!data.length) return null;

  // 5. Render
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Мой виджет
      </h3>
      {/* ... */}
    </div>
  );
}
```

### Создание нового React Query хука

```tsx
// frontend/src/hooks/useMyData.ts
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';

export function useMyData(dateFrom: string, dateTo: string, enabled = true) {
  return useQuery({
    queryKey: ['my-data', dateFrom, dateTo],
    queryFn: () => dashboardApi.getMyData({ date_from: dateFrom, date_to: dateTo }),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 минут
  });
}
```

### Добавление нового типа

Все типы в `frontend/src/types/index.ts`:

```tsx
// API response (должен совпадать с backend)
export interface MyDataItem {
  id: string;
  date: string;
  value: number;
  marketplace: 'wb' | 'ozon';
}

// Frontend-only (расширенный)
export interface MyDataItemExtended extends MyDataItem {
  percentChange?: number;  // рассчитывается на клиенте
}
```

### Lazy Loading (Recharts и тяжелые компоненты)

```tsx
import { lazy, Suspense } from 'react';
import LoadingSpinner from '../Shared/LoadingSpinner';

const HeavyChart = lazy(() => import('./HeavyChart'));

export default function ChartWrapper(props: ChartProps) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HeavyChart {...props} />
    </Suspense>
  );
}
```

### Recharts: правила высоты

```tsx
// ПРАВИЛЬНО -- числовая высота + responsive через className
<ResponsiveContainer width="100%" height={300} className="sm:!h-[400px]">
  <AreaChart data={data}>
    {/* ... */}
  </AreaChart>
</ResponsiveContainer>

// НЕПРАВИЛЬНО -- вызывает width(-1)/height(-1) warnings
<ResponsiveContainer width="100%" height="100%">
```

### Форматирование чисел

```tsx
import { formatCurrency, formatNumber, formatPercent } from '../lib/utils';

// Валюта: "1 234,56 ₽"
formatCurrency(1234.56)

// Число с разделителями: "1 234"
formatNumber(1234)

// Проценты: "45.2%"
formatPercent(45.2)
formatPercent(45.2, 0)  // "45%"
```

---

## 9. Миграции БД

### Создание новой миграции

1. Определить следующий номер (текущий максимум: `017`):

```bash
ls backend/migrations/
```

2. Создать файл:

```sql
-- backend/migrations/018_my_feature.sql
-- Description: добавление таблицы для my_feature
-- Date: 2026-02-18

CREATE TABLE IF NOT EXISTS my_table (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    -- ...
);

-- RLS
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
    ON my_table FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
    ON my_table FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_my_table_user_id ON my_table(user_id);
```

### Применение миграции

Миграции применяются вручную через **Supabase SQL Editor**:

1. Открыть [Supabase Dashboard](https://supabase.com/dashboard) -> SQL Editor
2. Вставить содержимое SQL-файла
3. Выполнить
4. Проверить результат в Table Editor

> Автоматических миграций нет -- это осознанное решение для контроля и безопасности.

### Новый проект с нуля

Для полной инициализации БД:

```sql
-- Применить целиком:
backend/migrations/FULL_SCHEMA_NEW_PROJECT.sql
```

Содержит все таблицы, RPC-функции, RLS-политики и индексы.

---

## 10. Тестирование

### Frontend

```bash
cd frontend

# Проверка компиляции TypeScript + сборка
npm run build
```

> **КРИТИЧНО:** `npm run build` -- единственный способ валидации кода.
> НИКОГДА не используйте `npm run dev` для проверки -- он не ловит ошибки типов и импортов.

### Backend

```bash
cd backend
source venv/bin/activate

# Legacy тесты (базовое покрытие)
python test_api.py
python test_sync.py
```

### Ручное тестирование API

```bash
# Health check
curl http://localhost:8000/health

# С авторизацией (подставить JWT-токен из Supabase Auth)
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8000/api/v1/dashboard/summary?date_from=2026-02-01&date_to=2026-02-18"
```

### Production health check

```bash
curl -s https://reviomp.ru/health
```

---

## 11. Чеклист перед коммитом

- [ ] `npm run build` проходит без ошибок
- [ ] Нет типа `any` (только явные интерфейсы)
- [ ] Все API-вызовы включают `user_id` фильтрацию
- [ ] Числа отформатированы через `formatCurrency` / `formatNumber` / `formatPercent`
- [ ] Mobile responsive (проверить на 375px)
- [ ] Нет оставленных `console.log` в коде
- [ ] Нет хардкод-строк (используются константы)
- [ ] Архитектурные решения из `CLAUDE.md` соблюдены (30 правил)
- [ ] Tailwind v3 (не v4)
- [ ] `captionLayout="label"` для DateRangePicker (не dropdown)

---

## 12. Git Workflow

### Ветвление

- Основная ветка разработки: `analitics_main_v1`
- Production (деплой): `main`

### Коммиты

Используйте prefix в сообщениях коммитов:

| Prefix | Назначение | Пример |
|--------|-----------|--------|
| `feat:` | Новая функциональность | `feat: Stock forecast chart on dashboard` |
| `fix:` | Исправление бага | `fix: Sales plan completion inflation` |
| `docs:` | Документация | `docs: update architecture diagram` |
| `refactor:` | Рефакторинг без изменения поведения | `refactor: extract SummaryCard component` |
| `style:` | Стилевые правки (CSS, форматирование) | `style: mobile cards padding` |
| `chore:` | Рутинные задачи (deps, config) | `chore: update dependencies` |

### Деплой

Деплой выполняется ТОЛЬКО через команду `/deploy`. Не деплоить напрямую через git push.

---

## 13. Полезные команды

### Backend

```bash
# Активировать виртуальное окружение
source backend/venv/bin/activate

# Запуск dev-сервера с hot reload
uvicorn app.main:app --reload --port 8000

# Установка новой зависимости
pip install <package>
pip freeze > requirements.txt
```

### Frontend

```bash
# Проверка компиляции (ОБЯЗАТЕЛЬНО перед коммитом)
npm run build

# Локальная разработка с hot reload
npm run dev

# Установка зависимости
npm install <package>
npm install -D <package>    # dev dependency
```

### Production

```bash
# Health check
curl -s https://reviomp.ru/health

# Проверка статуса сервиса (на VPS)
ssh -i ~/.ssh/id_ed25519 -p 2222 root@83.222.16.15 "systemctl status analytics-api"

# Логи backend (на VPS)
ssh -i ~/.ssh/id_ed25519 -p 2222 root@83.222.16.15 "journalctl -u analytics-api -f --no-pager -n 100"
```

### Supabase

```bash
# Подключение к БД через pooler (для миграций и отладки)
psql "postgresql://postgres.xpushkwswfbkdkbmghux:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
```

---

## Ссылки на документацию

| Документ | Содержимое |
|---------|-----------|
| [CLAUDE.md](../CLAUDE.md) | Главный файл проекта, архитектурные решения, формулы |
| [docs/architecture.md](architecture.md) | Полная архитектурная схема |
| [docs/phases-history.md](phases-history.md) | Подробная история всех фаз разработки |
| [docs/api-reference.md](api-reference.md) | Справочник API endpoints |
| [docs/database.md](database.md) | Схема БД, таблицы, RPC-функции |
| [docs/auth-flow.md](auth-flow.md) | CJM авторизации |
| [docs/deployment.md](deployment.md) | Инструкция по деплою |
| [docs/yookassa-integration.md](yookassa-integration.md) | Интеграция с YooKassa |
| [docs/product-management.md](product-management.md) | Управление товарами |
| [.claude/rules/coding-standards.md](../.claude/rules/coding-standards.md) | Стандарты кода (полная версия) |
