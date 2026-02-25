# Telegram Bot -- Обзор модуля

> Версия: 1.0 | Обновлено: 25.02.2026
> Bot: [@RevioMPBot](https://t.me/RevioMPBot)

---

## Назначение

Telegram-бот RevioMP обеспечивает три функции:

1. **Ежедневные сводки** -- метрики продаж WB + Ozon с AI-анализом
2. **AI-поддержка** -- автоответчик на вопросы (Claude Haiku) с эскалацией оператору
3. **Алерты остатков** -- уведомления при запасе менее 7 дней

---

## Архитектура

```
                        Telegram Cloud
                             |
                   X-Telegram-Bot-Api-Secret-Token
                             |
                             v
              +-----------------------------+
              |        Nginx (443)          |
              |  /api/telegram/webhook      |
              +-------------+---------------+
                            |
                            v
              +-----------------------------+
              |     FastAPI (:8000)         |
              |  telegram.py (8 endpoints)  |
              +--------+--+--+-------------+
                       |  |  |
            +----------+  |  +----------+
            v             v             v
    +-------------+ +----------+ +-----------+
    | aiogram 3   | | Supabase | | Anthropic |
    | Bot + FSM   | | 5 tables | | Claude    |
    | Dispatcher  | | + RLS    | | Haiku     |
    +-------------+ +----------+ +-----------+

    Cron (systemd timer):
    */15 min --> POST /api/telegram/send-summaries
    */5 min  --> POST /api/telegram/session-cleanup
```

### Ключевые решения

| Решение | Выбор | Обоснование |
|---------|-------|-------------|
| Режим работы | Webhook (не polling) | 0 дополнительных процессов на 1-ядерном VPS |
| Фреймворк | aiogram 3 | Async-native, встроенный FSM, webhook support |
| AI модель | Claude Haiku 4.5 | Быстрый (< 1s), дешевый, достаточный для FAQ |
| Хранение сессий | Supabase (не in-memory) | Персистентность, переживает рестарт |
| Webhook URL | analitics.bixirun.ru | Telegram DNS не резолвит reviomp.ru |

---

## Структура модуля

```
backend/app/telegram/
  __init__.py          -- Bot + Dispatcher синглтоны (57 строк)
  handlers.py          -- Команды, callbacks, FSM, catch-all (814 строк)
  session_manager.py   -- Lifecycle сессий, AI context (498 строк)
  ai_support.py        -- Claude Haiku auto-responder (187 строк)
  ai_insights.py       -- AI-анализ для daily summary (141 строка)
  notifications.py     -- Сборка сводки, stock alerts, рассылка (350 строк)
  keyboards.py         -- 7 InlineKeyboard билдеров (125 строк)
  support.py           -- FAQ тексты, forward/reply routing (151 строка)

backend/app/api/v1/telegram.py  -- 8 API endpoints (341 строка)
backend/migrations/023_telegram.sql      -- Таблицы привязки
backend/migrations/024_support_sessions.sql -- Таблицы поддержки
backend/tests/test_support_sessions.py   -- 18 тестов (264 строки)

frontend/src/components/Settings/TelegramSection.tsx -- UI привязки (330 строк)
frontend/src/services/api.ts (строки 606-632)        -- API layer
frontend/src/types/index.ts (строки 809-828)          -- TypeScript типы
```

**Итого:** 3386 строк кода, 11 backend файлов, 1 frontend компонент, 2 миграции.

---

## Database (5 таблиц)

| Таблица | Миграция | Назначение |
|---------|----------|-----------|
| `mp_telegram_links` | 023 | Привязка user <-> Telegram chat |
| `mp_telegram_link_tokens` | 023 | Одноразовые deep link токены (TTL 5 мин) |
| `tg_support_sessions` | 024 | Сессии поддержки (lifecycle) |
| `tg_support_messages` | 024 | Сообщения в сессиях (user/bot/operator) |
| `tg_support_csat` | 024 | Оценки качества поддержки (1-5) |

---

## Документация

| Документ | Содержание |
|----------|-----------|
| [bot-architecture.md](bot-architecture.md) | Webhook pipeline, FSM, DB schema, deep linking, cron, env vars |
| [ai-support.md](ai-support.md) | AI-ассистент: prompt, confidence, context management, degradation |
| [support-system.md](support-system.md) | Lifecycle сессий, CSAT, idle detection, эскалация, operator flow |
| [notifications.md](notifications.md) | Daily summary, AI insights, stock alerts, расписание |
| [deployment.md](deployment.md) | Nginx, systemd, crontab, env variables, troubleshooting |
