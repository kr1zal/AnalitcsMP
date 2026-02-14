# RevioMP Auth Flow - Customer Journey Maps

Полное описание пользовательских сценариев аутентификации.

---

## Техническая архитектура

| Component | Technology |
|-----------|-----------|
| Auth provider | Supabase Auth (email/password) |
| JWT verification | PyJWT + JWKS (backend middleware `auth.py`) |
| Session management | `@supabase/supabase-js` in-memory (frontend) |
| Token refresh | Automatic (Supabase JS SDK handles refresh tokens) |
| Backend validation | `get_current_user()` dependency — extracts `user_id` from JWT |
| RLS | All `mp_*` tables have `auth.uid() = user_id` policies |
| Encryption | Fernet for marketplace API tokens (`crypto.py`) |
| Redirect URLs | `https://reviomp.ru/**`, `http://localhost:5173/**` |
| Site URL | `https://reviomp.ru` (Supabase Dashboard) |

### Frontend auth state (`useAuthStore` - Zustand)

```
useAuthStore:
  - user: User | null
  - session: Session | null
  - loading: boolean
  - signIn(email, password)
  - signUp(email, password)
  - signOut()
  - resetPassword(email)
  - updatePassword(password)
```

### Backend auth middleware (`auth.py`)

```
Request → Extract Bearer token → Verify JWT via JWKS → Extract user_id → Inject into route
```

### Key files

| File | Purpose |
|------|---------|
| `frontend/src/store/useAuthStore.ts` | Zustand auth state + Supabase auth methods |
| `frontend/src/pages/LoginPage.tsx` | Login / Register / Forgot Password (3 modes) |
| `frontend/src/pages/ResetPasswordPage.tsx` | New password form (PASSWORD_RECOVERY event) |
| `frontend/src/components/Shared/ProtectedRoute.tsx` | Auth guard + token check + redirect |
| `backend/app/auth.py` | JWT middleware (JWKS), `get_current_user()` |
| `backend/app/api/v1/account.py` | Account deletion endpoint |

---

## 1. Регистрация (Registration CJM)

```
LandingPage → LoginPage (signup) → Email → Confirm → Onboarding → Dashboard
```

### Пошаговый путь пользователя

**1.1** Пользователь заходит на `reviomp.ru` -- видит LandingPage с описанием продукта.

**1.2** Нажимает кнопку "Начать бесплатно" (или "Войти" в навбаре) -- переход на `/login`.

**1.3** По умолчанию открыта форма входа. Нажимает "Нет аккаунта? Зарегистрируйтесь" -- переключается в режим регистрации.

**1.4** Вводит email и пароль (минимум 6 символов). Поля валидируются на клиенте.

**1.5** Нажимает "Зарегистрироваться" -- вызывается `supabase.auth.signUp({ email, password })`.

**1.6** Supabase создает пользователя со статусом `email_not_confirmed`. Возвращает `user` без `session`.

**1.7** LoginPage показывает сообщение:
> "Проверьте почту для подтверждения регистрации"

**1.8** Пользователь получает email "Подтвердите регистрацию в RevioMP" (Template 1 из `docs/email-templates.md`).

**1.9** Нажимает кнопку "Подтвердить email" -- ссылка вида:
```
https://xpushkwswfbkdkbmghux.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=https://reviomp.ru
```
Supabase верифицирует токен и редиректит на `https://reviomp.ru/#access_token=...&refresh_token=...&type=signup`.

**1.10** Supabase JS SDK (`onAuthStateChange`) парсит URL hash, устанавливает сессию. Событие: `SIGNED_IN`.

**1.11** `ProtectedRoute` проверяет наличие MP токенов (WB/Ozon). Токенов нет -- редирект на `/settings` (onboarding).

**1.12** На странице Settings пользователь вводит API-токены Wildberries и/или Ozon. Нажимает "Сохранить".

**1.13** Backend шифрует токены (Fernet) и сохраняет в `mp_user_tokens`. Автоматически запускается первая синхронизация.

**1.14** Синхронизация загружает данные с маркетплейсов. По завершении пользователь перенаправляется на дашборд `/app`.

### Схема

```
[Landing /]
    |
    v "Начать бесплатно"
[LoginPage /login] (mode: signup)
    |
    v signUp(email, password)
[Supabase Auth] --> creates user (unconfirmed)
    |
    v
[LoginPage] --> "Проверьте почту"
    |
    v (email delivered)
[Email: "Подтвердите регистрацию"]
    |
    v click "Подтвердить email"
[Supabase verify] --> redirect to reviomp.ru/#tokens
    |
    v onAuthStateChange(SIGNED_IN)
[ProtectedRoute] --> no MP tokens?
    |
    v redirect
[Settings /settings] --> enter WB/Ozon tokens
    |
    v save + sync
[Dashboard /app] --> data loaded
```

---

## 2. Вход (Login CJM)

```
LoginPage → signIn → Dashboard
```

### Пошаговый путь пользователя

**2.1** Пользователь переходит на `/login` (напрямую или через кнопку "Войти").

**2.2** Форма входа открыта по умолчанию. Вводит email и пароль.

**2.3** Нажимает "Войти" -- вызывается `supabase.auth.signInWithPassword({ email, password })`.

**2.4** При успехе:
- Supabase возвращает `session` с `access_token` и `refresh_token`
- `onAuthStateChange` срабатывает с событием `SIGNED_IN`
- Навигация на `/` -- `ProtectedRoute` проверяет токены:
  - Есть MP токены -> дашборд `/app`
  - Нет MP токенов -> `/settings`

**2.5** При ошибке:
- Неверный пароль: inline сообщение "Неверный email или пароль"
- Email не подтверждён: "Подтвердите email перед входом"
- Пользователь не найден: "Пользователь не найден"

### Схема

```
[LoginPage /login] (mode: login)
    |
    v signIn(email, password)
    |
    ├── Success: SIGNED_IN --> navigate to /
    |       |
    |       ├── has MP tokens --> /app (Dashboard)
    |       └── no MP tokens  --> /settings (Onboarding)
    |
    └── Error: inline error message
```

---

## 3. Сброс пароля (Password Reset CJM)

```
LoginPage (forgot) → Email → ResetPasswordPage → updateUser → Dashboard
```

### Пошаговый путь пользователя

**3.1** Пользователь на `/login`. Нажимает "Забыли пароль?" -- переключается в режим `forgot-password`.

**3.2** Вводит email-адрес.

**3.3** Нажимает "Отправить ссылку" -- вызывается:
```ts
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'https://reviomp.ru/reset-password'
})
```

**3.4** LoginPage показывает сообщение:
> "Проверьте почту для сброса пароля"

**3.5** Пользователь получает email "Сброс пароля RevioMP" (Template 2 из `docs/email-templates.md`).

**3.6** Нажимает кнопку "Сбросить пароль" -- ссылка вида:
```
https://xpushkwswfbkdkbmghux.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=https://reviomp.ru/reset-password
```
Supabase верифицирует токен и редиректит на:
```
https://reviomp.ru/reset-password#access_token=...&type=recovery
```

**3.7** `ResetPasswordPage` загружается. `onAuthStateChange` срабатывает с событием `PASSWORD_RECOVERY`.

**3.8** Страница показывает форму с двумя полями: "Новый пароль" и "Подтвердите пароль".

**3.9** Пользователь вводит новый пароль и нажимает "Сохранить пароль" -- вызывается:
```ts
supabase.auth.updateUser({ password: newPassword })
```

**3.10** При успехе:
- Toast: "Пароль успешно изменен"
- Навигация на `/app` (дашборд)

**3.11** При ошибке:
- Пароли не совпадают: клиентская валидация
- Слишком короткий пароль: "Минимум 6 символов"
- Токен истёк (24 часа): "Ссылка истекла, запросите сброс повторно"

### Схема

```
[LoginPage /login] (mode: forgot-password)
    |
    v resetPasswordForEmail(email)
    |
    v
[LoginPage] --> "Проверьте почту"
    |
    v (email delivered)
[Email: "Сброс пароля RevioMP"]
    |
    v click "Сбросить пароль"
[Supabase verify] --> redirect to /reset-password#tokens
    |
    v onAuthStateChange(PASSWORD_RECOVERY)
[ResetPasswordPage /reset-password]
    |
    v enter new password + confirm
    |
    v updateUser({ password })
    |
    ├── Success: toast + navigate to /app
    └── Error: inline error
```

---

## 4. Удаление аккаунта (Account Deletion CJM)

```
Settings → Confirm → DELETE /api/v1/account → Logout → Landing
```

### Пошаговый путь пользователя

**4.1** Пользователь находится на странице `/settings`.

**4.2** Прокручивает вниз до секции "Danger Zone" (красная рамка).

**4.3** Нажимает кнопку "Удалить аккаунт" -- появляется модальное окно подтверждения.

**4.4** Для подтверждения пользователь должен ввести текст `УДАЛИТЬ` в поле ввода.

**4.5** Нажимает "Подтвердить удаление" -- отправляется запрос:
```
DELETE /api/v1/account
Authorization: Bearer <access_token>
```

**4.6** Backend (`account.py`) выполняет последовательно:
1. Извлекает `user_id` из JWT
2. Удаляет все данные пользователя из таблиц:
   - `mp_orders`
   - `mp_ad_costs`
   - `mp_costs_details`
   - `mp_costs`
   - `mp_sales_geo`
   - `mp_sales`
   - `mp_stocks`
   - `mp_sync_log`
   - `mp_sync_queue`
   - `mp_user_tokens`
   - `mp_user_subscriptions`
   - `mp_payments`
   - `mp_products` (user-specific data)
3. Удаляет пользователя из `auth.users` через Supabase Admin API:
   ```python
   supabase.auth.admin.delete_user(user_id)
   ```
4. Возвращает `200 OK`

**4.7** Frontend:
- Вызывает `signOut()` для очистки локальной сессии
- Редирект на `/` (LandingPage)
- Toast: "Аккаунт удален"

**4.8** Все данные удалены безвозвратно. При повторной регистрации пользователь начинает с чистого аккаунта.

### Схема

```
[Settings /settings]
    |
    v scroll to "Danger Zone"
    |
    v click "Удалить аккаунт"
[Confirmation Modal] --> type "УДАЛИТЬ"
    |
    v "Подтвердить удаление"
    |
    v DELETE /api/v1/account
[Backend account.py]
    |
    ├── Delete mp_orders WHERE user_id = ...
    ├── Delete mp_ad_costs WHERE user_id = ...
    ├── Delete mp_costs_details WHERE user_id = ...
    ├── Delete mp_costs WHERE user_id = ...
    ├── Delete mp_sales_geo WHERE user_id = ...
    ├── Delete mp_sales WHERE user_id = ...
    ├── Delete mp_stocks WHERE user_id = ...
    ├── Delete mp_sync_log WHERE user_id = ...
    ├── Delete mp_sync_queue WHERE user_id = ...
    ├── Delete mp_user_tokens WHERE user_id = ...
    ├── Delete mp_user_subscriptions WHERE user_id = ...
    ├── Delete mp_payments WHERE user_id = ...
    ├── Delete mp_products WHERE user_id = ...
    └── supabase.auth.admin.delete_user(user_id)
    |
    v 200 OK
[Frontend]
    |
    v signOut() + navigate to /
[Landing /] --> toast "Аккаунт удален"
```

---

## 5. Сессия и токены (Session Management)

### Token lifecycle

| Token | Storage | Lifetime | Refresh |
|-------|---------|----------|---------|
| Access token (JWT) | In-memory (Supabase JS) | 1 hour (default) | Automatic |
| Refresh token | localStorage (Supabase JS) | 7 days (default) | On access token expiry |

### Auto-refresh flow

```
1. Supabase JS detects access_token expiry (exp claim)
2. Calls /auth/v1/token?grant_type=refresh_token
3. Receives new access_token + refresh_token
4. onAuthStateChange fires with TOKEN_REFRESHED event
5. All subsequent API calls use new access_token
```

### Backend JWT verification

```
1. Request arrives with Authorization: Bearer <token>
2. auth.py downloads JWKS from Supabase (cached)
3. Verifies JWT signature + expiry
4. Extracts user_id from sub claim
5. Injects user_id into route handler via Depends()
```

### Session recovery on page reload

```
1. App mounts → useAuthStore initializes
2. supabase.auth.getSession() checks localStorage for refresh_token
3. If valid refresh_token exists → auto-refreshes → SIGNED_IN event
4. If no refresh_token → user stays unauthenticated → sees Landing
```

---

## 6. Маршрутизация и защита (Routing & Guards)

### Route table

| Route | Component | Auth required | Notes |
|-------|-----------|---------------|-------|
| `/` | LandingPage / redirect to `/app` | No (shows landing) / Yes (redirects) | Based on auth state |
| `/login` | LoginPage | No | 3 modes: login, signup, forgot |
| `/reset-password` | ResetPasswordPage | No* | *Requires PASSWORD_RECOVERY event |
| `/app` | DashboardPage | Yes + MP tokens | Main dashboard |
| `/settings` | SettingsPage | Yes | Token entry, subscription, danger zone |
| `/sync` | SyncPage | Yes | Sync status + manual sync |
| `/orders` | OrderMonitorPage | Yes + Pro/Business | Feature-gated |
| `/unit-economics` | UnitEconomicsPage | Yes + Pro/Business | Feature-gated |
| `/ads` | AdsPage | Yes + Pro/Business | Feature-gated |
| `/print` | PrintPage | Yes | PDF export |

### ProtectedRoute logic

```
1. Check auth: user exists?
   - No → redirect to /login
   - Yes → continue
2. Check MP tokens: user has WB or Ozon token?
   - No → redirect to /settings (onboarding)
   - Yes → render protected content
3. Check subscription (for feature-gated routes):
   - FeatureGate component checks plan
   - Insufficient plan → blur + lock overlay
```

---

## 7. Error handling

| Scenario | User sees | Action |
|----------|-----------|--------|
| Invalid email format | Client validation error | Fix email |
| Password < 6 chars | Client validation error | Longer password |
| Email already registered | "Пользователь уже существует" | Login instead |
| Wrong password | "Неверный email или пароль" | Retry or reset |
| Email not confirmed | "Подтвердите email" | Check inbox |
| Expired reset link | "Ссылка истекла" | Request new reset |
| Network error | "Ошибка сети" | Retry |
| Supabase down | "Сервис временно недоступен" | Wait |
| Session expired | Auto-redirect to /login | Re-login |
