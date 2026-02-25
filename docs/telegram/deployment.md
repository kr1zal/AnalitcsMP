# Telegram Bot -- Деплой и конфигурация

> Версия: 1.0 | Обновлено: 25.02.2026
> VPS: Beget (83.222.16.15), Ubuntu 24.04

---

## Содержание

1. [Nginx конфигурация](#1-nginx-конфигурация)
2. [Systemd](#2-systemd)
3. [Crontab](#3-crontab)
4. [Environment variables](#4-environment-variables)
5. [Миграции](#5-миграции)
6. [Setup webhook](#6-setup-webhook)
7. [Troubleshooting](#7-troubleshooting)
8. [Мониторинг](#8-мониторинг)

---

## 1. Nginx конфигурация

Webhook endpoint проксируется через Nginx вместе с остальными API endpoints.

```nginx
# /etc/nginx/sites-available/analytics

server {
    listen 443 ssl;
    server_name analitics.bixirun.ru;

    # ... SSL конфиг ...

    # API проксирование (включая /api/telegram/webhook)
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Telegram отправляет webhook на `https://analitics.bixirun.ru/api/telegram/webhook`. Используется `analitics.bixirun.ru` (не `reviomp.ru`) из-за DNS-проблем -- Telegram не может резолвить reviomp.ru.

---

## 2. Systemd

Telegram бот работает внутри основного FastAPI процесса (0 дополнительных процессов).

```ini
# /etc/systemd/system/analytics-api.service

[Unit]
Description=Analytics Dashboard API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/analytics/backend
ExecStart=/var/www/analytics/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
EnvironmentFile=/var/www/analytics/backend/.env

[Install]
WantedBy=multi-user.target
```

При `dp.feed_update()` aiogram обрабатывает updates синхронно внутри FastAPI request lifecycle -- нет отдельного процесса бота.

---

## 3. Crontab

```cron
# /etc/crontab или crontab -e

# Telegram daily summaries (каждые 15 минут)
*/15 * * * * curl -s -X POST https://analitics.bixirun.ru/api/telegram/send-summaries -H "X-Cron-Secret: $SYNC_CRON_SECRET" > /dev/null 2>&1

# Telegram session cleanup (каждые 5 минут)
*/5 * * * * curl -s -X POST https://analitics.bixirun.ru/api/telegram/session-cleanup -H "X-Cron-Secret: $SYNC_CRON_SECRET" > /dev/null 2>&1

# Sync queue processing (каждые 30 минут) -- НЕ Telegram, но общий secret
*/30 * * * * curl -s -X POST https://analitics.bixirun.ru/api/v1/sync/process-queue -H "X-Cron-Secret: $SYNC_CRON_SECRET" -H "X-Cron-User-Id: system" > /dev/null 2>&1
```

Все три cron endpoint-а используют один и тот же `SYNC_CRON_SECRET` для авторизации.

---

## 4. Environment variables

Файл: `/var/www/analytics/backend/.env`

```bash
# === Telegram Bot ===
TELEGRAM_BOT_TOKEN=...          # Token от @BotFather
TELEGRAM_WEBHOOK_SECRET=...     # Произвольная строка для верификации webhook
TELEGRAM_SUPPORT_GROUP_ID=-1003297306836  # Chat ID группы поддержки

# === AI (Claude Haiku) ===
ANTHROPIC_API_KEY=...           # API key от Anthropic

# === Cron Auth (общий для sync и telegram) ===
SYNC_CRON_SECRET=...            # Секрет для X-Cron-Secret header
```

### Маппинг на config.py

```python
# backend/app/config.py
class Settings(BaseSettings):
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""
    telegram_support_group_id: str = "-1003297306836"
    anthropic_api_key: str = ""
    sync_cron_secret: str = ""
```

---

## 5. Миграции

### Запуск на VPS

```bash
# SSH на VPS
ssh root@83.222.16.15

# Миграция 023: привязка аккаунтов
psql "$DATABASE_URL" < /var/www/analytics/backend/migrations/023_telegram.sql

# Миграция 024: поддержка
psql "$DATABASE_URL" < /var/www/analytics/backend/migrations/024_support_sessions.sql
```

Или через Supabase SQL Editor (Dashboard -> SQL).

### Проверка

```sql
-- Проверить таблицы
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'mp_telegram%' OR table_name LIKE 'tg_support%';

-- Ожидаемый результат: 5 таблиц
-- mp_telegram_links
-- mp_telegram_link_tokens
-- tg_support_sessions
-- tg_support_messages
-- tg_support_csat
```

---

## 6. Setup webhook

Одноразовая регистрация webhook URL при первом деплое или смене домена.

```bash
curl -X POST https://analitics.bixirun.ru/api/telegram/setup-webhook \
  -H "X-Cron-Secret: $SYNC_CRON_SECRET"
```

Response:
```json
{
  "status": "ok",
  "webhook_url": "https://analitics.bixirun.ru/api/telegram/webhook",
  "has_secret": true
}
```

### Что делает endpoint

```python
await bot.set_webhook(
    url="https://analitics.bixirun.ru/api/telegram/webhook",
    secret_token=secret or None,    # Telegram будет слать в header
    drop_pending_updates=True,       # Не обрабатывать старые updates
)
```

### Проверка webhook

```bash
# Через Telegram API напрямую
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Ожидаемый результат:
```json
{
  "ok": true,
  "result": {
    "url": "https://analitics.bixirun.ru/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": null
  }
}
```

---

## 7. Troubleshooting

### Бот не отвечает

1. **Проверить webhook:**
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
   ```
   - `url` должен быть `https://analitics.bixirun.ru/api/telegram/webhook`
   - `last_error_message` покажет причину ошибки

2. **Проверить API доступность:**
   ```bash
   curl -I https://analitics.bixirun.ru/api/telegram/webhook
   # Должен вернуть 403 (нет secret) или 422 (нет body)
   ```

3. **Проверить логи:**
   ```bash
   journalctl -u analytics-api -n 100 --no-pager | grep -i telegram
   ```

4. **Проверить .env:**
   ```bash
   grep TELEGRAM /var/www/analytics/backend/.env
   # Все переменные должны быть заданы
   ```

### Сводки не приходят

1. **Проверить привязку в DB:**
   ```sql
   SELECT * FROM mp_telegram_links;
   ```

2. **Проверить cron:**
   ```bash
   crontab -l | grep send-summaries
   ```

3. **Ручной вызов cron:**
   ```bash
   curl -X POST https://analitics.bixirun.ru/api/telegram/send-summaries \
     -H "X-Cron-Secret: $SECRET"
   ```
   Проверить `sent`, `errors`, `skipped` в ответе.

4. **Проверить логи:**
   ```bash
   journalctl -u analytics-api -n 100 | grep "Daily summaries"
   ```

### AI не отвечает

1. **Проверить ANTHROPIC_API_KEY в .env**
2. **Проверить логи:**
   ```bash
   journalctl -u analytics-api | grep -i "AI support\|anthropic"
   ```
3. **Timeout:** Claude Haiku имеет timeout 10 секунд. При частых timeout-ах -- проверить сеть VPS.

### Оператор не получает заявки

1. **Проверить TELEGRAM_SUPPORT_GROUP_ID** (должен начинаться с `-100`)
2. **Бот должен быть администратором группы**
3. **Проверить логи:**
   ```bash
   journalctl -u analytics-api | grep "forward.*support\|escalat"
   ```

### Deep link не работает

1. **Проверить TTL токена** (5 минут)
2. **Frontend polling:** `refetchInterval: 10_000` -- React Query опрашивает link-status каждые 10 секунд
3. **Проверить в DB:**
   ```sql
   SELECT * FROM mp_telegram_link_tokens WHERE used = false ORDER BY created_at DESC LIMIT 5;
   ```

---

## 8. Мониторинг

### Ключевые метрики

| Метрика | Как проверить |
|---------|--------------|
| Webhook alive | `getWebhookInfo` -> `pending_update_count` должен быть ~0 |
| Сводки работают | Логи: "Daily summaries cron: {sent: N}" |
| Session cleanup | Логи: "Session cleanup cron: {idle_reminded: N, auto_closed: N}" |
| AI support | Логи: "AI support answer: confidence=X.XX" |
| Ошибки | `journalctl -u analytics-api \| grep -i error \| grep telegram` |

### Полезные SQL запросы

```sql
-- Активные сессии поддержки
SELECT session_id, chat_id, status, message_count, last_message_at
FROM tg_support_sessions
WHERE status IN ('active', 'resolved')
ORDER BY last_message_at DESC;

-- CSAT статистика
SELECT
  COUNT(*) as total,
  ROUND(AVG(rating), 2) as avg_rating,
  COUNT(*) FILTER (WHERE rating >= 4) as positive,
  COUNT(*) FILTER (WHERE rating <= 2) as negative
FROM tg_support_csat;

-- Привязанные аккаунты
SELECT COUNT(*) as linked_users FROM mp_telegram_links;

-- Средняя confidence AI
SELECT
  ROUND(AVG(ai_confidence_avg), 3) as avg_confidence,
  COUNT(*) as total_sessions
FROM tg_support_sessions
WHERE ai_confidence_avg > 0;
```

### Логи

```bash
# Все Telegram логи
journalctl -u analytics-api --since "1 hour ago" | grep -i telegram

# Только ошибки
journalctl -u analytics-api --since "1 hour ago" | grep -i "telegram.*error"

# AI support
journalctl -u analytics-api --since "1 hour ago" | grep "AI support"

# Cron результаты
journalctl -u analytics-api --since "1 hour ago" | grep "cron:"
```
