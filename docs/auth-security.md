# RevioMP -- Аутентификация и безопасность

> Полная документация по архитектуре безопасности Analytics Dashboard.
> Последнее обновление: 18.02.2026

---

## Содержание

1. [Обзор системы безопасности](#1-обзор-системы-безопасности)
2. [Аутентификация](#2-аутентификация)
3. [Авторизация (Feature Gates)](#3-авторизация-feature-gates)
4. [Подписки](#4-подписки)
5. [Платежи (YooKassa)](#5-платежи-yookassa)
6. [Шифрование](#6-шифрование)
7. [Row Level Security (RLS)](#7-row-level-security-rls)
8. [CORS](#8-cors)
9. [Customer Journey Map](#9-customer-journey-map)
10. [Рекомендации по безопасности](#10-рекомендации-по-безопасности)

---

## 1. Обзор системы безопасности

Система безопасности RevioMP реализована по принципу **defence in depth** -- семь независимых слоёв защиты, каждый из которых работает автономно. Компрометация одного слоя не приводит к полному нарушению безопасности.

```
Запрос пользователя
    |
    v
[1] Nginx SSL/TLS (Let's Encrypt, TLS 1.2+)
    |
    v
[2] CORS (whitelist origins: reviomp.ru, localhost:5173/4173)
    |
    v
[3] JWT JWKS (Supabase Auth, ES256/HS256, audience: "authenticated")
    |
    v
[4] Backend user_id filter (КАЖДЫЙ запрос к БД фильтруется по user_id)
    |
    v
[5] RLS (PostgreSQL Row Level Security: auth.uid() = user_id)
    |
    v
[6] Fernet (AES-128-CBC -- шифрование API-токенов маркетплейсов в БД)
    |
    v
[7] IP Whitelist (webhook ЮКассы -- только доверенные подсети)
```

### Принципы

| Принцип | Реализация |
|---------|-----------|
| Zero Trust | Каждый слой проверяет независимо, не полагаясь на предыдущий |
| Least Privilege | Пользователь видит только свои данные; admin_user_ids -- явный whitelist |
| Encrypt at Rest | API-токены маркетплейсов зашифрованы Fernet до записи в БД |
| Encrypt in Transit | Все соединения через HTTPS (Nginx + Let's Encrypt) |
| Fail Secure | Отсутствие токена/сессии = HTTP 401; отсутствие фичи = HTTP 403 |

### Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `backend/app/auth.py` | JWT-верификация, `get_current_user`, cron-auth |
| `backend/app/crypto.py` | Fernet encrypt/decrypt для API-токенов |
| `backend/app/subscription.py` | Загрузка подписки, `require_feature` dependency |
| `backend/app/plans.py` | Определения тарифов (Free/Pro/Business) |
| `backend/app/config.py` | Конфигурация: ключи, admin_user_ids |
| `backend/app/services/payment_service.py` | ЮКасса API + IP whitelist |
| `backend/app/api/v1/payment.py` | Эндпоинты оплаты + webhook |
| `backend/app/api/v1/account.py` | Удаление аккаунта (13 таблиц + auth) |
| `backend/app/api/v1/tokens.py` | CRUD API-токенов (Fernet-шифрование) |
| `backend/app/main.py` | CORS middleware |
| `frontend/src/store/useAuthStore.ts` | Zustand -- auth state + Supabase SDK |
| `frontend/src/components/Shared/ProtectedRoute.tsx` | Route guard (auth + onboarding) |
| `frontend/src/components/Shared/FeatureGate.tsx` | Feature gate (blur + lock overlay) |

---

## 2. Аутентификация

### 2.1. Supabase Auth

Провайдер аутентификации -- **Supabase Auth** (email/password). Поддерживаемые операции:

| Операция | Метод | Frontend вызов |
|----------|-------|---------------|
| Регистрация | `signUp` | `supabase.auth.signUp({ email, password })` |
| Вход | `signInWithPassword` | `supabase.auth.signInWithPassword({ email, password })` |
| Сброс пароля | `resetPasswordForEmail` | `supabase.auth.resetPasswordForEmail(email, { redirectTo })` |
| Обновление пароля | `updateUser` | `supabase.auth.updateUser({ password })` |
| Выход | `signOut` | `supabase.auth.signOut()` |
| Удаление аккаунта | Admin API | `DELETE /api/v1/account` (backend) |

**Конфигурация Supabase:**

| Параметр | Значение |
|----------|----------|
| Project | reviomp (xpushkwswfbkdkbmghux) |
| Site URL | `https://reviomp.ru` |
| Redirect URLs | `https://reviomp.ru/**`, `http://localhost:5173/**` |
| Email confirmation | Включена (signup требует подтверждения) |
| Password min length | 6 символов |

### 2.2. JWT-верификация (Backend)

Backend верифицирует JWT-токены через **JWKS endpoint** Supabase. Ключи кэшируются автоматически через `PyJWKClient`.

**Файл:** `backend/app/auth.py`

```python
# JWKS endpoint (кэшируется автоматически)
jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
_jwks_client = PyJWKClient(jwks_url, cache_keys=True)

# Верификация JWT
signing_key = _jwks_client.get_signing_key_from_jwt(token)
payload = jwt.decode(
    token,
    signing_key.key,
    algorithms=["ES256", "HS256"],  # ES256 (новые проекты) + HS256 (legacy)
    audience="authenticated",
)
```

**Процесс верификации:**

```
1. Request → Authorization: Bearer <JWT>
2. PyJWKClient загружает/кэширует JWKS с Supabase
3. Верификация подписи (ES256 или HS256)
4. Проверка audience = "authenticated"
5. Проверка exp (не истёк)
6. Извлечение sub (user_id) и email из payload
7. Возврат CurrentUser(id, email)
```

**Результат -- `CurrentUser` dataclass:**

```python
@dataclass
class CurrentUser:
    id: str    # UUID из sub claim
    email: str # email из JWT payload
```

**Ошибки:**

| Ситуация | HTTP код | Сообщение |
|----------|----------|-----------|
| Нет Authorization header | 401 | Authorization header required |
| JWT истёк | 401 | Token expired |
| Невалидная подпись | 401 | Invalid token: ... |
| Отсутствует sub claim | 401 | Token missing sub claim |

### 2.3. Frontend Auth State

**Файл:** `frontend/src/store/useAuthStore.ts` (Zustand)

```
useAuthStore:
  - user: User | null
  - session: Session | null
  - isLoading: boolean
  - signIn(email, password)
  - signUp(email, password)
  - signOut()
  - resetPassword(email)
  - updatePassword(password)
```

**Token lifecycle:**

| Токен | Хранение | Время жизни | Обновление |
|-------|----------|-------------|-----------|
| Access token (JWT) | In-memory (Supabase JS) | 1 час | Автоматическое (SDK) |
| Refresh token | localStorage | 7 дней | При истечении access token |

**Auto-refresh:**

```
1. Supabase JS детектирует истечение access_token (exp claim)
2. Вызов /auth/v1/token?grant_type=refresh_token
3. Получение нового access_token + refresh_token
4. Событие onAuthStateChange(TOKEN_REFRESHED)
5. Последующие API-запросы используют новый access_token
```

**Восстановление сессии при перезагрузке:**

```
1. App mount → useAuthStore инициализация
2. supabase.auth.getSession() → проверка localStorage на refresh_token
3. Если refresh_token валиден → auto-refresh → SIGNED_IN
4. Если refresh_token отсутствует → пользователь не аутентифицирован → Landing
```

### 2.4. Cron-аутентификация (серверные задачи)

Для cron-задач (автосинхронизация) используется отдельный механизм -- **X-Cron-Secret header**.

**Файл:** `backend/app/auth.py` -- `get_current_user_or_cron`

```python
async def get_current_user_or_cron(request, credentials):
    # 1. Проверяем X-Cron-Secret
    cron_secret = request.headers.get("x-cron-secret")
    if cron_secret:
        # Сравнение через hmac.compare_digest (timing-safe)
        if not hmac.compare_digest(cron_secret.encode(), expected.encode()):
            raise HTTPException(401, "Invalid cron secret")
        user_id = request.headers.get("x-cron-user-id")
        return CurrentUser(id=user_id, email="cron@system")

    # 2. Fallback: JWT
    return await get_current_user(credentials)
```

**Важно:**
- `hmac.compare_digest` -- защита от timing attack
- `X-Cron-User-Id` -- обязательный header при cron-аутентификации
- Cron secret хранится в `.env` (`SYNC_CRON_SECRET`)

### 2.5. Admin-аутентификация

Администраторы определяются явным списком UUID в конфигурации.

**Файл:** `backend/app/config.py`

```python
admin_user_ids: list[str] = Field(
    default_factory=lambda: ["e2db2023-4ce3-4182-96d3-7a194657cb4a"]
)
```

**Проверка в эндпоинтах:**

```python
if current_user.id not in settings.admin_user_ids:
    raise HTTPException(status_code=403, detail="Admin access required")
```

Admin-only эндпоинты:
- `PUT /subscription` -- смена тарифа пользователя
- Административные операции через `/api/v1/admin/*`

### 2.6. Route Guards (Frontend)

**Файл:** `frontend/src/components/Shared/ProtectedRoute.tsx`

```
1. Проверка auth: user существует?
   - Нет → redirect /login
   - Да → продолжаем

2. Проверка MP-токенов: есть WB или Ozon токен?
   - Нет → redirect /settings (onboarding)
   - Да → render protected content

3. Проверка подписки (для gated routes):
   - FeatureGate проверяет план
   - Недостаточный план → blur + lock overlay
```

**Таблица маршрутов:**

| Маршрут | Auth | MP-токены | План |
|---------|------|-----------|------|
| `/` | Landing / redirect | -- | -- |
| `/login` | Нет | -- | -- |
| `/reset-password` | Нет* | -- | -- |
| `/app` | Да | Да | Free+ |
| `/settings` | Да | -- | Free+ |
| `/orders` | Да | Да | Business |
| `/unit-economics` | Да | Да | Pro+ |
| `/ads` | Да | Да | Pro+ |
| `/print` | Да | Да | Pro+ |

---

## 3. Авторизация (Feature Gates)

### 3.1. Матрица фич по планам

| Feature | Free | Pro (990 руб/мес) | Business (2990 руб/мес) |
|---------|------|----|----|
| `dashboard` | Да | Да | Да |
| `costs_tree_basic` | Да | Да | Да |
| `costs_tree_details` | -- | Да | Да |
| `unit_economics` | -- | Да | Да |
| `ads_page` | -- | Да | Да |
| `pdf_export` | -- | Да | Да |
| `period_comparison` | -- | Да | Да |
| `order_monitor` | -- | -- | Да |
| `api_access` | -- | -- | Да |

### 3.2. Лимиты по планам

| Параметр | Free | Pro | Business |
|----------|------|-----|----------|
| Макс. SKU | 3 | 20 | Без лимита |
| Маркетплейсы | WB | WB + Ozon | WB + Ozon |
| Автосинхронизация | -- | Каждые 6ч | Каждые 2ч |
| Ручная синхронизация | 0/день | 1/день | 2/день |
| Приоритет синхронизации | 2 (низкий) | 1 (средний) | 0 (высокий) |
| Расписание (MSK) | 08:00, 20:00 | 07:00, 13:00, 19:00, 01:00 | 06:00, 12:00, 18:00, 00:00 |

### 3.3. Backend -- Hard Gates

**Файл:** `backend/app/subscription.py`

```python
def require_feature(feature: str):
    """FastAPI dependency -- проверяет наличие фичи в плане пользователя."""
    async def _check(sub: UserSubscription = Depends(get_user_subscription)):
        if not has_feature(sub.plan, feature):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "feature_not_available",
                    "feature": feature,
                    "current_plan": sub.plan,
                    "required_plan": _minimum_plan_for_feature(feature),
                }
            )
        return sub
    return _check
```

**Использование в роутерах:**

```python
@router.get("/unit-economics")
async def get_unit_economics(
    sub: UserSubscription = Depends(require_feature("unit_economics")),
):
    ...
```

**Ответ при отсутствии фичи (HTTP 403):**

```json
{
    "detail": {
        "error": "feature_not_available",
        "feature": "pdf_export",
        "current_plan": "free",
        "required_plan": "pro",
        "message": "Feature 'pdf_export' requires a higher plan. Current: free"
    }
}
```

### 3.4. Frontend -- Soft Gates

**Файл:** `frontend/src/components/Shared/FeatureGate.tsx`

FeatureGate -- компонент-обёртка, который рендерит контент или показывает blur + lock overlay.

```tsx
<FeatureGate feature="unit_economics">
  <UnitEconomicsTable data={data} />
</FeatureGate>
```

Поведение:
- `hasAccess = true` -- рендерит children как есть
- `hasAccess = false` -- показывает children с `blur-[2px] opacity-30` + иконка Lock + ссылка на `/settings?tab=billing`
- `hide = true` -- полностью скрывает контент (вместо blur)
- Во время загрузки -- оптимистично показывает контент

---

## 4. Подписки

### 4.1. Архитектура

Планы определены **в коде** (`backend/app/plans.py`), а не в базе данных. Это архитектурное решение (#8) -- 3 статичных тарифа не требуют динамики БД.

```python
PLANS = {
    "free":     { "name": "Free",     "price_rub": 0,    "max_sku": 3,    ... },
    "pro":      { "name": "Pro",      "price_rub": 990,  "max_sku": 20,   ... },
    "business": { "name": "Business", "price_rub": 2990, "max_sku": None, ... },
}
```

**Примечание:** Business-план скрыт в UI (`"visible": False`) до доработки Order Monitor.

### 4.2. Жизненный цикл подписки

```
Первый запрос пользователя
    |
    v
_load_subscription(user_id)
    |
    ├── Запись в mp_user_subscriptions НЕ найдена
    |   → Auto-create: INSERT (plan=free, status=active)
    |   → Возврат UserSubscription(plan="free")
    |
    └── Запись найдена
        |
        ├── status = "active" → Возврат плана из БД
        └── status != "active" (expired/cancelled) → Fallback to "free"
```

### 4.3. Смена плана

**Upgrade (через оплату):**

```
POST /subscription/upgrade { plan: "pro" }
    → Создание платежа ЮКассы
    → Пользователь оплачивает
    → Webhook payment.succeeded
    → mp_user_subscriptions.plan = "pro", expires_at = now + 30 дней
    → mp_sync_queue обновляется (приоритет, расписание)
```

**Downgrade (через admin или истечение):**

```
PUT /subscription { user_id, plan: "free" }  // admin-only
    → mp_user_subscriptions.plan = "free"
    → sync_queue обновляется
```

**Автопродление (будущее, требует одобрения менеджера ЮКассы):**

```
Cron: expires_at < now + 1 день AND auto_renew = true
    → create_auto_payment(payment_method_id, plan, user_id)
    → Webhook → expires_at += 30 дней
```

### 4.4. Таблица БД

```sql
-- mp_user_subscriptions
id              UUID PRIMARY KEY
user_id         UUID NOT NULL UNIQUE → auth.users(id)
plan            TEXT ('free' | 'pro' | 'business')
status          TEXT ('active' | 'cancelled' | 'expired')
auto_renew      BOOLEAN DEFAULT true
expires_at      TIMESTAMPTZ           -- NULL = бессрочно (free / admin)
payment_method_id TEXT                -- для автоплатежей
changed_by      TEXT                  -- email admin / 'yookassa' / 'migration'
started_at      TIMESTAMPTZ
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

---

## 5. Платежи (YooKassa)

### 5.1. Конфигурация

| Параметр | Значение |
|----------|----------|
| ShopID | 1273909 |
| API | `https://api.yookassa.ru/v3` |
| Авторизация | Basic Auth (shop_id:secret_key) |
| Webhook URL | `https://reviomp.ru/api/v1/subscription/webhook` |
| События | `payment.succeeded`, `payment.canceled` |

**Файл:** `backend/app/services/payment_service.py`

### 5.2. Поток оплаты (Redirect Flow)

```
[Frontend]                [Backend]               [YooKassa]
    |                         |                        |
    |  POST /upgrade          |                        |
    |  {plan: "pro"}          |                        |
    |------------------------>|                        |
    |                         |  POST /v3/payments     |
    |                         |  (Basic Auth, JSON)    |
    |                         |----------------------->|
    |                         |                        |
    |                         |  {id, confirmation_url} |
    |                         |<-----------------------|
    |                         |                        |
    |                         |  INSERT mp_payments    |
    |                         |  (status: pending)     |
    |                         |                        |
    |  {confirmation_url}     |                        |
    |<------------------------|                        |
    |                         |                        |
    |  redirect user          |                        |
    |------------------------------------------------->|
    |                         |                        |
    |                         |  (пользователь платит) |
    |                         |                        |
    |  redirect /settings     |  POST /webhook         |
    |  ?payment=success       |  (payment.succeeded)   |
    |<-------------------------------------------------|
    |                         |<-----------------------|
    |                         |                        |
    |                         |  1. Проверка IP        |
    |                         |  2. GET /v3/payments/  |
    |                         |     {id} (верификация) |
    |                         |  3. UPDATE подписка    |
    |                         |  4. UPDATE sync_queue  |
```

### 5.3. Безопасность Webhook

Webhook от ЮКассы защищён **двойной верификацией**:

**Слой 1 -- IP Whitelist:**

```python
YOOKASSA_WEBHOOK_IPS = [
    ip_network("185.71.76.0/27"),
    ip_network("185.71.77.0/27"),
    ip_network("77.75.153.0/25"),
    ip_network("77.75.154.128/25"),
    ip_network("77.75.156.11/32"),
    ip_network("77.75.156.35/32"),
    ip_network("2a02:5180::/32"),
]

def verify_webhook_ip(client_ip: str) -> bool:
    addr = ip_address(client_ip)
    return any(addr in net for net in YOOKASSA_WEBHOOK_IPS)
```

IP извлекается из заголовков в порядке приоритета:
1. `X-Forwarded-For` (первый IP в цепочке)
2. `X-Real-IP`
3. `request.client.host`

**Слой 2 -- Верификация через API:**

```python
# После получения webhook -- запрашиваем статус напрямую у ЮКассы
verified = await get_payment(yookassa_payment_id)
verified_status = verified.get("status")
# Обрабатываем ТОЛЬКО если оба источника подтверждают
if event_type == "payment.succeeded" and verified_status == "succeeded":
    await _handle_payment_succeeded(...)
```

**Дополнительные защиты:**
- **Idempotency:** платёж со статусом != "pending" пропускается (повторные webhook не обрабатываются)
- **Idempotence-Key:** UUID при создании платежа (защита от дублей на стороне ЮКассы)
- **HTTP 403** при невалидном IP (логируется)

### 5.4. Эндпоинты

| Эндпоинт | Auth | Назначение |
|----------|------|-----------|
| `POST /subscription/upgrade` | JWT Bearer | Создать платёж, получить URL оплаты |
| `POST /subscription/webhook` | IP Whitelist | Webhook от ЮКассы |
| `POST /subscription/cancel` | JWT Bearer | Отменить автопродление |
| `POST /subscription/enable-auto-renew` | JWT Bearer | Включить автопродление |
| `GET /subscription` | JWT Bearer | Текущий план + лимиты + фичи |
| `GET /subscription/plans` | Без auth | Список планов для сравнения |
| `PUT /subscription` | JWT Bearer + Admin | Смена плана (admin-only) |

### 5.5. Таблица платежей

```sql
-- mp_payments
id                   UUID PRIMARY KEY
user_id              UUID → auth.users(id)
yookassa_payment_id  TEXT UNIQUE          -- ID платежа в ЮКассе
payment_method_id    TEXT                 -- для рекуррентных платежей
amount               DECIMAL(10,2)
currency             TEXT DEFAULT 'RUB'
status               TEXT ('pending' | 'succeeded' | 'canceled')
plan                 TEXT ('pro' | 'business')
description          TEXT
metadata             JSONB                -- user_id, plan, type
created_at           TIMESTAMPTZ
updated_at           TIMESTAMPTZ
```

---

## 6. Шифрование

### 6.1. Fernet (AES-128-CBC + HMAC-SHA256)

API-токены маркетплейсов (WB, Ozon Seller, Ozon Performance) шифруются **Fernet** перед записью в БД.

**Файл:** `backend/app/crypto.py`

```python
from cryptography.fernet import Fernet

def encrypt_token(plaintext: str) -> str:
    """Шифрует токен перед записью в БД."""
    return _get_fernet().encrypt(plaintext.encode()).decode()

def decrypt_token(ciphertext: str) -> str:
    """Расшифровывает токен при использовании."""
    return _get_fernet().decrypt(ciphertext.encode()).decode()
```

### 6.2. Поток данных

```
Пользователь вводит токен
    |
    v
PUT /tokens { wb_api_token: "eyJ..." }
    |
    v
encrypt_token("eyJ...") → "gAAAAABl..."
    |
    v
INSERT INTO mp_user_tokens (wb_api_token = "gAAAAABl...")
    |
    v
Синхронизация: SELECT wb_api_token → decrypt_token("gAAAAABl...") → "eyJ..."
    |
    v
Запрос к WB API с расшифрованным токеном
```

### 6.3. Что шифруется

| Поле | Таблица | Описание |
|------|---------|----------|
| `wb_api_token` | `mp_user_tokens` | WB API ключ |
| `ozon_client_id` | `mp_user_tokens` | Ozon Seller Client ID |
| `ozon_api_key` | `mp_user_tokens` | Ozon Seller API Key |
| `ozon_perf_client_id` | `mp_user_tokens` | Ozon Performance Client ID |
| `ozon_perf_secret` | `mp_user_tokens` | Ozon Performance Secret |

### 6.4. Архитектурные решения

| Решение | Обоснование |
|---------|------------|
| Fernet (НЕ pgcrypto) | Шифрование на стороне backend -- ключ не попадает в БД |
| Fernet (НЕ Vault) | Избыточно для 1 VPS; Fernet достаточен для текущего масштаба |
| Один FERNET_KEY | Ротация требует перешифровки; при необходимости -- двухфазная миграция |
| Decrypt only on use | Токены расшифровываются только в момент обращения к API маркетплейсов |

### 6.5. GET /tokens -- безопасность

Эндпоинт `GET /tokens` возвращает **только флаги наличия** токенов, НЕ сами значения:

```json
{
    "has_wb": true,
    "has_ozon_seller": true,
    "has_ozon_perf": false
}
```

Расшифрованные значения никогда не покидают backend.

---

## 7. Row Level Security (RLS)

### 7.1. Принцип

Все таблицы с пользовательскими данными защищены PostgreSQL RLS-политиками. Каждая политика проверяет `auth.uid() = user_id`.

**Архитектурное решение (#6):** RLS -- это **safety net**, а не primary filter. Backend всегда фильтрует по `user_id` через `service_role_key` (обходит RLS). Если anon key утечёт -- RLS предотвратит доступ к чужим данным.

### 7.2. Таблицы с RLS

| Таблица | RLS | SELECT | INSERT | UPDATE | DELETE |
|---------|-----|--------|--------|--------|--------|
| `mp_products` | Да | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `mp_sales` | Да | Да | Да | Да | Да |
| `mp_stocks` | Да | Да | Да | Да | Да |
| `mp_costs` | Да | Да | Да | Да | Да |
| `mp_costs_details` | Да | Да | Да | Да | Да |
| `mp_sales_geo` | Да | Да | Да | Да | Да |
| `mp_ad_costs` | Да | Да | Да | Да | Да |
| `mp_sync_log` | Да | Да | Да | Да | Да |
| `mp_user_tokens` | Да | Да | Да | Да | Да |
| `mp_user_subscriptions` | Да | Да (SELECT only) | -- | -- | -- |
| `mp_sync_queue` | Да | Да (SELECT only) | -- | -- | -- |
| `mp_payments` | Да | Да | Да* | Да* | -- |
| `mp_orders` | Да | Да | Да | Да | Да |
| `mp_sales_plan` | Да | Да | Да | Да | Да |
| `mp_sales_plan_summary` | Да | Да | Да | Да | Да |
| `mp_stock_snapshots` | Да | Да | Да | Да | Да |

\* Для `mp_payments`, `mp_user_subscriptions`, `mp_sync_queue` -- запись производится только через `service_role_key` (backend). RLS-политики для INSERT/UPDATE/DELETE не создаются для обычных пользователей.

### 7.3. Миграция

**Файл:** `backend/migrations/005_rls_policies.sql` (основные таблицы)

```sql
ALTER TABLE mp_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own products"
    ON mp_products FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own products"
    ON mp_products FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own products"
    ON mp_products FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users delete own products"
    ON mp_products FOR DELETE
    USING (auth.uid() = user_id);
```

Дополнительные таблицы получают RLS в своих миграциях: 007 (tokens), 008 (subscriptions), 010 (sync_queue), 012 (payments).

### 7.4. Backend -- service_role_key

Backend использует `service_role_key` для всех операций с БД. Этот ключ **обходит RLS**, что позволяет:
- Cron-задачам синхронизировать данные любого пользователя
- Admin-эндпоинтам управлять подписками
- Webhook ЮКассы обновлять статусы платежей

```python
# backend/app/db/supabase.py
supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

# ВАЖНО: backend ВСЕГДА фильтрует по user_id вручную
result = supabase.table("mp_sales") \
    .select("*") \
    .eq("user_id", user_id) \    # <-- primary filter
    .gte("date", date_from) \
    .execute()
```

---

## 8. CORS

### 8.1. Конфигурация

**Файл:** `backend/app/main.py`

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://reviomp.ru",
        "https://analitics.bixirun.ru",  # legacy domain
        "http://localhost:5173",          # dev (Vite)
        "http://localhost:4173",          # dev (preview)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 8.2. Параметры

| Параметр | Значение | Обоснование |
|----------|----------|------------|
| `allow_origins` | Whitelist из 4 origins | Только production и localhost dev |
| `allow_credentials` | `True` | Нужно для Cookie-based sessions и Authorization headers |
| `allow_methods` | `["*"]` | GET, POST, PUT, DELETE -- все используются |
| `allow_headers` | `["*"]` | Authorization, Content-Type, X-Cron-Secret и пр. |

### 8.3. Nginx (дополнительный уровень)

Nginx на VPS также настроен для проксирования CORS-заголовков и добавления security headers:

```
server {
    listen 443 ssl;
    server_name reviomp.ru;

    ssl_certificate     /etc/letsencrypt/live/reviomp.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reviomp.ru/privkey.pem;

    # Frontend: SPA fallback
    location / {
        root /var/www/analytics/frontend;
        try_files $uri /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 9. Customer Journey Map

### 9.1. Регистрация + Onboarding

```
[Landing /]
    |
    v  "Начать бесплатно"
[LoginPage /login] (mode: signup)
    |
    v  supabase.auth.signUp(email, password)
[Supabase Auth] → creates user (unconfirmed)
    |
    v
[LoginPage] → "Проверьте почту для подтверждения"
    |
    v  (email доставлен)
[Email: "Подтвердите регистрацию в RevioMP"]
    |
    v  click "Подтвердить email"
[Supabase verify] → redirect to reviomp.ru/#access_token=...
    |
    v  onAuthStateChange(SIGNED_IN)
[ProtectedRoute] → нет MP-токенов?
    |
    v  redirect
[Settings /settings?tab=connections] → ввод WB/Ozon токенов
    |
    v  PUT /tokens + POST /tokens/save-and-sync
    |  (токены шифруются Fernet, синхронизация в фоне)
    |
    v  синхронизация завершена
[Dashboard /app] → данные загружены
```

### 9.2. Вход

```
[LoginPage /login] (mode: login)
    |
    v  supabase.auth.signInWithPassword(email, password)
    |
    ├── Успех: SIGNED_IN → navigate to /
    |       |
    |       ├── есть MP-токены → /app (Dashboard)
    |       └── нет MP-токенов → /settings (Onboarding)
    |
    └── Ошибка: inline error message
            ├── "Неверный email или пароль"
            ├── "Подтвердите email перед входом"
            └── "Пользователь не найден"
```

### 9.3. Сброс пароля

```
[LoginPage /login] (mode: forgot-password)
    |
    v  supabase.auth.resetPasswordForEmail(email, { redirectTo })
    |
    v  "Проверьте почту для сброса пароля"
    |
    v  (email доставлен)
[Email: "Сброс пароля RevioMP"]
    |
    v  click "Сбросить пароль"
[Supabase verify] → redirect to /reset-password#access_token=...&type=recovery
    |
    v  onAuthStateChange(PASSWORD_RECOVERY)
[ResetPasswordPage /reset-password]
    |
    v  ввод нового пароля + подтверждение
    |
    v  supabase.auth.updateUser({ password })
    |
    ├── Успех: toast "Пароль изменён" → /app
    └── Ошибка: inline error
```

### 9.4. Upgrade подписки

```
[Settings /settings?tab=billing] или [Landing /] PricingSection
    |
    v  "Подключить Pro"
[Frontend] → POST /subscription/upgrade { plan: "pro" }
    |
    v
[Backend] → create_payment (YooKassa API)
    |
    v  {confirmation_url}
[Frontend] → redirect на страницу оплаты ЮКассы
    |
    v  пользователь оплачивает (карта / ЮМани / СБП)
    |
    v  redirect → /settings?payment=success
    |
    v  (асинхронно) YooKassa → POST /subscription/webhook
[Backend]
    ├── Проверка IP whitelist
    ├── Двойная верификация: GET /v3/payments/{id}
    ├── UPDATE mp_payments (status=succeeded)
    ├── UPSERT mp_user_subscriptions (plan=pro, expires_at=+30d)
    └── UPSERT mp_sync_queue (priority=1, расписание Pro)
    |
    v
[Frontend] → toast "Оплата прошла!" → UI обновлён (Pro features разблокированы)
```

### 9.5. Удаление аккаунта

```
[Settings /settings?tab=profile]
    |
    v  scroll to "Danger Zone"
    |
    v  click "Удалить аккаунт"
[Confirmation Modal] → ввести "УДАЛИТЬ"
    |
    v  "Подтвердить удаление"
    |
    v  DELETE /api/v1/account
[Backend account.py]
    |
    ├── DELETE FROM mp_payments         WHERE user_id = ...
    ├── DELETE FROM mp_sync_queue       WHERE user_id = ...
    ├── DELETE FROM mp_sync_log         WHERE user_id = ...
    ├── DELETE FROM mp_orders           WHERE user_id = ...
    ├── DELETE FROM mp_ad_costs         WHERE user_id = ...
    ├── DELETE FROM mp_sales_geo        WHERE user_id = ...
    ├── DELETE FROM mp_costs_details    WHERE user_id = ...
    ├── DELETE FROM mp_costs            WHERE user_id = ...
    ├── DELETE FROM mp_stocks           WHERE user_id = ...
    ├── DELETE FROM mp_sales            WHERE user_id = ...
    ├── DELETE FROM mp_products         WHERE user_id = ...
    ├── DELETE FROM mp_user_subscriptions WHERE user_id = ...
    └── DELETE FROM mp_user_tokens      WHERE user_id = ...
    |
    v  Supabase Admin API: DELETE /auth/v1/admin/users/{user_id}
    |
    v  200 OK
[Frontend]
    |
    v  signOut() + navigate to /
[Landing /] → toast "Аккаунт удален"
```

Порядок удаления таблиц критичен -- соблюдаются foreign key constraints. Все данные удаляются **безвозвратно**.

---

## 10. Рекомендации по безопасности

### 10.1. Секреты и ключи

| Рекомендация | Статус | Детали |
|--------------|--------|--------|
| `.env` не в git | Да | `.gitignore` содержит `.env` |
| Нет секретов в коде | Да | Все через `pydantic_settings` + `.env` |
| `admin_user_ids` в config | Да | Вынесено из кода в конфигурацию |
| FERNET_KEY уникален per-env | Да | Разные ключи для dev и production |

### 10.2. Переменные окружения (`.env`)

```bash
# Supabase
SUPABASE_URL=https://xpushkwswfbkdkbmghux.supabase.co
SUPABASE_ANON_KEY=...              # Публичный ключ (НЕ JWT secret!)
SUPABASE_SERVICE_ROLE_KEY=...      # Приватный ключ (обходит RLS)

# Шифрование
FERNET_KEY=...                     # 32-byte base64-encoded key

# Cron
SYNC_CRON_SECRET=...               # Для X-Cron-Secret header

# Платежи
YOOKASSA_SHOP_ID=1273909
YOOKASSA_SECRET_KEY=...            # live_ или test_ ключ

# Маркетплейсы (legacy, для admin)
WB_API_TOKEN=...
OZON_CLIENT_ID=...
OZON_API_KEY=...
OZON_PERFORMANCE_CLIENT_ID=...
OZON_PERFORMANCE_CLIENT_SECRET=...
```

### 10.3. Ротация ключей

| Ключ | Частота | Процедура |
|------|---------|-----------|
| `FERNET_KEY` | По необходимости | 1. Сгенерировать новый ключ. 2. Расшифровать все токены старым ключом. 3. Перешифровать новым. 4. Обновить `.env`. 5. Рестарт. |
| `SUPABASE_SERVICE_ROLE_KEY` | Никогда (managed by Supabase) | Ротация через Supabase Dashboard |
| `YOOKASSA_SECRET_KEY` | По необходимости | Сгенерировать новый в ЛК ЮКассы. Обновить `.env`. Рестарт. |
| `SYNC_CRON_SECRET` | По необходимости | Обновить `.env` на VPS + в cron-скрипте. Рестарт. |

### 10.4. Чек-лист аудита безопасности

- [ ] SSL-сертификат Let's Encrypt автообновляется (`certbot renew --dry-run`)
- [ ] CORS origins whitelist актуален (нет лишних доменов)
- [ ] `admin_user_ids` содержит только актуальных администраторов
- [ ] YooKassa использует `live_` ключ (НЕ `test_`) в production
- [ ] YooKassa webhook URL настроен в ЛК (`https://reviomp.ru/api/v1/subscription/webhook`)
- [ ] IP whitelist ЮКассы актуален (проверить документацию ЮКассы)
- [ ] `.env` файл имеет права `chmod 600` (только owner read/write)
- [ ] `service_role_key` не попадает во frontend (проверить bundle)
- [ ] Все таблицы с `user_id` имеют RLS-политики
- [ ] Backend всегда фильтрует по `user_id` (не полагается только на RLS)
- [ ] Refresh tokens не логируются (проверить логи FastAPI)
- [ ] FERNET_KEY отличается между dev и production окружениями

### 10.5. Известные ограничения

| Ограничение | Описание | Уровень риска |
|-------------|----------|--------------|
| Один FERNET_KEY | Нет key versioning; ротация требует перешифровки всех токенов | Низкий |
| Нет rate limiting | API не имеет rate limit на уровне приложения (только Nginx) | Средний |
| Нет 2FA | Supabase Auth поддерживает TOTP, но не подключён | Низкий (B2B SaaS, малый масштаб) |
| Автоплатежи не active | Требуют одобрения менеджера ЮКассы | Бизнес-блокер |
| Password reset -- 24ч | Ссылка сброса пароля действительна 24 часа (Supabase default) | Приемлемо |
| localStorage refresh token | XSS-уязвимость может украсть refresh token | Стандарт для SPA (Supabase SDK) |

### 10.6. Мониторинг

Рекомендации по мониторингу безопасности:

```bash
# Логи webhook от неизвестных IP
journalctl -u analytics-api | grep "untrusted IP"

# Неудачные попытки авторизации
journalctl -u analytics-api | grep "Invalid token\|Token expired\|Invalid cron secret"

# Удаления аккаунтов
journalctl -u analytics-api | grep "Account deleted"

# Смены планов
journalctl -u analytics-api | grep "Subscription activated\|Plan upgrade"
```
