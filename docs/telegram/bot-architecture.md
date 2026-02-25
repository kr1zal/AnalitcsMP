# Telegram Bot -- Техническая архитектура

> Версия: 1.0 | Обновлено: 25.02.2026

---

## Содержание

1. [Webhook pipeline](#1-webhook-pipeline)
2. [FSM (Finite State Machine)](#2-fsm-finite-state-machine)
3. [Структура модуля](#3-структура-модуля)
4. [Database schema](#4-database-schema)
5. [Deep linking flow](#5-deep-linking-flow)
6. [Команды бота](#6-команды-бота)
7. [Callback handlers](#7-callback-handlers)
8. [Catch-all (free text)](#8-catch-all-free-text)
9. [Support group routing](#9-support-group-routing)
10. [Cron задачи](#10-cron-задачи)
11. [API endpoints](#11-api-endpoints)
12. [Environment variables](#12-environment-variables)

---

## 1. Webhook pipeline

```
Пользователь --> Telegram Cloud --> HTTPS POST /api/telegram/webhook
                                         |
                                    X-Telegram-Bot-Api-Secret-Token (header)
                                         |
                                    [hmac.compare_digest]
                                         |
                                         v
                                    FastAPI endpoint
                                    telegram.py:webhook
                                         |
                                    Update.model_validate(body)
                                         |
                                         v
                                    dp.feed_update(bot, update)
                                         |
                             +-----------+-----------+
                             |           |           |
                          Commands    Callbacks    FSM/Text
                          handlers   handlers     handlers
```

### Поток обработки

1. Telegram отправляет JSON Update на `https://analitics.bixirun.ru/api/telegram/webhook`
2. FastAPI endpoint проверяет `X-Telegram-Bot-Api-Secret-Token` через `hmac.compare_digest`
3. Body парсится в `aiogram.types.Update` через `model_validate`
4. `dp.feed_update()` роутит Update через зарегистрированные Router-ы
5. Endpoint ВСЕГДА возвращает `{"ok": True}` (даже при ошибках -- чтобы Telegram не ретраил)

### Два Router-а

| Router | Scope | Handlers |
|--------|-------|----------|
| `router` | Private chat | Команды, callbacks, FSM, catch-all text |
| `support_group_router` | Support group | Ответы оператора (reply_to_message) |

Регистрация в `register_handlers(dp)`:
```python
dp.include_router(router)           # Private chat handlers
dp.include_router(support_group_router)  # Support group handlers
```

---

## 2. FSM (Finite State Machine)

### Состояния

```python
class SupportState(StatesGroup):
    waiting_for_message = State()
```

Единственное FSM-состояние. Активируется когда пользователь нажимает "Связаться с оператором" в меню поддержки.

### Диаграмма переходов

```
[Idle]
  |
  | callback: support_operator
  v
[SupportState.waiting_for_message]
  |
  +-- Текст сообщения --> _handle_ai_support() --> [Idle]
  |                            |
  |                    confidence >= 0.7 --> after_ai_keyboard
  |                    confidence < 0.7  --> forward_to_support
  |
  +-- callback: cancel_operator --> support_keyboard --> [Idle]
```

### FSM Data

```python
await state.update_data(
    session_id=session_id,       # UUID сессии поддержки
    original_question=question,  # Текст вопроса (для эскалации)
    chat_id=chat_id,             # ID чата пользователя
)
```

FSM data используется в callback-ах `session_resolved`, `escalate_operator`, `csat_positive`, `csat_negative` для получения session_id. При отсутствии FSM data (например, после idle reminder от cron) -- fallback через `get_or_create_session(chat_id)`.

---

## 3. Структура модуля

```
backend/app/telegram/
  |
  +-- __init__.py           Синглтоны: get_bot(), get_dispatcher(),
  |                         get_webhook_secret(), get_support_group_id()
  |
  +-- handlers.py           SupportState FSM, 5 команд, 19 callback handlers,
  |                         catch-all text, support group router
  |
  +-- session_manager.py    Lifecycle: get_or_create_session, save_message,
  |                         build_ai_context, resolve/escalate/close,
  |                         save_csat, idle detection, auto-close
  |
  +-- ai_support.py         ai_answer() -- Claude Haiku с KNOWLEDGE_BASE,
  |                         JSON response, confidence scoring
  |
  +-- ai_insights.py        generate_insights() -- AI-анализ метрик
  |                         для daily summary
  |
  +-- notifications.py      build_summary_message(), _get_stock_alerts(),
  |                         send_daily_summaries() -- cron рассылка
  |
  +-- keyboards.py          7 InlineKeyboard: main, support, settings,
  |                         welcome, operator_cancel, after_ai, csat
  |
  +-- support.py            FAQ_TEXTS (3 категории), forward_to_support(),
                            reply_from_support()
```

### Зависимости между модулями

```
handlers.py
  +-- keyboards.py (все 7 клавиатур)
  +-- support.py (FAQ_TEXTS, forward_to_support, reply_from_support)
  +-- notifications.py (build_summary_message)
  +-- ai_support.py (ai_answer, CONFIDENCE_THRESHOLD)
  +-- session_manager.py (все функции lifecycle)
  +-- __init__.py (get_bot, get_support_group_id)

notifications.py
  +-- keyboards.py (main_keyboard)
  +-- ai_insights.py (generate_insights)

session_manager.py
  +-- anthropic (для summarize_conversation)

ai_support.py
  +-- support.py (FAQ_TEXTS для system prompt)
  +-- anthropic

support.py
  +-- __init__.py (get_support_group_id)
  +-- session_manager.py (get_or_create_session, save_message)
```

---

## 4. Database schema

### Миграция 023: Привязка аккаунтов

#### `mp_telegram_links`

| Поле | Тип | Constraints | Описание |
|------|-----|-------------|----------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Первичный ключ |
| user_id | UUID | NOT NULL, UNIQUE, FK auth.users, ON DELETE CASCADE | ID пользователя |
| telegram_chat_id | BIGINT | NOT NULL, UNIQUE | Telegram chat ID |
| telegram_username | VARCHAR(100) | | Telegram username |
| linked_at | TIMESTAMPTZ | DEFAULT NOW() | Дата привязки |
| settings | JSONB | DEFAULT (см. ниже) | Настройки уведомлений |

**Settings JSONB default:**
```json
{
  "daily_summary": true,
  "morning_time": "09:00",
  "evening_enabled": false,
  "evening_time": "21:00",
  "stock_alerts": true
}
```

**RLS:** user own data (SELECT/UPDATE/DELETE) + service_role full access.

**Indexes:**
- `idx_telegram_links_chat_id` -- поиск по chat_id (операции бота)
- `idx_telegram_links_settings` -- GIN индекс на settings JSONB

#### `mp_telegram_link_tokens`

| Поле | Тип | Constraints | Описание |
|------|-----|-------------|----------|
| token | UUID | PK, DEFAULT gen_random_uuid() | Токен (он же PK) |
| user_id | UUID | NOT NULL, FK auth.users, ON DELETE CASCADE | ID пользователя |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Время создания |
| expires_at | TIMESTAMPTZ | DEFAULT NOW() + 5 min | Время истечения |
| used | BOOLEAN | DEFAULT FALSE | Использован ли |

**RLS:** user SELECT own + service_role full access.

**Index:** `idx_telegram_link_tokens_expires` -- (token, used, expires_at)

### Миграция 024: Поддержка

#### `tg_support_sessions`

| Поле | Тип | Constraints | Описание |
|------|-----|-------------|----------|
| session_id | UUID | PK, DEFAULT gen_random_uuid() | ID сессии |
| chat_id | BIGINT | NOT NULL | Telegram chat ID |
| user_id | UUID | FK auth.users, ON DELETE SET NULL | ID пользователя (nullable) |
| status | VARCHAR(20) | NOT NULL, CHECK IN (active, resolved, escalated, closed) | Статус |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Создание |
| last_message_at | TIMESTAMPTZ | DEFAULT NOW() | Последнее сообщение |
| resolved_at | TIMESTAMPTZ | | Время решения |
| closed_at | TIMESTAMPTZ | | Время закрытия |
| conversation_summary | TEXT | | Кешированное резюме (Claude Haiku) |
| escalation_reason | VARCHAR(100) | | Причина эскалации |
| message_count | INT | DEFAULT 0 | Счётчик сообщений |
| ai_confidence_avg | FLOAT | DEFAULT 0.0 | Средняя уверенность AI |

**RLS:** service_role only (бот работает через service_role_key).

**Indexes:**
- `idx_sessions_chat_status` -- (chat_id, status)
- `idx_sessions_last_message` -- (last_message_at) -- для idle detection
- `idx_sessions_status` -- (status) -- для auto_close_resolved

#### `tg_support_messages`

| Поле | Тип | Constraints | Описание |
|------|-----|-------------|----------|
| id | BIGSERIAL | PK | Автоинкремент |
| session_id | UUID | NOT NULL, FK tg_support_sessions, ON DELETE CASCADE | Сессия |
| role | VARCHAR(20) | NOT NULL, CHECK IN (user, bot, operator) | Роль автора |
| content | TEXT | NOT NULL | Текст сообщения |
| confidence | FLOAT | | AI confidence (только для role=bot) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Время |

**Index:** `idx_messages_session` -- (session_id, created_at)

#### `tg_support_csat`

| Поле | Тип | Constraints | Описание |
|------|-----|-------------|----------|
| id | SERIAL | PK | Автоинкремент |
| session_id | UUID | NOT NULL, FK tg_support_sessions, ON DELETE CASCADE | Сессия |
| rating | INT | NOT NULL, CHECK 1-5 | Оценка |
| feedback | TEXT | | Текстовый отзыв |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Время |

---

## 5. Deep linking flow

Привязка аккаунта пользователя к Telegram боту через one-time deep link token.

```
   Frontend (ProfileTab)              Backend                    Telegram Bot
         |                              |                            |
   1. Нажатие "Подключить"              |                            |
         |--- POST /telegram/generate-token -->                      |
         |                              |                            |
         |     Invalidate old tokens    |                            |
         |     Create UUID token        |                            |
         |     expires_at = now + 5 min |                            |
         |                              |                            |
         |<-- { token, link, expires_in: 300 }                       |
         |                              |                            |
   2. Клик "Открыть в Telegram"         |                            |
         |    (link = t.me/RevioMPBot?start=LINK_{token})            |
         |                              |                            |
         |                              |  /start LINK_{token}       |
         |                              |<------ Telegram Cloud -----|
         |                              |                            |
         |                     3. Validate token:                    |
         |                        - SELECT WHERE token=X, used=FALSE |
         |                        - CHECK expires_at > now           |
         |                                                           |
         |                     4. Bind:                              |
         |                        - UPSERT mp_telegram_links         |
         |                        - Mark token used=TRUE             |
         |                              |                            |
         |                              |--- "Аккаунт привязан!" -->|
         |                              |                            |
   5. React Query poll (10s)            |                            |
      GET /telegram/link-status         |                            |
         |--- linked: true ------------>|                            |
         |    Показать настройки        |                            |
```

### Ключевые моменты

- Токен одноразовый (UUID), TTL 5 минут
- При генерации нового токена -- старые неиспользованные помечаются `used=TRUE`
- Привязка: `user_id` UNIQUE -- один пользователь = один Telegram аккаунт
- `telegram_chat_id` UNIQUE -- один Telegram аккаунт = один пользователь
- Если user_id уже привязан -- UPDATE (перепривязка на новый chat)
- Frontend опрашивает `link-status` каждые 10 секунд (`refetchInterval: 10_000`)

---

## 6. Команды бота

| Команда | Handler | Описание | Требует привязки |
|---------|---------|----------|-----------------|
| `/start` | `cmd_start` | Приветствие или deep link binding | Нет |
| `/start LINK_{token}` | `_handle_link` | Привязка аккаунта | Нет |
| `/summary` | `cmd_summary` | Мгновенная сводка продаж | Да |
| `/settings` | `cmd_settings` | Настройки уведомлений | Да |
| `/support` | `cmd_support` | Меню поддержки (FAQ + оператор) | Нет |
| `/help` | `cmd_help` | Справка по командам | Нет |

### Пример ответа `/summary`

```
Утренняя сводка за 2026-02-24

Заказы: 12 (+20.0%)
Выкупы: 8 (66.7%)
Выручка: 15 200 руб (+8.5%)
Прибыль: 3 400 руб (-12.3%) (маржа 22.4%)
Реклама: 1 200 руб (ДРР 7.9%)

Остатки менее 7 дней:
  Тестобустер: 3.2 дн. (15 шт.)

AI-анализ:
Маржинальность упала до 22.4% -- проверьте рост себестоимости.
ДРР 7.9% в зелёной зоне, рекламный бюджет эффективен.

reviomp.ru
```

---

## 7. Callback handlers

| callback_data | Handler | Действие |
|---------------|---------|----------|
| `cmd_summary` | `cb_summary` | Сводка (аналог /summary) |
| `cmd_settings` | `cb_settings` | Настройки (аналог /settings) |
| `cmd_support` | `cb_support` | Меню поддержки |
| `cmd_help` | `cb_help` | Справка |
| `back_main` | `cb_back_main` | Возврат в главное меню, очистка FSM |
| `faq_billing` | `cb_faq` | FAQ: тарифы и оплата |
| `faq_sync` | `cb_faq` | FAQ: синхронизация |
| `faq_errors` | `cb_faq` | FAQ: ошибки и проблемы |
| `support_operator` | `cb_support_operator` | Вход в FSM (ожидание сообщения) |
| `cancel_operator` | `cb_cancel_operator` | Выход из FSM, возврат в меню поддержки |
| `session_resolved` | `cb_session_resolved` | Пометить сессию resolved, показать CSAT |
| `csat_positive` | `cb_csat_positive` | CSAT=5, закрыть сессию |
| `csat_negative` | `cb_csat_negative` | CSAT=1, эскалация + резюме в группу |
| `escalate_operator` | `cb_escalate_operator` | Эскалация после AI-ответа |
| `toggle_morning` | `cb_toggle_morning` | Вкл/выкл утреннюю сводку |
| `toggle_evening` | `cb_toggle_evening` | Вкл/выкл вечернюю сводку |
| `toggle_stock_alerts` | `cb_toggle_stock_alerts` | Вкл/выкл алерты остатков |
| `morning_earlier` | `cb_morning_earlier` | Утро -1 час |
| `morning_later` | `cb_morning_later` | Утро +1 час |
| `evening_earlier` | `cb_evening_earlier` | Вечер -1 час |
| `evening_later` | `cb_evening_later` | Вечер +1 час |

---

## 8. Catch-all (free text)

Handler `handle_free_text` перехватывает все текстовые сообщения в private chat, не matched командами или FSM.

```python
@router.message(F.text)
async def handle_free_text(message: Message, state: FSMContext):
    if message.chat.type != "private":
        return  # Игнорировать группы
    link = _get_user_link(message.chat.id)
    await _handle_ai_support(message, state, question, link)
```

Пользователь может просто написать вопрос в чат -- бот ответит через AI без навигации по меню.

---

## 9. Support group routing

```
Пользователь                     Support Group (-1003297306836)
     |                                        |
     |--- "У меня проблема" -->               |
     |                                        |
     | [AI confidence < 0.7                   |
     |  OR кнопка "Связаться с оператором"]   |
     |                                        |
     |         forward_to_support():          |
     |         1. Header (имя, @username,     |
     |            User ID, Chat ID)           |
     |         2. Forward оригинального msg   |
     |                     -----------------> |
     |                                        |
     |         Оператор reply-ит              |
     |         на forwarded message           |
     |                                        |
     |         reply_from_support():          |
     |         1. Parse Chat ID из header     |
     |         2. bot.send_message(chat_id)   |
     |         3. save_message(operator)      |
     | <-----------------                     |
     |                                        |
     | "Поддержка RevioMP: <ответ>"           |
```

### Формат header сообщения в группу

```
Заявка в поддержку
Пользователь: Иван Иванов (@ivan)
User ID: e2db2023-4ce3-...
Chat ID: 123456789
==============================
```

Оператор отвечает reply на сообщение с header-ом. `reply_from_support()` парсит Chat ID из текста header-а (fallback: `reply.forward_from.id`).

---

## 10. Cron задачи

### send-summaries (*/15 min)

```
Crontab:  */15 * * * * curl -s -X POST https://analitics.bixirun.ru/api/telegram/send-summaries -H "X-Cron-Secret: $SECRET"

Логика:
1. Вычислить текущее MSK время, округлить до 15 минут
2. SELECT * FROM mp_telegram_links
3. Для каждого link:
   - Утренняя сводка: settings.daily_summary=true AND settings.morning_time == target_time
   - Вечерняя сводка: settings.evening_enabled=true AND settings.evening_time == target_time
4. build_summary_message(user_id):
   - RPC get_dashboard_summary (текущий день + предыдущий)
   - _get_stock_alerts (mp_stocks + mp_sales за 30 дней)
   - generate_insights (Claude Haiku AI-анализ)
5. bot.send_message(chat_id, message)
6. Rate limit: 50ms между отправками (Telegram limit 30 msg/sec)
7. Auto-unlink при "blocked"/"chat not found"/"forbidden"
```

### session-cleanup (*/5 min)

```
Crontab:  */5 * * * * curl -s -X POST https://analitics.bixirun.ru/api/telegram/session-cleanup -H "X-Cron-Secret: $SECRET"

Логика:
1. check_idle_sessions():
   - SELECT WHERE status='active' AND last_message_at < now() - 30 min
   - Отправить reminder "Все ещё нужна помощь?"
   - save_message() обновляет last_message_at (предотвращает повторные напоминания)
2. auto_close_resolved():
   - SELECT WHERE status='resolved' AND resolved_at < now() - 2 hours
   - UPDATE status='closed', closed_at=now()
```

---

## 11. API endpoints

Router prefix: `/telegram`. Mounted at `/api` (не `/api/v1`).

| # | Method | Path | Auth | Описание |
|---|--------|------|------|----------|
| 1 | POST | `/webhook` | X-Telegram-Bot-Api-Secret-Token | Webhook от Telegram |
| 2 | POST | `/generate-token` | JWT (CurrentUser) | Генерация deep link токена |
| 3 | GET | `/link-status` | JWT (CurrentUser) | Статус привязки |
| 4 | DELETE | `/unlink` | JWT (CurrentUser) | Отвязка Telegram |
| 5 | PUT | `/settings` | JWT (CurrentUser) | Обновление настроек уведомлений |
| 6 | POST | `/send-summaries` | X-Cron-Secret | Cron: рассылка сводок |
| 7 | POST | `/session-cleanup` | X-Cron-Secret | Cron: idle reminders + auto-close |
| 8 | POST | `/setup-webhook` | X-Cron-Secret | Одноразовая регистрация webhook URL |

### Примеры запросов

#### POST /api/telegram/generate-token
```bash
curl -X POST https://reviomp.ru/api/telegram/generate-token \
  -H "Authorization: Bearer $JWT"
```
Response:
```json
{
  "token": "a1b2c3d4-...",
  "link": "https://t.me/RevioMPBot?start=LINK_a1b2c3d4-...",
  "expires_in": 300
}
```

#### GET /api/telegram/link-status
```bash
curl https://reviomp.ru/api/telegram/link-status \
  -H "Authorization: Bearer $JWT"
```
Response (linked):
```json
{
  "linked": true,
  "telegram_username": "username",
  "settings": {
    "daily_summary": true,
    "morning_time": "09:00",
    "evening_enabled": false,
    "evening_time": "21:00",
    "stock_alerts": true
  },
  "linked_at": "2026-02-25T10:00:00Z"
}
```

#### PUT /api/telegram/settings
```bash
curl -X PUT https://reviomp.ru/api/telegram/settings \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "daily_summary": true,
    "morning_time": "08:00",
    "evening_enabled": true,
    "evening_time": "20:00",
    "stock_alerts": true
  }'
```

---

## 12. Environment variables

| Переменная | Где | Обязательна | Описание |
|-----------|-----|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | `.env` | Да | Token от @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | `.env` | Да | Secret для верификации webhook |
| `TELEGRAM_SUPPORT_GROUP_ID` | `.env` | Нет (default: -1003297306836) | Chat ID группы поддержки |
| `ANTHROPIC_API_KEY` | `.env` | Нет | API key для Claude Haiku (AI support + insights) |
| `SYNC_CRON_SECRET` | `.env` | Да | Secret для cron endpoints (общий с sync) |

При отсутствии `ANTHROPIC_API_KEY` -- AI support и AI insights отключаются (graceful degradation), бот продолжает работать (сводки без AI-анализа, вопросы сразу к оператору).

При отсутствии `TELEGRAM_BOT_TOKEN` -- `get_bot()` выбрасывает `RuntimeError`.
