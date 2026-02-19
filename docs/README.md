# Analytics Dashboard -- Документация

Полный индекс документации проекта. Актуальность: февраль 2026.

---

## Навигация по документации

### Проектная документация (docs/)

| Документ | Описание | Для кого |
|----------|----------|----------|
| [phases-history.md](phases-history.md) | Подробная история всех фаз разработки (SaaS 1-4, Order Monitor, Dashboard v2, Enterprise) | Все |
| [auth-flow.md](auth-flow.md) | CJM авторизации: signup, login, reset password, delete account | Backend, Frontend |
| [product-management.md](product-management.md) | Управление товарами: drag&drop, группы, закупочные цены, интерфейс | Frontend |
| [yookassa-integration.md](yookassa-integration.md) | YooKassa API: платежи, webhook, возвраты, тестовые/боевые ключи | Backend, DevOps |
| [sales-plan-cjm.md](sales-plan-cjm.md) | CJM плана продаж: 3 уровня (total/MP/product), UI, backend | Все |
| [sales-plan-enterprise-brainstorm.md](sales-plan-enterprise-brainstorm.md) | Дизайн-исследование Enterprise-версии плана продаж | Product, Frontend |
| [enterprise-settings-brainstorm.md](enterprise-settings-brainstorm.md) | Дизайн-исследование Enterprise Settings (5 табов) | Product, Frontend |
| [email-templates.md](email-templates.md) | Email-шаблоны Supabase Auth (подтверждение, сброс, magic link) | Backend, Design |

### Документация модулей

| Документ | Описание | Для кого |
|----------|----------|----------|
| [../backend/README.md](../backend/README.md) | Backend: API endpoints (40+), схема БД (15 таблиц), auth, sync, деплой | Backend |
| [../frontend/README.md](../frontend/README.md) | Frontend: компоненты, hooks, stores, типы, дизайн-система, responsive | Frontend |

### Стандарты и правила

| Документ | Описание | Для кого |
|----------|----------|----------|
| [../CLAUDE.md](../CLAUDE.md) | Главный контекст: 30 архитектурных правил, формулы, источники данных | Все |
| [../.claude/rules/coding-standards.md](../.claude/rules/coding-standards.md) | Стандарты кода: React patterns, TypeScript, API layer, Tailwind, FastAPI | Все разработчики |
| [../CHANGELOG.md](../CHANGELOG.md) | Полная история изменений (обратная хронология) | Все |

### Утилиты сверки данных

| Документ | Описание | Для кого |
|----------|----------|----------|
| [../wb/RECONCILE.md](../wb/RECONCILE.md) | Сверка WB: API vs CSV из ЛК (reconcile_wb.py) | Backend, QA |
| [../ozon/RECONCILE.md](../ozon/RECONCILE.md) | Сверка Ozon: API vs CSV из ЛК (reconcile_accruals.py) | Backend, QA |

---

## Быстрые ссылки по задачам

### "Хочу понять, как устроен проект"

1. [README.md](../README.md) -- обзор, архитектура, Quick Start
2. [CLAUDE.md](../CLAUDE.md) -- архитектурные решения и формулы
3. [phases-history.md](phases-history.md) -- история развития проекта

### "Хочу добавить новый API endpoint"

1. [backend/README.md](../backend/README.md) -- существующие endpoints и паттерны
2. [coding-standards.md](../.claude/rules/coding-standards.md) -- FastAPI patterns, error handling
3. [CLAUDE.md](../CLAUDE.md) -- правило #6 (Auth: user_id обязателен)

### "Хочу создать новый React-компонент"

1. [frontend/README.md](../frontend/README.md) -- структура компонентов, hooks, store
2. [coding-standards.md](../.claude/rules/coding-standards.md) -- React patterns, TypeScript, Tailwind
3. [CLAUDE.md](../CLAUDE.md) -- правило #4 (Tailwind v3), #17 (responsive Recharts)

### "Хочу понять формулы прибыли и удержаний"

1. [CLAUDE.md](../CLAUDE.md) -- раздел "Формулы (КРИТИЧНО)"
2. [backend/README.md](../backend/README.md) -- costs-tree API, маппинг operation_type
3. [wb/RECONCILE.md](../wb/RECONCILE.md) / [ozon/RECONCILE.md](../ozon/RECONCILE.md) -- сверка с ЛК

### "Хочу разобраться в авторизации и подписках"

1. [auth-flow.md](auth-flow.md) -- CJM авторизации, все сценарии
2. [backend/README.md](../backend/README.md) -- JWT, Fernet, RLS, feature gates, тарифы
3. [CLAUDE.md](../CLAUDE.md) -- правила #6 (Auth), #7 (Fernet), #8 (планы в коде)

### "Хочу настроить синхронизацию данных"

1. [backend/README.md](../backend/README.md) -- Sync endpoints, cron, SyncService
2. [phases-history.md](phases-history.md) -- Phase 4 (Sync Queue)
3. [CLAUDE.md](../CLAUDE.md) -- правило #9 (DB queue + cron, не Celery)

### "Хочу задеплоить проект"

1. [backend/README.md](../backend/README.md) -- раздел "Деплой"
2. [CLAUDE.md](../CLAUDE.md) -- таблица с VPS и Supabase реквизитами
3. [yookassa-integration.md](yookassa-integration.md) -- переключение test/live ключей

### "Хочу добавить поддержку нового маркетплейса"

1. [backend/README.md](../backend/README.md) -- WB/Ozon клиенты, SyncService, costs-tree маппинг
2. [CLAUDE.md](../CLAUDE.md) -- правила #1 (параллельные запросы per MP), #11-#13 (методологии MP)
3. [coding-standards.md](../.claude/rules/coding-standards.md) -- API layer pattern

### "Хочу настроить платежи"

1. [yookassa-integration.md](yookassa-integration.md) -- API, webhook, тестовые карты
2. [backend/README.md](../backend/README.md) -- PaymentService, subscription endpoints

---

## Архитектурные решения (30 правил)

Полный список -- в [CLAUDE.md](../CLAUDE.md). Краткий обзор ключевых правил:

| # | Правило | Суть |
|---|---------|------|
| 1 | Costs-tree | Отдельные параллельные запросы per marketplace (не combined) |
| 4 | Tailwind v3 | Не обновлять до v4 |
| 5 | PDF | Playwright backend (не html2canvas) |
| 6 | Auth | Hybrid: service_role_key backend + RLS safety net + JWT JWKS |
| 7 | Шифрование | Fernet backend (не pgcrypto/Vault) |
| 8 | Подписки | Планы в коде plans.py (не в БД) |
| 9 | Sync | DB queue + cron (не Celery -- 1 ядро VPS) |
| 10 | Прибыль | RAW себестоимость: `profit = payout - purchase - ads` (costsTreeRatio удалён 19.02.2026) |
| 18 | UE Profit | `profit_i = total_payout * (revenue_i / sum_revenue) - purchase_i - ad_i` (purchase RAW) |
| 19 | СПП | Credits входят в displayed_revenue. Ratio = чистые sales (без credits) |
| 22 | ProfitChart | Dual area (revenue+profit), profitMargin=netProfit/revenue |
| 23 | ProfitWaterfall | Div-based bars (не Recharts). Пропорции от revenue |
| 27 | Sales Plan | 3 уровня, приоритет: total > MP > product. Факт только за месяцы с планом |
| 28 | Dashboard Cards | Grid 4x2, ДРР merged в Рекламу, ChangeBadge для comparison |
| 29 | Settings | Unified /settings?tab= (5 табов). URL state через useSearchParams |
| 30 | Plan completion | actual только по МП с планами, взвешенное completion в footer |

---

## Схема базы данных (краткий обзор)

15 таблиц, все с `user_id` + RLS:

| Таблица | Назначение |
|---------|-----------|
| `mp_products` | Мастер-данные товаров (barcode, WB/Ozon ID, закупочная цена) |
| `mp_sales` | Ежедневная агрегация продаж (заказы, выкупы, возвраты, выручка) |
| `mp_stocks` | Остатки по складам (WB + Ozon FBO/FBS) |
| `mp_costs` | Удержания -- агрегация по 7 типам |
| `mp_costs_details` | Удержания -- гранулярная детализация для tree-view |
| `mp_ad_costs` | Рекламные расходы по кампаниям |
| `mp_orders` | Позаказная детализация (Order Monitor v2) |
| `mp_user_tokens` | Зашифрованные API-токены пользователей (Fernet) |
| `mp_user_subscriptions` | Подписки (тариф, статус, срок) |
| `mp_sync_queue` | Очередь синхронизации |
| `mp_sync_log` | Логи синхронизаций |
| `mp_sales_geo` | География продаж |
| `mp_sales_plan` | Планы продаж per-product |
| `mp_sales_plan_summary` | Планы продаж total/MP уровня |
| `mp_stock_snapshots` | Исторические снимки остатков |

4 RPC-функции: `get_dashboard_summary`, `get_costs_tree`, `get_costs_tree_combined`, `get_dashboard_summary_with_prev`.

Подробная схема: [backend/README.md](../backend/README.md) (раздел "База данных").

---

## Ключевые формулы

```
// Актуально с 19.02.2026 (costsTreeRatio удалён):
profit            = total_payout - purchase - ads
purchase          = purchase_price * sales_count  (RAW, без коэффициента)
displayed_revenue = costs_tree_sales + credits    (СПП, возмещения)

UE:     profit_i = total_payout * (revenue_i / sum(revenue)) - purchase_i - ad_i
DRR:    drr = ad_cost / revenue * 100%
Stock:  days_remaining = quantity / avg_daily_sales(30d)

Plan completion: actual ONLY for months WITH a plan
                 Priority: total > MP-sum > product-sum
```

Полные формулы: [CLAUDE.md](../CLAUDE.md) (раздел "Формулы").
