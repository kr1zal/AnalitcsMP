# Подключение ЮКассы (YooKassa Payment Integration)

## Обзор

Интеграция оплаты подписки Pro (990 ₽/мес) через ЮКассу. Используется прямой API через httpx (без SDK).

| Параметр | Значение |
|----------|----------|
| ShopID | 1273909 |
| URL магазина | https://reviomp.ru/ |
| Webhook URL | https://reviomp.ru/api/v1/subscription/webhook |
| Webhook события | payment.succeeded, payment.canceled |
| API | https://api.yookassa.ru/v3 |
| Авторизация | Basic Auth (shop_id:secret_key) |

## Переменные окружения

```bash
# .env (локально и на VPS)
YOOKASSA_SHOP_ID=1273909
YOOKASSA_SECRET_KEY=live_hk6udjB2zRN7GBN-PrAipJUseeybogBbBhQctZ2Doi0
```

## Файлы

### Backend

| Файл | Назначение |
|------|-----------|
| `backend/app/config.py` | Поля `yookassa_shop_id`, `yookassa_secret_key` |
| `backend/app/services/payment_service.py` | Обёртка API ЮКассы: create_payment, get_payment, verify_webhook_ip |
| `backend/app/api/v1/payment.py` | 4 эндпоинта: /subscription/upgrade, /webhook, /cancel, /enable-auto-renew |
| `backend/app/main.py` | Подключение роутера payment |
| `backend/migrations/012_payments.sql` | Таблица mp_payments + колонки в subscriptions |

### Frontend

| Файл | Назначение |
|------|-----------|
| `frontend/src/services/api.ts` | `paymentApi.upgrade(plan)`, `paymentApi.cancel()`, `paymentApi.enableAutoRenew()` |
| `frontend/src/hooks/useSubscription.ts` | `useUpgrade()`, `useCancelSubscription()`, `useEnableAutoRenew()` хуки |
| `frontend/src/components/Settings/SubscriptionCard.tsx` | Кнопка "Подключить Pro" + toggle автопродления |
| `frontend/src/pages/SettingsPage.tsx` | Обработка `?payment=success` / `?payment=fail` |
| `frontend/src/pages/LandingPage.tsx` | CTA "Попробовать Pro" в PricingSection |

## API Endpoints

### POST /subscription/upgrade

Создаёт платёж в ЮКассе, возвращает URL для оплаты.

**Auth:** JWT Bearer
**Body:** `{ "plan": "pro" }`
**Response:** `{ "confirmation_url": "https://yoomoney.ru/checkout/..." }`

Логика:
1. Проверяет что план существует и платный
2. Проверяет что пользователь не на этом плане
3. Создаёт платёж в ЮКассе (redirect, save_payment_method=true)
4. Сохраняет запись в mp_payments (status: pending)
5. Возвращает confirmation_url → фронт редиректит пользователя

### POST /subscription/webhook

Принимает уведомления от ЮКассы.

**Auth:** Нет (проверка IP отправителя)
**Body:** JSON от ЮКассы (event + object)

Безопасность:
1. Проверка IP по whitelist ЮКассы (185.71.76.0/27, 185.71.77.0/27, 77.75.153.0/25, ...)
2. Двойная верификация: GET /v3/payments/{id} для подтверждения статуса
3. Idempotency: пропуск если платёж уже обработан

При payment.succeeded:
- Обновляет mp_payments (status=succeeded, payment_method_id)
- Обновляет mp_user_subscriptions (plan, status=active, expires_at=+30 дней)
- Обновляет mp_sync_queue (priority, next_sync)

### POST /subscription/cancel

Отменяет автопродление подписки.

**Auth:** JWT Bearer
**Response:** `{ "status": "auto_renew_disabled" }`

### POST /subscription/enable-auto-renew

Включает автопродление подписки обратно.

**Auth:** JWT Bearer
**Response:** `{ "status": "auto_renew_enabled" }`

## Путь пользователя

```
1. Нажимает "Подключить Pro" (Настройки или Landing)
2. Frontend → POST /subscription/upgrade {plan: "pro"}
3. Backend → создаёт платёж ЮКассы (990₽)
4. Backend → сохраняет в mp_payments, возвращает confirmation_url
5. Frontend → redirect на страницу оплаты ЮКассы
6. Пользователь оплачивает
7. ЮКасса → redirect на /settings?payment=success
8. ЮКасса → POST /subscription/webhook (event: payment.succeeded)
9. Backend → активирует Pro на 30 дней
10. Frontend → toast "Оплата прошла!", обновляет UI
```

## База данных

### Таблица mp_payments (миграция 012)

```sql
CREATE TABLE mp_payments (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    yookassa_payment_id TEXT UNIQUE,
    payment_method_id TEXT,       -- для рекуррентных платежей
    amount DECIMAL(10,2),
    currency TEXT DEFAULT 'RUB',
    status TEXT DEFAULT 'pending', -- pending / succeeded / canceled
    plan TEXT,                     -- pro / business
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### Новые колонки в mp_user_subscriptions

```sql
ALTER TABLE mp_user_subscriptions
ADD COLUMN payment_method_id TEXT,     -- ID сохранённого метода оплаты
ADD COLUMN auto_renew BOOLEAN DEFAULT true,
ADD COLUMN expires_at TIMESTAMPTZ;      -- когда истекает подписка
```

## Автопродление (будущее)

Автопродление требует одобрения менеджера ЮКассы для production. Код готов:

- `payment_service.create_auto_payment()` — платёж без подтверждения пользователя
- Нужен cron: проверять `expires_at < now() + 1 day AND auto_renew = true`
- При успешной оплате → продлить expires_at на 30 дней

## Деплой

> **Миграция 012 уже применена.** Таблица `mp_payments` и колонки `payment_method_id`, `auto_renew`, `expires_at` в `mp_user_subscriptions` входят в единый файл `FULL_SCHEMA_NEW_PROJECT.sql`, который был применён при создании нового Supabase проекта (reviomp). Отдельно применять `012_payments.sql` **не нужно**.

1. ~~Применить миграцию 012 в Supabase SQL Editor~~ — уже в базе
2. Добавить YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в `/var/www/analytics/.env` на VPS
3. `systemctl restart analytics-api`
4. Задеплоить фронтенд:
   ```bash
   cd frontend && npm run build
   sshpass -p '@vnDBp5VCt2+' rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" dist/ root@83.222.16.15:/var/www/analytics/frontend/
   ```
5. Проверить webhook: создать тестовый платёж, убедиться что подписка активируется

## Тестирование

- **Тестовая карта:** 5555 5555 5555 4444, любой CVC, будущая дата
- **Тестовый режим:** использовать test_ ключ вместо live_ (можно сгенерировать в ЮКассе → Ключи API)
- **Тестовый магазин:** ShopID 1276568, ключ test_aMbAQ893Rv...

### Результаты тестирования (14.02.2026)

| Шаг | Результат |
|-----|-----------|
| POST /subscription/upgrade | 200 OK, confirmation_url получен |
| Редирект на ЮКассу | Страница оплаты открылась (карта + кошелёк ЮМани, СБП недоступно в тесте) |
| Оплата тестовой картой | Успешно |
| Webhook от ЮКассы | 200 OK (IP 77.75.153.78) |
| mp_payments.status | succeeded |
| mp_user_subscriptions.plan | pro, expires_at +30 дней |
| Редирект обратно | /settings?payment=success (после фикса FRONTEND_URL) |
| POST /subscription/cancel | auto_renew → false |

**Найденные и исправленные баги:**
- `FRONTEND_URL=http://localhost:5173` на VPS → редирект после оплаты шёл на localhost. Исправлено на `https://reviomp.ru`.

### Переключение на live

Для перехода на боевой режим:
```bash
# На VPS (/var/www/analytics/.env):
YOOKASSA_SHOP_ID=1273909
YOOKASSA_SECRET_KEY=live_hk6udjB2zRN7GBN-PrAipJUseeybogBbBhQctZ2Doi0

# Рестарт:
systemctl restart analytics-api
```
Также настроить webhook в боевом магазине ЮКассы (Интеграция → HTTP-уведомления → `https://reviomp.ru/api/v1/subscription/webhook`).
