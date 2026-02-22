# Analytics Dashboard

SaaS-платформа аналитики для продавцов на маркетплейсах Wildberries и Ozon.
Автоматическая синхронизация данных, расчет прибыли, юнит-экономика, рекламная аналитика, планирование продаж и PDF-отчеты.

**Production:** [https://reviomp.ru](https://reviomp.ru)

---

## Quick Start

### Требования

- Python 3.14+, Node.js 20+
- Supabase-проект (PostgreSQL + Auth)
- API-токены WB и/или Ozon

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Скопируйте .env.example → .env и заполните переменные
uvicorn app.main:app --reload --port 8000
```

Swagger: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # Dev-сервер: http://localhost:5173
npm run build        # Проверка компиляции (обязательно перед коммитом)
```

### 3. База данных

Выполните SQL-миграции из `supabase/migrations/` и `backend/migrations/` в Supabase SQL Editor в порядке нумерации.

---

## Стек технологий

| Слой | Технологии | Версия |
|------|-----------|--------|
| **Frontend** | React + TypeScript + Vite | 19.2 + 5.9 + 7.2 |
| **Стили** | Tailwind CSS | 3.x |
| **State** | React Query + Zustand | 5.90 + 5.0 |
| **Backend** | Python + FastAPI | 3.14 + latest |
| **БД** | Supabase (PostgreSQL + RLS) | Cloud |
| **Auth** | JWT (JWKS) + Supabase Auth | ES256/HS256 |
| **Шифрование** | Fernet (cryptography) | symmetric |
| **Платежи** | YooKassa | ShopID 1273909 |
| **PDF** | Playwright (Chromium) | backend-side |
| **Графики** | Recharts (lazy-loaded) | 2.x |
| **Инфра** | Ubuntu 24.04, Nginx, systemd, Let's Encrypt | VPS Beget |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  React 19 + TS + Vite + Tailwind 3                          │
│  React Query (server state) + Zustand (UI state)            │
│  Pages: Dashboard | UE | Ads | Orders | Settings | Print    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (axios, Bearer JWT)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Backend                             │
│  /api/v1/*  (40+ endpoints)                                  │
│  Auth (JWKS) · Subscriptions · Feature Gates                 │
│  SyncService · PDF Export (Playwright)                       │
└────────┬──────────────────┬─────────────────────────────────┘
         │                  │
         ▼                  ▼
┌────────────────┐  ┌──────────────────────────────────────────┐
│   Supabase     │  │         Marketplace APIs                  │
│  PostgreSQL    │  │  ┌──────────┐  ┌──────────────────────┐  │
│  15 таблиц     │  │  │ WB API   │  │ Ozon Seller/Perf API │  │
│  4 RPC         │  │  │ Content  │  │ Products, Finance    │  │
│  RLS policies  │  │  │ Stats    │  │ Analytics, Stocks    │  │
│  19 миграций   │  │  │ Finance  │  │ Performance (OAuth)  │  │
│                │  │  │ Ads      │  │                      │  │
│  Auth service  │  │  └──────────┘  └──────────────────────┘  │
└────────────────┘  └──────────────────────────────────────────┘
```

**Синхронизация:** DB queue + cron каждые 30 мин. Данные WB/Ozon API --> Supabase --> Dashboard.

---

## Основные фичи

- **Dashboard** -- сводка метрик (заказы, выкупы, прибыль, удержания, реклама), период-comparison, 8 карточек + 4 графика
- **Юнит-экономика** -- прибыль по каждому товару, ДРР, прогноз остатков, план продаж
- **Реклама** -- KPI-карточки, таблица кампаний, графики расходов, ежедневная детализация
- **Мониторинг заказов** -- воронка (v1) + позаказная детализация (v2)
- **План продаж** -- 3 уровня (total / по МП / по товарам), трекинг выполнения
- **Остатки** -- таблица с поиском/сортировкой, прогноз запаса в днях, история остатков (line chart)
- **Начисления** -- дерево удержаний WB/Ozon (как в ЛК), каскад прибыли (waterfall)
- **PDF-экспорт** -- 3 страницы A4 через Playwright (backend rendering)
- **Excel-экспорт** -- 6 листов (сводка, продажи, реклама, удержания, UE, остатки)
- **Настройки** -- 5 табов: Подключения, Товары, План продаж, Тариф, Профиль
- **Подписки** -- Free / Pro / Business, feature gates, YooKassa оплата
- **Управление товарами** -- drag&drop сортировка, группы, закупочные цены

---

## Структура проекта

```
Analitics/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/v1/             # Роутеры: dashboard, sync, products, export, tokens, ...
│   │   ├── services/           # SyncService, WB/Ozon клиенты, PaymentService
│   │   ├── db/                 # Supabase connection
│   │   ├── auth.py             # JWT middleware (JWKS + cron auth)
│   │   ├── crypto.py           # Fernet encrypt/decrypt
│   │   ├── plans.py            # Конфигурация тарифов
│   │   ├── subscription.py     # Feature gate dependencies
│   │   └── main.py             # FastAPI app entry point
│   ├── migrations/             # SQL-миграции (001-019)
│   ├── scripts/                # Утилиты (reconstruct_stock_history.py)
│   └── requirements.txt
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/      # 19 компонентов (SummaryCard, Charts, Tables, ...)
│   │   │   ├── Settings/       # 13 компонентов (Tabs, SalesPlanEditor, ...)
│   │   │   ├── Ads/            # 5 компонентов (KPI, Campaign table, Charts)
│   │   │   ├── UnitEconomics/  # 10 компонентов (Table, KPI, Waterfall, Plan)
│   │   │   ├── Print/          # 17 компонентов (PDF-страницы A4)
│   │   │   └── Shared/         # 7 компонентов (Layout, FeatureGate, DatePicker, ...)
│   │   ├── hooks/              # 11 React Query / utility hooks
│   │   ├── pages/              # 10 страниц (Dashboard, UE, Ads, Orders, Settings, ...)
│   │   ├── services/api.ts     # Axios + auth interceptor
│   │   ├── store/              # Zustand stores (Filters, Auth)
│   │   ├── types/index.ts      # TypeScript типы
│   │   └── lib/                # utils, supabase client, Excel export
│   ├── public/
│   └── package.json
│
├── supabase/                   # Supabase конфигурация
│   └── migrations/             # RLS + RPC миграции
│
├── docs/                       # Документация проекта
│   ├── README.md               # Оглавление документации
│   ├── phases-history.md       # История всех фаз разработки
│   ├── auth-flow.md            # CJM авторизации
│   ├── product-management.md   # Управление товарами
│   ├── yookassa-integration.md # Платежная интеграция
│   ├── sales-plan-cjm.md       # CJM плана продаж
│   └── ...
│
├── wb/                         # WB утилиты (reconcile, CSV)
├── ozon/                       # Ozon утилиты (reconcile, CSV)
├── memory/                     # Claude Code memory files
├── .claude/                    # Claude Code config + rules
├── CLAUDE.md                   # Главный контекст проекта (архитектурные решения)
└── CHANGELOG.md                # Полная история изменений
```

---

## Документация

Полный индекс документации: **[docs/README.md](docs/README.md)**

| Документ | Описание |
|----------|----------|
| [docs/phases-history.md](docs/phases-history.md) | Подробная история всех фаз разработки |
| [docs/auth-flow.md](docs/auth-flow.md) | CJM авторизации (signup, login, reset, delete) |
| [docs/product-management.md](docs/product-management.md) | Управление товарами (drag&drop, группы, CC) |
| [docs/yookassa-integration.md](docs/yookassa-integration.md) | YooKassa API + webhook интеграция |
| [docs/sales-plan-cjm.md](docs/sales-plan-cjm.md) | CJM плана продаж (3 уровня) |
| [docs/email-templates.md](docs/email-templates.md) | Email-шаблоны Supabase Auth |
| [backend/README.md](backend/README.md) | API endpoints, БД-схема, auth, деплой |
| [frontend/README.md](frontend/README.md) | Компоненты, hooks, pages, дизайн |
| [CLAUDE.md](CLAUDE.md) | Архитектурные решения (30 правил) + формулы |
| [CHANGELOG.md](CHANGELOG.md) | Полная история изменений |
| [.claude/rules/coding-standards.md](.claude/rules/coding-standards.md) | Стандарты кода (React, FastAPI, Tailwind) |

---

## Деплой

**Production:** VPS Beget (Ubuntu 24.04), systemd service `analytics-api`, Nginx reverse proxy, Let's Encrypt SSL.

```bash
# Backend (systemd)
scp -r backend/ root@server:/var/www/analytics/backend/
ssh root@server "systemctl restart analytics-api"

# Frontend (static build)
cd frontend && npm run build
scp -r dist/ root@server:/var/www/analytics/frontend/dist/
```

Подробнее: [backend/README.md](backend/README.md) (раздел "Деплой").

---

## Contributing

### Правила разработки

1. Прочитайте [.claude/rules/coding-standards.md](.claude/rules/coding-standards.md) -- обязательные стандарты кода
2. Ознакомьтесь с архитектурными решениями в [CLAUDE.md](CLAUDE.md) (30 правил, которые нельзя нарушать)
3. Перед коммитом: `cd frontend && npm run build` -- проверка компиляции

### Ключевые принципы

- **Server state** через React Query, **UI state** через Zustand (не useState для API-данных)
- **Tailwind v3** (не v4) -- mobile-first responsive дизайн
- **Никаких `any` типов** в TypeScript -- только явные интерфейсы
- **Все API-вызовы** с `user_id` -- RLS как safety net, не основная защита
- **Формулы прибыли** -- критичные, см. раздел "Формулы" в CLAUDE.md
- Числа через `formatCurrency()` / `formatPercent()`, не `.toFixed(2)`

### Именование файлов

| Тип | Формат | Пример |
|-----|--------|--------|
| Компоненты | PascalCase.tsx | `SummaryCard.tsx` |
| Страницы | PascalCase.tsx | `DashboardPage.tsx` |
| Hooks | camelCase.ts | `useDashboard.ts` |
| Сервисы | camelCase.ts | `api.ts` |
| Backend | snake_case.py | `sync_service.py` |
| Миграции | NNN_description.sql | `017_stock_snapshots.sql` |

---

## Лицензия

**Proprietary.** Все права защищены. Код является закрытой собственностью и не подлежит распространению, копированию или использованию без письменного разрешения правообладателя.
