# Промпт для нового чата: Analytics Dashboard WB & Ozon

Продолжаем разработку Analytics Dashboard для WB и Ozon.

**Production:** https://analitics.bixirun.ru
**Local:** Backend http://localhost:8000, Frontend http://localhost:5173

---

## ПРОМПТ ДЛЯ КОПИРОВАНИЯ В НОВЫЙ ЧАТ:

```
Продолжаем разработку Analytics Dashboard для WB и Ozon.

**Production:** https://analitics.bixirun.ru (Beget VPS 83.222.16.15)
**Local:** Backend http://localhost:8000, Frontend http://localhost:5173

**Текущее состояние (09.02.2026):**
- Деплой завершён, сайт работает на https://analitics.bixirun.ru
- SSL настроен (Let's Encrypt, автопродление)
- DashboardPage работает, RPC оптимизация активна, mobile-first дизайн готов
- ✅ Cron: process-queue каждые 30 мин (заменил 5 отдельных cron jobs)
- ✅ UnitEconomicsPage, Excel/PDF экспорт, мобильное меню — всё готово
- ✅ **SaaS Фаза 1: Auth + RLS — DEPLOYED (08.02.2026)**
  - Supabase Auth, JWT middleware (JWKS), RLS, user_id во всех таблицах
  - Frontend: LoginPage, ProtectedRoute, auth interceptor
  - CORS ограничен, Cron с X-Cron-Secret + X-Cron-User-Id
  - Admin: exklante@gmail.com / 123456 / UUID: 17e80396-86e1-4ec8-8cb2-f727462bf20c
- ✅ **SaaS Фаза 2: Onboarding — DEPLOYED (09.02.2026)**
  - Backend: mp_user_tokens (Fernet encryption), CRUD + validate endpoints, _load_tokens fallback
  - Frontend: SettingsPage (профиль + 3 секции токенов + подсказки + авто-синхронизация)
  - ProtectedRoute: redirect на /settings если нет токенов (onboarding)
- ✅ **SaaS Фаза 3: Subscription Tiers — DEPLOYED (09.02.2026)**
  - 3 тарифа: Free / Pro (990₽) / Business (2990₽), без оплаты (admin-managed)
  - Backend: plans.py, subscription.py (Depends), feature gates на dashboard/export/sync
  - Frontend: FeatureGate (blur+lock), SubscriptionCard, бейдж тарифа в header
- ✅ **Bugfix:** Предыдущий период в плашках DashboardPage — commit 1aa095f
- ✅ **Tech Debt (09.02.2026):**
  - Удалён secret_key, добавлен extra="ignore" в Settings
  - Dynamic barcodes/ozon_sku_map из БД (миграция 009: ozon_sku column)
  - Concurrent sync protection (running-lock + cooldown) на sales/stocks/costs/ads
- ✅ **SaaS Фаза 4: Sync Queue — DEPLOYED (09.02.2026)**
  - DB-based queue (mp_sync_queue) + cron process-queue каждые 30 мин
  - Расписание по тарифам: Business каждые 6ч с 06:00, Pro +1ч, Free 2x/день
  - Ручной sync: Free:0, Pro:1/день, Business:2/день
  - POST /admin/sync/{user_id} для техподдержки
  - SyncPage: статус-панель + "Обновить сейчас" + история
- ✅ **Bugfix:** Прибыль -10К (пропорц. коррекция закупки costs-tree vs mp_sales)
- ✅ **UX:** Тултипы на плашках дашборда — пояснение расчётов прибыли и продаж, % проведённых заказов

**ГЛАВНАЯ ЗАДАЧА — SaaS-трансформация:**

```
Фаза 1: Auth + RLS ✅ DEPLOYED (08.02.2026)
Фаза 2: Onboarding ✅ DEPLOYED (09.02.2026)
Фаза 3: Subscription Tiers ✅ DEPLOYED (09.02.2026)
  ├── ✅ mp_user_subscriptions (Free/Pro/Business, admin-managed)
  ├── ✅ Backend: plans.py, subscription.py, feature gates
  └── ✅ Frontend: FeatureGate, SubscriptionCard, plan badge

Фаза 4: Sync Queue ✅ DEPLOYED (09.02.2026)
  ├── ✅ DB-based queue (mp_sync_queue) + cron каждые 30 мин
  ├── ✅ Расписание: Business 06/12/18/00, Pro +1ч, Free 08:00/20:00
  ├── ✅ Ручной sync с лимитом: Free:0, Pro:1/день, Business:2/день
  ├── ✅ Admin force sync: POST /admin/sync/{user_id}
  └── ✅ SyncPage: статус-панель + кнопка "Обновить"
```

**Фичи (следующие):**
1. 🔥 Позаказный монитор (Order Monitor) — Pro-фича, воронка заказов + непроведённые Ozon
2. Прибыль на карточках OZON/WB (MarketplaceBreakdown)
3. Возвраты + ДРР от заказов/выкупов
4. План продаж (ручной ввод)
5. Donut chart по категориям
6. Улучшить PDF экспорт (PrintPage.tsx)

---

## ✅ Деплой SaaS Фаза 2 + 3 — ВЫПОЛНЕН (09.02.2026)

- Backend: rsync 18 файлов, .env с FERNET_KEY
- Frontend: npm run build + rsync dist/
- systemctl restart analytics-api — OK
- Проверено: /api/v1/subscription/plans → 200 OK (3 тарифа)
- SQL миграции 007 + 008 применены в Supabase

---

## Деплой (03.02.2026):

**VPS Beget:**
- IP: 83.222.16.15
- Ubuntu 24.04, 1 ядро / 1 GB RAM + **2 GB swap**
- Домен: analitics.bixirun.ru (субдомен от bixirun.ru)
- SSL: Let's Encrypt (до 01.05.2026, автопродление)
- **Playwright + Chromium** установлен для PDF экспорта

**Структура на сервере:**
- `/var/www/analytics/backend` — FastAPI
- `/var/www/analytics/frontend` — React build (статика)
- `/var/www/analytics/.env` — API ключи
- systemd сервис: `analytics-api`
- Nginx: проксирует /api/ на :8000

**SSH доступ:**
```bash
ssh root@83.222.16.15
# Логи API
journalctl -u analytics-api -f
# Перезапуск
systemctl restart analytics-api
```

---

## Выполненные задачи (31.01.2026):

### ✅ 1. Ограничение календаря по датам
**Проблема:** Данные WB/Ozon за текущий день появляются только после 10:00 утра (МСК).
**Решение:** Функция `getMaxAvailableDateYmd()` в `utils.ts`:
- До 10:00 МСК → max = вчера (T-1) — сегодня недоступен
- После 10:00 МСК → max = сегодня (T-0) — день в день

### ✅ 2. Tooltips не уезжают за край экрана
**Проблема:** На мобильных правые карточки имели tooltip, уезжающий за правый край.
**Решение:** Добавлен prop `tooltipAlign="right"` в SummaryCard для правых карточек (Прибыль, Реклама, К перечисл., Δ к пред.).

### ✅ 3. Мобильное меню улучшено (02.02.2026)
**Swipe закрытие:** Touch handlers с threshold 60px — свайп вправо закрывает панель.
**Ярлычок виднее:** 16px полоска (было 12px), chevron внутри, 48px touch target, усиленная тень.
**Компактность:** Панель 240px (было 280px), уменьшены отступы, подсказка "← свайп для закрытия".

### ✅ 4. Tooltips с понятными формулами (02.02.2026)
**Было:** Техническая терминология (payout, costs-tree.total_accrued, unit-economics.purchase_costs).
**Стало:** Понятные формулы с цифрами:
- Прибыль = К перечислению − Закупка − Реклама = 2 521₽ − 1 804₽ − 0₽ = 717₽
- ДРР = Реклама / Продажи × 100%
- К перечисл. = Продажи − Удержания МП

### ✅ 5. Унифицированная система отступов (02.02.2026)
**Адаптивная шкала (вариант B):**
- Mobile: mb-4 (16px) между секциями, gap-2 (8px) между карточками
- Tablet: mb-5 (20px) между секциями, gap-3 (12px) между карточками
- Desktop: mb-6 (24px) между секциями, gap-3 (12px) между карточками

### ✅ 6. Экспорт в Excel и PDF (03.02.2026)
**Excel (6 листов):**
- Сводка: разбита по OZON/WB с итогами (Продажи, Начислено, Удержания)
- Продажи по дням, Реклама, Удержания МП, Unit-экономика, Остатки
- Зависимость: xlsx (SheetJS)

**PDF (Playwright на backend):**
- 3 страницы A4 landscape: Dashboard, Unit-экономика, Реклама
- Backend открывает `/print` страницу через Chromium
- Ждёт `data-pdf-ready="true"`, генерирует PDF
- Качество идеальное (настоящий браузер, не canvas)
- Размер: ~76 КБ, генерация ~15-20 сек

**UI:**
- Desktop: кнопки Excel/PDF после МП селектора
- Mobile: компактные кнопки-иконки (9x9) рядом с МП селектором
- Toast: loading → success/error через id replacement

---

## Текущие задачи:
- ✅ **SaaS Фаза 4: Sync queue** — DEPLOYED (09.02.2026)
- ✅ **Bugfix:** Прибыль -10К → пропорциональная коррекция закупки
- ✅ **UX:** Тултипы расчётов на дашборде
- 🔥 Позаказный монитор (Order Monitor)
- 🔄 Улучшить PDF экспорт (PrintPage.tsx) — см. раздел "Предложения по PDF"

---

## 📋 Предложения по улучшению PDF (PrintPage.tsx)

**Текущее состояние (3 страницы):**
- Страница 1: Dashboard (OZON/WB карточки + 6 метрик)
- Страница 2: Unit-экономика (таблица товаров)
- Страница 3: Реклама (почти пустая — данных мало)

**Проблемы:**
- ❌ Нет Δ% сравнения с предыдущим периодом
- ❌ Нет % выкупа как KPI
- ❌ Страница рекламы почти пустая (0.18₽ всего)
- ❌ Нет остатков на складах
- ❌ Нет сортировки товаров по прибыльности

**Предложение — новая структура:**

### Страница 1 — Executive Summary
- 4 главных KPI с Δ%: Выручка, Прибыль, % выкупа, ДРР
- Карточки OZON/WB (Продажи, Начислено, Выкупы)
- Визуализация структуры расходов (текстовый bar chart)
- Нужен endpoint `getSummaryWithPrev()` для Δ%

### Страница 2 — Unit-экономика
- Топ-5 по прибыли (horizontal bars)
- Таблица товаров (сортировка по прибыли)
- Аналитические выводы ("требует внимания: Тестобустер 7% маржа")
- Средняя маржинальность, самый прибыльный товар

### Страница 3 — Остатки + Удержания (вместо пустой рекламы)
- Таблица остатков по складам (WB/OZON) со статусами OK/LOW/OOS
- Полная детализация удержаний (costs-tree)
- Реклама компактно внизу (пока данных мало)
- Нужен endpoint `getStocks()`

**Файл:** `frontend/src/pages/PrintPage.tsx`

---

## Ключевые файлы:

Frontend (Auth — Фаза 1):
- `frontend/src/lib/supabase.ts` — Supabase клиент (auth only)
- `frontend/src/store/useAuthStore.ts` — Zustand auth store (user, session, logout)
- `frontend/src/hooks/useAuth.ts` — auth listener (getSession + onAuthStateChange)
- `frontend/src/pages/LoginPage.tsx` — login/register + eye toggle
- `frontend/src/components/Shared/ProtectedRoute.tsx` — route guard
- `frontend/src/services/api.ts` — API клиент + auth interceptor (Bearer token, 401→/login)

Frontend (основные):
- `frontend/src/pages/DashboardPage.tsx` — главная страница
- `frontend/src/pages/PrintPage.tsx` — страница для PDF (3 секции A4, без UI, token из URL)
- `frontend/src/pages/UnitEconomicsPage.tsx` — unit-экономика
- `frontend/src/components/Dashboard/OzonAccrualsCard.tsx` — карточка OZON
- `frontend/src/components/Dashboard/WbAccrualsCard.tsx` — карточка WB
- `frontend/src/components/Shared/FilterPanel.tsx` — фильтры + кнопки экспорта
- `frontend/src/components/Shared/Layout.tsx` — навигация + email/logout
- `frontend/src/App.tsx` — routing с ProtectedRoute

Backend (Auth — Фаза 1):
- `backend/app/auth.py` — JWT middleware (JWKS, CurrentUser, get_current_user_or_cron)
- `backend/app/config.py` — настройки (+ sync_cron_secret)
- `backend/app/main.py` — CORS ограничен конкретными origins

Backend (Subscriptions — Фаза 3):
- `backend/app/plans.py` — PLANS dict (Free/Pro/Business лимиты и фичи)
- `backend/app/subscription.py` — get_user_subscription (Depends), require_feature factory
- `backend/app/api/v1/subscription.py` — GET/PUT /subscription, GET /subscription/plans

Frontend (Subscriptions — Фаза 3):
- `frontend/src/hooks/useSubscription.ts` — useSubscription, usePlans (React Query)
- `frontend/src/components/Shared/FeatureGate.tsx` — blur+lock для заблокированных фич
- `frontend/src/components/Settings/SubscriptionCard.tsx` — карточка тарифа + сравнение

Backend (основные):
- `backend/app/api/v1/dashboard.py` — API endpoints (auth + user_id + RPC + feature gates)
- `backend/app/api/v1/products.py` — продукты (auth + user_id)
- `backend/app/api/v1/sync.py` — синхронизация (cron/jwt auth + user_id + marketplace restriction)
- `backend/app/api/v1/sync_queue.py` — очередь sync: process-queue, manual, status (Phase 4)
- `backend/app/api/v1/admin.py` — admin force sync (Phase 4)
- `backend/app/api/v1/export.py` — PDF экспорт (auth + JWT pass-through + require_feature)
- `backend/app/services/sync_service.py` — sync с user_id (~30 мест)
- `backend/migrations/004_add_user_id.sql` — user_id + constraints
- `backend/migrations/005_rls_policies.sql` — RLS на все mp_*
- `backend/migrations/006_rpc_with_user_id.sql` — RPC с p_user_id
- `backend/migrations/008_subscriptions.sql` — mp_user_subscriptions + RLS
- `backend/migrations/010_sync_queue.sql` — mp_sync_queue + trigger column в mp_sync_log (Phase 4)

---

## ВАЖНО:

- **Production URL:** https://analitics.bixirun.ru
- **Auth:** Hybrid — service_role_key на backend, RLS как safety net, JWT через JWKS
- **Admin:** exklante@gmail.com / 123456 / UUID: 17e80396-86e1-4ec8-8cb2-f727462bf20c
- **SYNC_CRON_SECRET:** analytics-cron-s3cr3t-2026
- **Supabase anon key:** `sb_publishable_...` (НЕ JWT формат!)
- **Два проекта в одном Supabase:** auth.users общие, mp_* таблицы — только наши
- OZON/WB мэтчинг начислений уже 1-в-1 с ЛК — НЕ ЛОМАТЬ
- RPC функции в Supabase — не удалять
- DateRangePicker: `captionLayout="label"` (не dropdown!)
- Не делать git команды без явного согласия

**Локальная разработка:**
```bash
# 1. Backend (терминал 1)
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 2. Frontend (терминал 2)
cd frontend && npm run dev
```

**Первый запуск локально (установка playwright):**
```bash
cd backend
source venv/bin/activate
pip install playwright
playwright install chromium  # ~162 МБ, качает Chromium
```

**FRONTEND_URL для PDF:**
- В `.env` добавлено: `FRONTEND_URL=http://localhost:5173`
- На сервере используется дефолт: `https://analitics.bixirun.ru`
- PDF экспорт открывает эту страницу через Playwright

**Деплой изменений:**
```bash
# Frontend
cd frontend && npm run build
sshpass -p 'PASSWORD' rsync -avz --delete dist/ root@83.222.16.15:/var/www/analytics/frontend/

# Backend
sshpass -p 'PASSWORD' rsync -avz --exclude 'venv' --exclude '__pycache__' backend/ root@83.222.16.15:/var/www/analytics/backend/
ssh root@83.222.16.15 "systemctl restart analytics-api"
```

Документация: CLAUDE.md, frontend/README.md, backend/README.md
```

---

## Прошлые ошибки (не повторять):

1. `deferredEnabled` — создавал каскадные ре-рендеры
2. `useInView` с `rootMargin` — не триггерился для далёких элементов
3. Дублирование запросов — каждая AccrualsCard делала свой useCostsTree
4. `include_children: false` — возвращал пустое дерево
5. react-day-picker v8 classNames в v9 — day_selected → selected
6. `grid-cols-1 sm:grid-cols-2` — карточки стекались на mobile
7. `captionLayout="dropdown"` — синхронизировал год между месяцами
8. **SYNC_TOKEN блокировал запросы** — убран токен
9. **RPC не созданы в Supabase** — выполнить 003_all_rpc_functions.sql
10. **config.py env_file="../.env"** — .env должен лежать в родительской папке от backend
11. **НЕ использовать `useCostsTreeCombined`** — архитектурное решение: отдельные параллельные запросы лучше для масштабирования
12. **toast.dismiss() + toast.success()** — использовать `id: loadingToastId` для замены toast вместо dismiss + new
13. **html2canvas для PDF** — заменён на Playwright (качество несопоставимо лучше)

---

## Архитектурные решения (не менять):

- **Costs-tree запросы:** отдельные параллельные запросы для каждого МП (не combined)
  - Причины: progressive rendering, изоляция ошибок, масштабируемость на 3+ МП
  - `useCostsTreeCombined` существует, но НЕ активирован — это намеренно

---

## Технологии:

- **Frontend:** React 19.2, TypeScript 5.9, Vite 7.2, Tailwind CSS 3.4
- **Calendar:** react-day-picker 9.x + date-fns 4.x
- **State:** React Query 5.90, Zustand 5.0
- **Backend:** FastAPI, Supabase (PostgreSQL + RPC), Playwright (PDF)
- **Hosting:** Beget VPS (Ubuntu 24.04, 2GB swap) + Supabase + Let's Encrypt SSL
