Never run "npm run dev"
Use "npm run build" to check if code compiles or no. See results and fix code if it's needed

# Analytics Dashboard - Marketplace WB & Ozon

Интерактивный дашборд для аналитики продаж на Wildberries и Ozon.
5 SKU (витамины/БАДы), SaaS-архитектура с per-user auth и токенами.

## Production: https://analitics.bixirun.ru

| Параметр | Значение |
|----------|----------|
| VPS | Beget 83.222.16.15, Ubuntu 24.04, 1 ядро / 1 GB RAM + 2 GB swap |
| SSH | `ssh root@83.222.16.15` / пароль: `@vnDBp5VCt2+` (с @ в начале!) |
| Структура | `/var/www/analytics/` (backend + frontend + .env) |
| Сервисы | systemd `analytics-api`, Nginx proxy, Let's Encrypt SSL |
| Admin | exklante@gmail.com / UUID: 17e80396-86e1-4ec8-8cb2-f727462bf20c |

```bash
# Логи / перезапуск
journalctl -u analytics-api -f
systemctl restart analytics-api

# Деплой frontend
cd frontend && npm run build
sshpass -p '@vnDBp5VCt2+' rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" dist/ root@83.222.16.15:/var/www/analytics/frontend/
```

## Текущий статус

### SaaS Phase 1: Auth + RLS — DEPLOYED (08.02.2026)
- JWT middleware (JWKS), RLS на всех таблицах, user_id во всех данных
- Cron: X-Cron-Secret + X-Cron-User-Id headers
- Подробности: [backend/README.md](backend/README.md) раздел "Auth & Security"

### SaaS Phase 2: Onboarding — DEPLOYED (09.02.2026)
- Fernet encryption, mp_user_tokens таблица, SettingsPage
- ProtectedRoute → redirect /settings если нет токенов
- Подробности: [memory/saas-phase2.md](memory/saas-phase2.md)

### SaaS Phase 3: Subscription Tiers — DEPLOYED (09.02.2026)
- 3 тарифа: Free / Pro (990₽) / Business (2990₽), без оплаты (admin-managed)
- Backend: plans.py, subscription.py (Depends), feature gates на dashboard/export/sync
- Frontend: FeatureGate (blur+lock), SubscriptionCard, plan badge в header
- Подробности: [memory/saas-phase3.md](memory/saas-phase3.md)

### SaaS Phase 4: Sync Queue — DEPLOYED (09.02.2026)
- DB-based queue (mp_sync_queue) + cron `/sync/process-queue` каждые 30 мин
- Расписание: Business 06/12/18/00 MSK, Pro +1ч, Free 08:00/20:00
- Ручной sync: Free:0, Pro:1/день, Business:2/день
- Endpoint: POST /sync/manual, GET /sync/status, POST /admin/sync/{user_id}
- SyncPage: статус-панель + кнопка "Обновить сейчас" + история
- Подробности: [memory/saas-phase4.md](memory/saas-phase4.md)

### Активные задачи
- [ ] Позаказный монитор (Order Monitor) — Pro-фича
- [ ] Прибыль на карточках OZON/WB (MarketplaceBreakdown)
- [ ] Возвраты + ДРР от заказов/выкупов
- [ ] План продаж (ручной ввод)
- [ ] Donut chart по категориям
- [ ] Улучшить PDF экспорт (PrintPage.tsx)

### Известные баги
- ~~Плашки "Пред.пер." не показывают данные~~ FIXED (commit 1aa095f)
- ~~`secret_key = "change-me-in-production"` в config.py~~ FIXED (удалён, `extra="ignore"`)
- ~~Нет concurrent sync protection на costs/stocks/ads endpoints~~ FIXED (sync guard + lock)
- ~~Ozon SKU mapping частично hardcoded в sync_service.py~~ FIXED (dynamic from DB + migration 009)
- ~~Прибыль показывает -10К из-за смешивания costs-tree и mp_sales~~ FIXED (пропорциональная коррекция закупки)

## Технический стек

- **Backend:** Python 3.14 + FastAPI + PyJWT[crypto] (JWKS)
- **Database:** Supabase (PostgreSQL + RLS + RPC)
- **Auth:** Supabase Auth (email/password) + JWT middleware
- **Frontend:** React 19.2 + TypeScript 5.9 + Vite 7.2 + Tailwind CSS 3
- **State:** React Query 5.90 + Zustand 5.0
- **Deploy:** Beget VPS + Supabase + Let's Encrypt SSL

## Локальная разработка

```bash
# Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs

# Frontend (НИКОГДА npm run dev для проверки — только npm run build)
cd frontend && npm run dev                    # http://localhost:5173

# Playwright (первый запуск)
cd backend && pip install playwright && playwright install chromium
```

**FRONTEND_URL** в `.env` = `http://localhost:5173` (для PDF экспорта локально)

## Структура проекта

```
Analitics/
├── backend/                  # FastAPI + Supabase
│   ├── app/
│   │   ├── api/v1/           # Роуты: dashboard, products, sync, export, tokens, subscription, sync_queue, admin
│   │   ├── services/         # WB/Ozon клиенты, sync_service
│   │   ├── auth.py           # JWT middleware (JWKS)
│   │   ├── crypto.py         # Fernet encrypt/decrypt (Phase 2)
│   │   ├── plans.py          # Определения тарифов Free/Pro/Business (Phase 3)
│   │   ├── subscription.py   # FastAPI Depends для подписок (Phase 3)
│   │   └── config.py         # Settings
│   └── migrations/           # SQL: 004-010 (user_id, RLS, RPC, user_tokens, subscriptions, sync_queue)
├── frontend/                 # React 19 + TS 5.9 + Vite 7 + Tailwind 3
│   └── src/
│       ├── components/       # Dashboard/, Shared/, Settings/
│       ├── hooks/            # useDashboard, useAuth, useTokens, useSubscription, useExport...
│       ├── pages/            # Dashboard, Login, Settings, UnitEconomics, Ads, Sync, Print
│       ├── services/api.ts   # Axios + auth interceptor + tokensApi + subscriptionApi
│       └── store/            # useFiltersStore, useAuthStore (Zustand)
├── CLAUDE.md                 # ← Вы здесь (компактный обзор)
├── CHANGELOG.md              # Полная история изменений
├── promt.md                  # Промпт для нового чата
└── .env                      # API ключи (НЕ коммитить!)
```

## База данных (Supabase)

Все таблицы `mp_*`, все имеют `user_id UUID NOT NULL REFERENCES auth.users(id)`:

| Таблица | Назначение |
|---------|-----------|
| mp_products | Товары + закупочные цены + WB/Ozon ID |
| mp_sales | Продажи (ежедневная агрегация) |
| mp_stocks | Остатки на складах |
| mp_costs | Удержания МП (агрегация) |
| mp_costs_details | Гранулярные удержания (tree-view) |
| mp_sales_geo | География продаж |
| mp_ad_costs | Рекламные расходы |
| mp_sync_log | Логи синхронизации |
| mp_user_tokens | Зашифрованные API-токены пользователей (Phase 2) |
| mp_user_subscriptions | Подписки пользователей: plan, status, expires_at (Phase 3) |
| mp_sync_queue | Очередь автосинхронизации: next_sync_at, priority, manual_syncs (Phase 4) |

- **RLS:** Все таблицы, политики `auth.uid() = user_id`
- **RPC:** 4 функции с `p_user_id` (get_dashboard_summary, get_costs_tree, get_costs_tree_combined, get_dashboard_summary_with_prev)
- **UNIQUE:** Все constraints включают `user_id`
- **Два проекта в одном Supabase:** auth.users общие, mp_* таблицы — только наши

## .env ключи

```
WB_API_TOKEN                          # Wildberries API
OZON_CLIENT_ID, OZON_API_KEY          # Ozon Seller API
OZON_PERFORMANCE_CLIENT_ID/SECRET     # Ozon Performance (реклама)
SUPABASE_URL, SUPABASE_ANON_KEY       # Supabase (anon key: sb_publishable_... НЕ JWT!)
SUPABASE_SERVICE_ROLE_KEY             # Backend service role
SYNC_CRON_SECRET                      # Cron auth (analytics-cron-s3cr3t-2026)
FERNET_KEY                            # Шифрование токенов (Phase 2)
FRONTEND_URL                          # Для Playwright PDF (http://localhost:5173)
```

## Товары (5 SKU)

| Штрихкод | Название | Закупка | WB nmID | Ozon product_id |
|----------|----------|---------|---------|-----------------|
| 4670157464824 | Магний + В6 хелат 800 мг | 280 | 254327396 | 1144779512 |
| 4670157464831 | Магний цитрат 800 мг | 250 | 254299021 | 1144795275 |
| 4670157464848 | L-карнитин 720 мг | 360 | 254278127 | 1145915272 |
| 4670157464770 | Витамин D3 + К2 260 мг | 280 | 254281289 | 1145845755 |
| 4670227414995 | Тестобустер | 404 | 260909523 | 1183426642 |

Плюс системный товар `WB_ACCOUNT` (для строк WB без привязки к конкретному товару).

## Архитектурные решения (НЕ МЕНЯТЬ)

1. **Costs-tree:** отдельные параллельные запросы per marketplace (НЕ combined). Progressive rendering + изоляция ошибок важнее 50-100ms экономии.
2. **AccrualsCards:** данные через props из DashboardPage (НЕ свои запросы).
3. **DateRangePicker:** `captionLayout="label"` (НЕ dropdown — баг синхронизации года).
4. **Tailwind v3** (НЕ v4 — нестабильна).
5. **PDF:** Playwright на backend (НЕ html2canvas).
6. **Auth:** Hybrid — service_role_key на backend, RLS как safety net, JWT через JWKS.
7. **Шифрование токенов:** Fernet на backend (НЕ pgcrypto/Vault).
8. **Подписки:** планы в коде (plans.py), НЕ в БД. Lazy creation free плана.
9. **Sync Queue:** DB-based queue + cron (НЕ APScheduler/Celery — 1 ядро VPS).
10. **Прибыль:** пропорциональная коррекция закупки при использовании costs-tree (Ozon analytics ≠ finance API).

## Важные нюансы

### Источники данных
- `mp_sales.revenue` — все заказы (включая непроведённые)
- `mp_costs_details."Продажи"` — финализированные выкупы из финотчёта (как в ЛК)
- Верхняя плашка "Продажи" берёт из costs-tree, НЕ из summary

### WB Stocks
- `dateFrom` должен быть максимально ранним (2019-06-20) — иначе WB вернёт только изменения
- Маппинг: сначала по `barcode`, fallback по `nmId`
- Подробности в [backend/README.md](backend/README.md)

### Cron автосинхронизация (Phase 4)
- `*/30 * * * *` → POST /sync/process-queue (обрабатывает всех пользователей по очереди)
- Headers: X-Cron-Secret (без X-Cron-User-Id — обрабатывает всех)
- Приоритет: Business(0) → Pro(1) → Free(2)

### Формулы
- **Продажи:** из costs-tree (финансовый отчёт МП, проведённые заказы)
- **Прибыль:** Выплата − Закупка(скорр.) − Реклама. Закупка масштабируется пропорционально: `purchase × (costs_tree_revenue / mp_sales_revenue)` если Ozon ещё не провёл все заказы
- **Процент возвратов:** `returns / (sales + returns) * 100%`
- **ДРР:** Ads API / Выручка

### Тултипы на плашках дашборда
- "Продажи": пояснение что данные из финотчёта МП + % проведённых заказов (если < 100%)
- "Прибыль": формула со скорректированной закупкой + пояснение про непроведённые (7-14 дней Ozon)
- Показываются только при `costsTreeRatio < 1` (когда есть расхождение mp_sales vs costs-tree)

## Roadmap

### SaaS (завершено)
1. ~~Phase 1: Auth+RLS~~ — DEPLOYED (08.02.2026)
2. ~~Phase 2: Onboarding~~ — DEPLOYED (09.02.2026)
3. ~~Phase 3: Subscription tiers~~ — DEPLOYED (09.02.2026)
4. ~~Phase 4: Sync queue~~ — DEPLOYED (09.02.2026)

### Фичи (следующие)
5. Позаказный монитор (Order Monitor) — Pro-фича, отображение воронки заказов
6. Прибыль на карточках OZON/WB
7. Возвраты + ДРР от заказов/выкупов
8. План продаж (ручной ввод)
9. Donut chart по категориям
10. Улучшить PDF экспорт

## Документация

| Файл | Содержимое |
|------|-----------|
| [backend/README.md](backend/README.md) | API endpoints, схема БД, auth, sync, .env |
| [frontend/README.md](frontend/README.md) | Компоненты, hooks, pages, mobile-first, export |
| [CHANGELOG.md](CHANGELOG.md) | Полная история всех изменений |
| [promt.md](promt.md) | Промпт для нового чата + чеклист деплоя |
| [frontend/DESIGN_REFERENCE.md](frontend/DESIGN_REFERENCE.md) | Гайд по дизайну (цвета, шрифты, spacing) |
| [memory/](memory/) | Session memory (saas-phase1.md, saas-phase2.md, saas-phase3.md, saas-phase4.md) |
