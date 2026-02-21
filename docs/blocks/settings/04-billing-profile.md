# Billing + Profile (BillingTab, ProfileTab)

> Управление подпиской (тарифы Free/Pro/Business, оплата YooKassa, автопродление) и профилем пользователя (email, выход, удаление аккаунта).

**Правила CLAUDE.md:** #8

## Визуальная структура

```
BillingTab
+------------------------------------------------------------+
|  Тариф и подписка                                          |
|  +------------------------------------------------------+  |
|  |  [Pro badge]  Активен          SKU: 5 / 20           |  |
|  |  [========-----] progress bar                        |  |
|  |                                                      |  |
|  |  [v] Сравнить тарифы                                 |  |
|  |  +------------------------------------------------+  |  |
|  |  |          | Free       | Pro          |          |  |  |
|  |  | Макс SKU | 3          | 20           |          |  |  |
|  |  | МП       | WB         | WB + OZON    |          |  |  |
|  |  | Синхра   | 2 раза/день| каждые 6ч    |          |  |  |
|  |  | UE       | x          | v            |          |  |  |
|  |  | Реклама  | x          | v            |          |  |  |
|  |  | ...      | ...        | ...          |          |  |  |
|  |  +------------------------------------------------+  |  |
|  |                                                      |  |
|  |  [Free plan]:                                        |  |
|  |  [CreditCard] Подключить Pro -- 990 Р/мес            |  |
|  |                                                      |  |
|  |  [Pro/Business plan]:                                |  |
|  |  [v] Тариф Pro активен                               |  |
|  |  [XOctagon] Отменить автопродление                   |  |
|  |  -- или --                                           |  |
|  |  [!] Автопродление отключено -- активен до DD.MM.YY  |  |
|  |  [RefreshCw] Включить автопродление                  |  |
|  +------------------------------------------------------+  |
+------------------------------------------------------------+

ProfileTab
+------------------------------------------------------------+
|  Профиль                                                   |
|  +------------------------------------------------------+  |
|  |  user@email.com                   [LogOut] Выйти     |  |
|  |  Email аккаунта                                      |  |
|  +------------------------------------------------------+  |
|                                                            |
|  Удаление аккаунта                                         |
|  +------------------------------------------------------+  |
|  |  [Trash2] Удаление аккаунта                          |  |
|  |  Все ваши данные, токены, подписка и история          |  |
|  |  синхронизации будут удалены безвозвратно.            |  |
|  |                                                      |  |
|  |  [Удалить аккаунт]                                   |  |
|  |  -- после клика --                                   |  |
|  |  Введите УДАЛИТЬ: [____________]                     |  |
|  |  [Отмена]  [Удалить навсегда]                        |  |
|  +------------------------------------------------------+  |
+------------------------------------------------------------+
```

## Файлы

| Компонент | Путь | Props / Export |
|-----------|------|----------------|
| BillingTab | `frontend/src/components/Settings/BillingTab.tsx` | Без props |
| SubscriptionCard | `frontend/src/components/Settings/SubscriptionCard.tsx` | Без props (self-contained) |
| ProfileTab | `frontend/src/components/Settings/ProfileTab.tsx` | Без props |
| DeleteAccountSection | `frontend/src/components/Settings/ProfileTab.tsx` (строки 13-98) | `{ onDeleted: () => void }` |
| useSubscription, usePlans, useUpgrade, useCancelSubscription, useEnableAutoRenew | `frontend/src/hooks/useSubscription.ts` | 5 хуков |
| subscriptionApi | `frontend/src/services/api.ts` (строки 413-422) | getMy, getPlans |
| paymentApi | `frontend/src/services/api.ts` (строки 427-438) | upgrade, cancel, enableAutoRenew |
| accountApi | `frontend/src/services/api.ts` (строки 534-539) | deleteAccount |
| Plans definition | `backend/app/plans.py` | PLANS dict, get_plan(), has_feature() |
| Subscription endpoints | `backend/app/api/v1/subscription.py` | 3 endpoints |
| Payment endpoints | `backend/app/api/v1/payment.py` | 4 endpoints |
| Account endpoints | `backend/app/api/v1/account.py` | 1 endpoint |

## Data Flow

### Получение текущей подписки

```
SubscriptionCard (sub.plan, sub.plan_name, sub.limits, sub.features)
  └─ useSubscription()
       queryKey: ['subscription']
       staleTime: 10min
       └─ subscriptionApi.getMy()
            └─ GET /api/v1/subscription
                 └─ Backend: subscription.py → get_my_subscription() (строки 23-54)
                      └─ Depends: get_user_subscription() (из subscription.py service)
                           └─ Table: mp_user_subscriptions → plan, status, auto_renew, expires_at
                      └─ Table: mp_products (count SKU, exclude WB_ACCOUNT)
                      └─ Returns: plan, status, plan_name, auto_renew, expires_at, limits{}, features{}
```

### Список тарифов для сравнения

```
SubscriptionCard (plansData.plans[])
  └─ usePlans()
       queryKey: ['subscription', 'plans']
       staleTime: 1 hour (статичные данные)
       └─ subscriptionApi.getPlans()
            └─ GET /api/v1/subscription/plans
                 └─ Backend: subscription.py → list_plans() (строки 57-76)
                      └─ Iterates PLANS dict from plans.py
                      └─ Filters: visible=False excluded (Business hidden)
                      └─ Returns: plans[] with id, name, price_rub, max_sku, features{}
```

### Upgrade (оплата через YooKassa)

```
SubscriptionCard → handleUpgrade('pro')
  └─ useUpgrade()
       └─ paymentApi.upgrade('pro')
            └─ POST /api/v1/subscription/upgrade { plan: 'pro' }
                 └─ Backend: payment.py → upgrade_subscription() (строки 35-86)
                      1. Validate plan exists in PLANS and price > 0
                      2. Check user not already on this plan
                      3. create_payment(user_id, plan) → YooKassa API
                      4. INSERT mp_payments { status: 'pending', yookassa_payment_id }
                      5. Return { confirmation_url }

  Frontend redirect:
    window.location.href = result.confirmation_url  → YooKassa payment page

  After payment → redirect to /settings?tab=billing&payment=success|fail
    └─ BillingTab useEffect (строки 15-30):
         payment=success → toast.success() + invalidate ['subscription']
         payment=fail → toast.error()
         Remove ?payment param via setSearchParams
```

### YooKassa Webhook

```
YooKassa → POST /api/v1/subscription/webhook
  └─ Backend: payment.py → payment_webhook() (строки 91-160)
       1. Verify IP (verify_webhook_ip) — без JWT auth
       2. Parse event: payment.succeeded / payment.canceled
       3. Find mp_payments by yookassa_payment_id
       4. Idempotency check: skip if status != 'pending'
       5. Double verify: get_payment() от YooKassa API

  payment.succeeded → _handle_payment_succeeded() (строки 163-210):
       1. UPDATE mp_payments { status: 'succeeded', payment_method_id }
       2. UPSERT mp_user_subscriptions { plan, status: 'active', expires_at: +30d, auto_renew: true }
       3. UPSERT mp_sync_queue { priority, next_sync_at }

  payment.canceled → _handle_payment_canceled() (строки 213-220):
       1. UPDATE mp_payments { status: 'canceled' }
```

### Отмена / включение автопродления

```
SubscriptionCard → handleCancel()
  └─ useCancelSubscription()
       └─ paymentApi.cancel()
            └─ POST /api/v1/subscription/cancel
                 └─ Backend: payment.py → cancel_auto_renewal() (строки 225-249)
                      └─ UPDATE mp_user_subscriptions SET auto_renew=false
       onSuccess: invalidate ['subscription']

SubscriptionCard → handleEnableAutoRenew()
  └─ useEnableAutoRenew()
       └─ paymentApi.enableAutoRenew()
            └─ POST /api/v1/subscription/enable-auto-renew
                 └─ Backend: payment.py → enable_auto_renewal() (строки 254-278)
                      └─ UPDATE mp_user_subscriptions SET auto_renew=true
       onSuccess: invalidate ['subscription']
```

### Удаление аккаунта

```
ProfileTab → DeleteAccountSection → handleDelete()
  └─ accountApi.deleteAccount()
       └─ DELETE /api/v1/account
            └─ Backend: account.py → delete_account() (строки 35-74)
                 1. DELETE FROM tables в порядке FK constraints:
                    mp_payments → mp_sync_queue → mp_sync_log → mp_orders →
                    mp_ad_costs → mp_sales_geo → mp_costs_details → mp_costs →
                    mp_stocks → mp_sales → mp_products → mp_user_subscriptions →
                    mp_user_tokens
                 2. DELETE auth user через Supabase Admin API:
                    DELETE {supabase_url}/auth/v1/admin/users/{user_id}
                    Headers: service_role_key
                 3. Return { status: 'deleted' }

  Frontend: toast.success() → logout() → navigate('/login')
```

## Тарифные планы (правило #8: определены в коде, НЕ в БД)

**Файл:** `backend/app/plans.py` (119 строк)

| Параметр | Free | Pro | Business (скрыт) |
|----------|------|-----|-------------------|
| Цена | 0 ₽ | 990 ₽/мес | 2990 ₽/мес |
| Макс SKU | 3 | 20 | Unlimited |
| Маркетплейсы | WB | WB + Ozon | WB + Ozon |
| Авто-синхра | 2 раза/день | Каждые 6ч | Каждые 2ч |
| Ручные обновления | 0/день | 1/день | 2/день |
| Sync priority | 2 (низкий) | 1 (средний) | 0 (высокий) |
| visible | true | true | **false** |

### Features per plan

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| dashboard | yes | yes | yes |
| costs_tree_basic | yes | yes | yes |
| costs_tree_details | no | yes | yes |
| unit_economics | no | yes | yes |
| ads_page | no | yes | yes |
| pdf_export | no | yes | yes |
| period_comparison | no | yes | yes |
| order_monitor | no | no | yes |
| api_access | no | no | yes |
| fbs_analytics | no | yes | yes |

### Sync schedule (UTC → MSK)

- **Free:** `[5, 17]` UTC → 08:00, 20:00 MSK
- **Pro:** `[4, 10, 16, 22]` UTC → 07:00, 13:00, 19:00, 01:00 MSK
- **Business:** `[3, 9, 15, 21]` UTC → 06:00, 12:00, 18:00, 00:00 MSK

### Helper-функции (plans.py)

- `get_plan(plan_name)` -- возвращает config dict, fallback на "free" (строка 81-83)
- `has_feature(plan_name, feature)` -- boolean check (строка 86-89)
- `get_next_sync_utc(plan_name, after)` -- следующее время синхронизации (строки 92-118)

## SubscriptionCard: UI логика

**Файл:** `frontend/src/components/Settings/SubscriptionCard.tsx` (289 строк)

### Состояния отображения

1. **Free plan:** показывает CTA кнопку "Подключить Pro -- 990 ₽/мес" (строки 220-238)
2. **Active paid plan с auto_renew=true:** зеленый badge + кнопка "Отменить автопродление" (строки 247-259)
3. **Active paid plan с auto_renew=false:** amber предупреждение "Автопродление отключено -- активен до DD.MM.YYYY" + кнопка "Включить автопродление" (строки 260-283)

### Collapsible таблица сравнения

Открывается по кнопке "Сравнить тарифы" (строки 128-217). Показывает:
- Макс SKU, Маркетплейсы, Авто-синхра, Ручные обновления
- Feature matrix (все кроме dashboard и costs_tree_basic -- они у всех есть)
- Текущий план выделен indigo цветом

### SKU usage bar

Прогресс-бар использования SKU (строки 111-126):
- `< 80%` -- indigo-500
- `>= 80%` -- amber-500
- `= 100%` -- red-500

### FEATURE_LABELS mapping

```tsx
// SubscriptionCard.tsx, строки 7-18
dashboard        → 'Дашборд'
costs_tree_basic → 'Удержания (базовый)'
costs_tree_details → 'Удержания (детализация)'
unit_economics   → 'Unit-экономика'
ads_page         → 'Реклама и ДРР'
pdf_export       → 'PDF экспорт'
period_comparison → 'Сравнение периодов'
order_monitor    → 'Монитор заказов'
api_access       → 'API доступ'
fbs_analytics    → 'FBO/FBS аналитика'
```

## ProfileTab: UI логика

**Файл:** `frontend/src/components/Settings/ProfileTab.tsx` (137 строк)

### Профиль

- Email из `useAuthStore(s => s.user?.email)` (строка 105)
- Кнопка "Выйти" -- `logout()` из useAuthStore → `navigate('/login')` (строки 108-111)

### Удаление аккаунта (DeleteAccountSection)

Двухэтапное подтверждение:
1. Кнопка "Удалить аккаунт" → раскрывает форму (строки 46-53)
2. Input: пользователь вводит слово `УДАЛИТЬ` (строка 19: `canDelete = confirmText === 'УДАЛИТЬ'`)
3. Кнопка "Удалить навсегда" активна только при точном совпадении (строки 85-86)
4. После успеха: toast → logout → redirect to /login (строки 27-28)

### Удаляемые данные (backend: account.py, строки 18-32)

Порядок удаления (FK constraints):
1. `mp_payments` -- история платежей
2. `mp_sync_queue` -- очередь синхронизации
3. `mp_sync_log` -- логи синхронизации
4. `mp_orders` -- заказы
5. `mp_ad_costs` -- расходы на рекламу
6. `mp_sales_geo` -- гео продаж
7. `mp_costs_details` -- детализация удержаний
8. `mp_costs` -- удержания
9. `mp_stocks` -- остатки
10. `mp_sales` -- продажи
11. `mp_products` -- товары
12. `mp_user_subscriptions` -- подписка
13. `mp_user_tokens` -- зашифрованные API-токены

После -- удаление auth user через Supabase Admin API (`service_role_key`).

## Состояние и кэширование

- **Zustand:** `useAuthStore` (user email, logout)
- **React Query keys:**
  - `['subscription']` -- текущая подписка (staleTime: 10min)
  - `['subscription', 'plans']` -- список тарифов (staleTime: 1 hour)
- **Invalidation:**
  - Payment callback success → invalidate `['subscription']`
  - Cancel/Enable auto-renew → invalidate `['subscription']`
- **enabled:** всегда true

## Edge Cases

1. **Уже на тарифе** -- backend 400: "Вы уже на тарифе Pro" (payment.py, строка 61)
2. **Бесплатный план** -- кнопка "Отменить" не показывается, backend 400: "Нечего отменять" (payment.py, строки 240-241)
3. **Ошибка ЮКассы** -- toast.error("Ошибка создания платежа"), upgrading state сбрасывается
4. **Webhook idempotency** -- повторный webhook игнорируется если `status != 'pending'` (payment.py, строки 141-142)
5. **Webhook IP verification** -- untrusted IP → 403 (payment.py, строки 104-106)
6. **Double verify** -- webhook запрашивает статус напрямую у ЮКассы перед обновлением (payment.py, строки 146-151)
7. **Business скрыт** -- `visible: False` в plans.py (строка 57), не возвращается в list_plans
8. **Удаление аккаунта** -- ошибка удаления из одной таблицы не блокирует удаление из остальных (try/except per table, account.py строки 44-48)
9. **Payment callback URL** -- `/settings?tab=billing&payment=success` -- BillingTab убирает `?payment` param после показа toast

## Зависимости

- **Зависит от:** useAuthStore (auth), FeatureGate (нет -- billing/profile доступны всем), YooKassa API (payments)
- **Используется в:** SettingsPage (табы "Тариф" и "Профиль")
- **Feature gate:** нет -- доступно на всех тарифах
- **DB таблицы:** mp_user_subscriptions, mp_payments, mp_products (SKU count), все 13 таблиц при удалении аккаунта

## Известные проблемы

- [ ] YooKassa: на VPS стоят TEST ключи -- для боевых платежей нужно переключить на live (ShopID 1273909)
- [ ] Автоплатежи (recurring payments) требуют одобрения менеджера ЮКассы для production
- [ ] Нет UI для смены пароля -- пользователь должен использовать Supabase reset flow через email
- [ ] Business тариф скрыт (`visible: False`) до доработки Order Monitor
