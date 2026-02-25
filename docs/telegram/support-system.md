# Telegram Bot -- Система техподдержки

> Версия: 2.0 | Обновлено: 25.02.2026

---

## Содержание

1. [Session lifecycle](#1-session-lifecycle)
2. [CSAT система](#2-csat-система)
3. [Idle detection и auto-close](#3-idle-detection-и-auto-close)
4. [Эскалация в группу поддержки](#4-эскалация-в-группу-поддержки)
5. [Operator flow](#5-operator-flow)
6. [Rate limiting и anti-spam](#6-rate-limiting-и-anti-spam)
7. [Тестирование](#7-тестирование)

---

## 1. Session lifecycle

### Диаграмма состояний

```
                     +--------+
          create     |        |
     +-------------->| active |<-----------+
     |               |        |            |
     |               +---+----+            |
     |                   |                 |
     |        resolve    |    escalate     |   reopen
     |     (user click   |  (low conf     |  (новое сообщение
     |      / idle rem)  |   / user req   |   в resolved session
     |                   |   / neg csat)  |   < 2 часов)
     |                   |                |
     |            +------+------+         |
     |            |             |         |
     |            v             v         |
     |     +----------+   +-----------+   |
     |     | resolved |   | escalated |   |
     |     +----+-----+   +-----------+   |
     |          |                         |
     |          +-- новое сообщение ------+
     |          |
     |    auto-close (cron, 2 часа)
     |    OR csat_positive
     |          |
     |          v
     |     +--------+
     |     | closed |
     |     +--------+
     |
     +-- get_or_create_session()
         (closed session -> создать новую)
```

### Правила переходов

| Из | В | Триггер | Условие |
|----|---|---------|---------|
| -- | active | Первое сообщение | Нет active/resolved сессий для chat_id |
| active | resolved | callback `session_resolved` | Пользователь нажал "Спасибо, помогло!" |
| active | resolved | idle reminder | Cron: 1 напоминание, затем resolve (не повторяется) |
| active | escalated | low_confidence / user_request / negative_csat | AI не уверен или пользователь эскалирует |
| resolved | active | Новое сообщение | Сессия ещё не stale (< 2 часов) |
| resolved | closed | auto_close_resolved() | `resolved_at < now - 2 часов` (cron) |
| resolved | closed | csat_positive | Пользователь оценил "Отлично, спасибо!" |
| closed | -- | -- | Терминальное состояние. Новое сообщение = новая сессия |

### Функции session_manager.py

| Функция | Назначение | Возвращает |
|---------|-----------|-----------|
| `get_or_create_session(chat_id, user_id)` | Найти active/resolved или создать новую | `{session_id, status, message_count}` |
| `save_message(session_id, role, content, confidence)` | Сохранить сообщение + обновить stats | `None` |
| `build_ai_context(session_id)` | Построить историю для Claude API | `list[dict]` |
| `build_escalation_transcript(session_id)` | Полный транскрипт диалога для оператора | `str` |
| `resolve_session(session_id)` | Установить status=resolved | `None` |
| `escalate_session(session_id, reason)` | Установить status=escalated | `None` |
| `close_session(session_id)` | Установить status=closed | `None` |
| `save_csat(session_id, rating, feedback)` | Сохранить оценку | `None` |
| `get_last_resolved_session(chat_id)` | Найти последнюю resolved/escalated | `dict or None` |
| `check_idle_sessions()` | Найти active сессии с idle > 30 мин | `list[dict]` |
| `auto_close_resolved()` | Закрыть resolved сессии старше 2 часов | `int` (кол-во) |
| `summarize_conversation(session_id)` | Сгенерировать резюме (Claude Haiku) | `str or None` |

### Константы

```python
_SESSION_STALE_HOURS = 2   # Resolved сессия считается stale через 2 часа
_IDLE_MINUTES = 30         # Порог idle для reminder (30 минут)
_AUTO_CLOSE_HOURS = 2      # Auto-close resolved сессий через 2 часа
```

---

## 2. CSAT система

### Flow (3-level)

```
[AI ответил]
     |
     v
after_ai_keyboard:
  ["Спасибо, помогло!", "Нужна помощь оператора"]
     |
     +-- "Спасибо, помогло!" --> resolve_session()
     |                              |
     |                              v
     |                        csat_keyboard (3 уровня):
     |                        ["Отлично, спасибо!", "Помогло частично", "Не помогло"]
     |                              |
     |               +--------------+--------------+
     |               |              |              |
     |               v              v              v
     |        csat_positive    csat_partial    csat_negative
     |        save_csat(5)    save_csat(3)    save_csat(1)
     |        close_session() close_session() escalate_session("negative_csat")
     |                        ask feedback    build_escalation_transcript()
     |                                        --> группу поддержки
     |                                        ask feedback
     |
     +-- "Нужна помощь оператора" --> escalate_session("user_request")
                                      build_escalation_transcript()
                                      --> группу поддержки
```

### Оценки

| Действие | Rating | Следствие |
|----------|--------|-----------|
| "Отлично, спасибо!" | 5 | Сессия закрывается (closed) |
| "Помогло частично" | 3 | Сессия закрывается + запрос текстового feedback |
| "Не помогло" | 1 | Эскалация + полный транскрипт в группу + запрос feedback |

### Текстовый feedback (P5)

После "Помогло частично" и "Не помогло" бот запрашивает текстовый отзыв:

```
FSM: SupportState.waiting_for_csat_feedback

User: "Ответ был неполный, хотелось больше деталей"
  → save to tg_support_csat.feedback
  → "Спасибо за обратную связь!"
```

Пользователь может пропустить feedback нажав /start.

### Fallback для CSAT callbacks

Если FSM state не содержит session_id (например, после idle reminder от cron -- state пуст):

- `csat_positive`: `get_last_resolved_session(chat_id)` -- найти последнюю resolved
- `csat_partial`: аналогично
- `csat_negative`: аналогично
- `session_resolved`: `get_or_create_session(chat_id)` -- найти active

### Хранение

```sql
-- tg_support_csat
INSERT INTO tg_support_csat (session_id, rating, feedback) VALUES ($1, $2, $3);
```

Таблица `tg_support_csat` позволяет несколько оценок на одну сессию (дизайн на случай переоткрытия).

---

## 3. Idle detection и auto-close

### Idle detection -- 1 reminder max (cron */5 min)

```
check_idle_sessions():
  SELECT session_id, chat_id
  FROM tg_support_sessions
  WHERE status = 'active'
    AND last_message_at < now() - 30 min
```

Для каждой idle сессии:
1. Отправить reminder: "Всё ещё нужна помощь? Если вопрос решён — нажмите кнопку ниже."
2. Показать `after_ai_keyboard` (["Спасибо, помогло!", "Нужна помощь оператора"])
3. **`resolve_session(session_id)`** -- переводит в resolved

**Ключевое отличие от v1:** вместо `save_message()` (который обновлял `last_message_at` и через 30 мин приводил к повторному reminder) вызывается `resolve_session()`. Resolved сессии НЕ попадают в `check_idle_sessions()` (фильтр `status = 'active'`), поэтому повторных напоминаний НЕ будет.

Если пользователь ответит на reminder -- `get_or_create_session()` переоткроет resolved сессию в active.

### Auto-close resolved (cron */5 min)

```
auto_close_resolved():
  SELECT session_id
  FROM tg_support_sessions
  WHERE status = 'resolved'
    AND resolved_at < now() - 2 hours

  UPDATE status = 'closed', closed_at = now()
```

Resolved сессии (от idle reminder или пользовательского "Спасибо, помогло!") закрываются автоматически через 2 часа.

### Timeline пример (v2)

```
00:00  Пользователь пишет вопрос (session created, status=active)
00:00  AI отвечает (save_message, last_message_at обновлено)
00:30  Cron: idle check -> last_message_at = 00:00, > 30 мин -> reminder
00:30  resolve_session() -> status=resolved (больше НЕ попадёт в idle check)
02:30  Cron: auto_close -> resolved_at = 00:30, > 2ч -> status=closed

Альтернатива: пользователь ответил в 00:45
00:45  Новое сообщение -> get_or_create_session() -> reopen (resolved → active)
00:45  AI отвечает -> save_message -> last_message_at = 00:45
01:15  Cron: idle check -> > 30 мин -> reminder -> resolve -> ...
```

---

## 4. Эскалация в группу поддержки

### Триггеры эскалации

| Триггер | Причина (escalation_reason) | Source |
|---------|---------------------------|--------|
| AI confidence < 0.7 | `low_confidence` | `_handle_ai_support()` |
| Кнопка "Нужна помощь оператора" | `user_request` | `cb_escalate_operator()` |
| Отрицательная CSAT | `negative_csat` | `cb_csat_negative()` |

### Формат сообщения в группу -- полный транскрипт (v2)

Во всех случаях эскалации отправляется **полный транскрипт диалога** (НЕ summary):

```python
transcript = await build_escalation_transcript(session_id)
```

#### При прямой эскалации (low_confidence)
```
Заявка в поддержку (AI не уверен)
Пользователь: Иван Иванов (@ivan)
User ID: e2db2023-...
Chat ID: 123456789
==============================

[Полный транскрипт диалога]
```

#### При эскалации после AI (user_request)
```
Заявка в поддержку (после AI-ответа)
Пользователь: Иван Иванов (@ivan)
User ID: e2db2023-...
Chat ID: 123456789
==============================

[Полный транскрипт диалога]
```

#### При негативной CSAT
```
Эскалация (отрицательная оценка)
Пользователь: Иван Иванов (@ivan)
User ID: e2db2023-...
Chat ID: 123456789
==============================

[Полный транскрипт диалога]
```

### Что изменилось в v2

| Было (v1) | Стало (v2) |
|-----------|-----------|
| `summarize_conversation()` -- краткое резюме от Claude Haiku | `build_escalation_transcript()` -- полный транскрипт |
| Оператор видел только саммари | Оператор видит всю переписку |
| Потеря контекста при сложных диалогах | Полная картина для оператора |

### Support group

- Chat ID: `-1003297306836`
- Конфигурируется через `TELEGRAM_SUPPORT_GROUP_ID` в `.env`
- Бот должен быть администратором группы

---

## 5. Operator flow

### Как оператор отвечает

```
1. Оператор видит заявку в группе поддержки (header + транскрипт)
2. Оператор reply-ит на сообщение с header-ом
3. support_group_router ловит reply_to_message
4. reply_from_support() парсит Chat ID из header-а
5. bot.send_message(user_chat_id, ответ)
6. save_message(session_id, "operator", text) -- best effort
```

### Парсинг Chat ID

```python
# Приоритет 1: из текста header-а
if reply.text and "Chat ID:" in reply.text:
    # Parse "Chat ID: 123456789"
    # Strip HTML code tags if present

# Приоритет 2: из forward_from (fallback)
if not user_chat_id and reply.forward_from:
    user_chat_id = reply.forward_from.id
```

### Сохранение ответа оператора

```python
# Best effort -- ошибка не блокирует отправку ответа
session = await get_or_create_session(user_chat_id)
await save_message(session_id, "operator", reply_text)
```

Ответы оператора сохраняются с `role='operator'` в `tg_support_messages`. При построении AI context (build_ai_context) роль `operator` маппится в `assistant` -- Claude видит ответы оператора как свои.

### Подтверждение

После успешной отправки ответа пользователю бот reply-ит в группу: "Ответ отправлен пользователю."

---

## 6. Rate limiting и anti-spam

### Telegram API rate limits

- Рассылка сводок: `asyncio.sleep(0.05)` между отправками (50ms = 20 msg/sec, Telegram limit: 30 msg/sec)

### Idle reminder -- 1 max

- `resolve_session()` после reminder -- сессия выходит из `check_idle_sessions()` фильтра (`status='active'`)
- Повторных напоминаний НЕ будет (resolved != active)
- Если пользователь ответит -- сессия переоткроется, новый цикл AI → idle → reminder → resolve

### Auto-unlink при блокировке

```python
if "blocked" in error_msg or "chat not found" in error_msg or "forbidden" in error_msg:
    supabase.table("mp_telegram_links").delete().eq("user_id", user_id).execute()
```

При ошибке отправки сводки с признаком блокировки -- автоматическое удаление привязки.

### Группа: фильтрация по chat_id

```python
@support_group_router.message(F.reply_to_message)
async def handle_support_reply(message: Message):
    group_id = get_support_group_id()
    if message.chat.id != group_id:
        return  # Игнорировать другие группы
```

---

## 7. Тестирование

### Покрытие

Файл: `backend/tests/test_support_sessions.py` (264 строки, 18 тестов).

| # | Тест | Описание |
|---|------|----------|
| 01 | session_creation | Создание сессии, проверка в DB |
| 02 | save_message | Сохранение сообщения, message_count |
| 03 | ai_answer | AI ответ с историей, confidence |
| 04 | context_continuity | 4 сообщения, avg_confidence |
| 05 | same_session | Повторный get_or_create = та же сессия |
| 06 | resolve | resolve_session, статус + timestamp |
| 07 | reopen | Resolved сессия переоткрывается |
| 08 | csat | save_csat(5), проверка в DB |
| 09 | close | close_session, статус + timestamp |
| 10 | new_after_close | Новая сессия после closed |
| 11 | escalation | escalate с reason, проверка в DB |
| 12 | last_resolved | get_last_resolved_session |
| 13 | graceful_degradation | Все функции с None inputs |
| 14 | context_format | Валидация Claude API формата |
| 15 | idle_detection | Closed/escalated не в idle list |
| 16 | auto_close | auto_close_resolved выполняется |
| 17 | confidence_boundary | AI confidence для edge case |
| 18 | operator_mapping | operator -> assistant в context |

### Запуск

```bash
# На VPS (требуется Supabase и Anthropic API):
cd /var/www/analytics/backend
python -m tests.test_support_sessions
```

### Что не покрыто тестами

- `notifications.py` -- build_summary_message, send_daily_summaries
- `keyboards.py` -- визуальный вывод клавиатур
- `handlers.py` -- callback handlers, webhook endpoint
- Frontend: TelegramSection.tsx
