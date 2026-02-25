# Telegram Bot -- AI-поддержка

> Версия: 2.0 | Обновлено: 25.02.2026
> Модель: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)

---

## Содержание

1. [Обзор архитектуры](#1-обзор-архитектуры)
2. [System prompt и Knowledge Base](#2-system-prompt-и-knowledge-base)
3. [Confidence scoring](#3-confidence-scoring)
4. [Context management](#4-context-management)
5. [Паттерны ответов](#5-паттерны-ответов)
6. [Graceful degradation](#6-graceful-degradation)
7. [Примеры диалогов](#7-примеры-диалогов)
8. [AI Insights (daily summary)](#8-ai-insights-daily-summary)

---

## 1. Обзор архитектуры

```
Пользователь (любой текст)
         |
         v
  handle_free_text() / handle_support_message()
         |
         v
  _handle_ai_support()
         |
  +------+------+
  |             |
  v             v
get_or_create_session()   build_ai_context()
  |                            |
  v                            v
save_message("user")     [history <= 10 msg? full : summary + last 10]
  |                            |
  +------+---------------------+
         |
         v
    ai_answer(question, context, history, first_name)
         |
    Claude Haiku API
    model: claude-haiku-4-5-20251001
    max_tokens: 500, temperature: 0.3
    timeout: 10s
         |
         v
    Regex parse: [CONFIDENCE:X.X] prefix
         |
    +----+----+
    |         |
    v         v
 >= 0.7    < 0.7
    |         |
    v         v
save_message  escalate_session("low_confidence")
("bot")       build_escalation_transcript()
    |         --> группу поддержки (полный транскрипт)
    v
after_ai_keyboard:
  ["Спасибо, помогло!", "Нужна помощь оператора"]
```

### Два входных пути в AI support

1. **Catch-all** (`handle_free_text`) -- пользователь просто пишет текст в чат (без навигации по меню)
2. **FSM** (`handle_support_message`) -- пользователь нажал "Связаться с оператором" и написал сообщение

Оба пути вызывают одну функцию `_handle_ai_support()`.

---

## 2. System prompt и Knowledge Base

Файл: `ai_support.py`, константа `KNOWLEDGE_BASE`.

### Структура system prompt

```
1. Роль: "Ты — ассистент RevioMP" (НЕ "AI-ассистент" — без упоминания ИИ)
2. ХАРАКТЕР: дружелюбный профессионал, краткость, эмпатия, без шаблонных фраз
3. Персонализация: имя пользователя ({user_greeting_rule}), текущее время МСК ({current_time_msk})
4. ПРОДУКТ: описание всех функций (дашборд, UE, мониторинг, план продаж, экспорт)
5. ТАРИФЫ: Free (бесплатно, 3 SKU, WB) / Pro (990 руб/мес, 20 SKU, WB+Ozon)
6. ПОДКЛЮЧЕНИЕ: 3 шага (регистрация, API-токен, синхронизация)
7. FAQ: динамически подставляются из FAQ_TEXTS (faq_billing, faq_sync, faq_errors)
8. ТЕХНИЧЕСКИЕ ДЕТАЛИ: синхронизация, задержки API, формула прибыли, прогноз остатков
9. ПРАВИЛА ОТВЕТА: 1-3 предложения, русский, без markdown, без самоидентификации как ИИ
10. ФОРМАТ ОТВЕТА: [CONFIDENCE:X.X] prefix + свободный текст
```

### Характер бота (v2)

```
ТВОЙ ХАРАКТЕР:
- Дружелюбный и профессиональный. Общайся как опытный коллега, а не как робот.
- Краткость — главное. 1-3 предложения. Если можно ответить одним — одним.
- Если пользователь расстроен — сначала признай проблему, потом решай.
- Никогда не упоминай, что ты ИИ, бот или искусственный интеллект.
- Не выдумывай. Если не знаешь ответ — честно скажи и предложи подключить оператора.
- Не добавляй шаблонные фразы ("Если остались вопросы", "Рад помочь!") в конец ответа.
```

### Персонализация

**Имя пользователя (first_name):**
```python
# handlers.py: извлекается из Telegram message
first_name = message.from_user.first_name

# ai_support.py: передаётся в system prompt
if first_name:
    user_greeting_rule = f"Имя пользователя: {first_name}. Можешь обратиться по имени..."
```

**Время МСК:**
```python
msk_now = datetime.now(timezone(timedelta(hours=3)))
current_time_msk = msk_now.strftime("%H:%M")
# Подставляется в system prompt: "Текущее время (МСК): {current_time_msk}"
```

### Параметры модели

| Параметр | Значение | Причина |
|----------|----------|---------|
| model | claude-haiku-4-5-20251001 | Быстрый, дешёвый, достаточно умный |
| max_tokens | 500 | Лимит вывода (1-3 предложения = ~100-200 токенов) |
| temperature | 0.3 | Низкая — консистентные ответы без "буровления" |
| timeout | 10s | Быстрый fallback при проблемах |

### FAQ Knowledge Base

FAQ тексты берутся из `support.py:FAQ_TEXTS` и подставляются в system prompt:

| Ключ | Тема | Содержание |
|------|------|-----------|
| `faq_billing` | Тарифы и оплата | Free/Pro описание, YooKassa, ссылка на настройки |
| `faq_sync` | Синхронизация | Частота по тарифам, ручная синхронизация, troubleshooting |
| `faq_errors` | Ошибки | Не загружаются данные, несовпадение с ЛК, кеш |

### Пользовательский контекст

В каждый запрос к Claude добавляется обогащённый контекст пользователя (если доступен):

```python
# fetch_user_context() загружает из Supabase:
# 1. Тариф (mp_subscriptions)
# 2. Кол-во товаров (mp_products)
# 3. Подключённые МП (mp_marketplace_tokens)
# 4. Последняя синхронизация (mp_sync_queue)

# Пример: "Контекст пользователя: тариф Pro, подключены: wb, ozon, 5 товаров, последняя синхронизация: 2 ч. назад"
```

---

## 3. Confidence scoring

AI возвращает confidence через `[CONFIDENCE:X.X]` prefix в начале ответа:

```
[CONFIDENCE:0.9] Тариф Pro стоит 990 рублей в месяц...
```

### Парсинг

```python
_CONFIDENCE_RE = re.compile(r"^\[CONFIDENCE:\s*([\d.]+)\]\s*", re.IGNORECASE)

match = _CONFIDENCE_RE.match(raw_text)
if match:
    confidence = float(match.group(1))
    answer = raw_text[match.end():].strip()
else:
    # Fallback: весь текст как ответ
    answer = raw_text
    confidence = 0.5
```

### Шкала

| Диапазон | Значение | Действие |
|----------|----------|----------|
| 0.9 -- 1.0 | Точный ответ из базы знаний | Показать ответ |
| 0.7 -- 0.8 | Вероятно корректный | Показать ответ |
| 0.3 -- 0.6 | Не уверен | Эскалация оператору |
| 0.0 -- 0.2 | Не знает ответа | Эскалация оператору |

**Порог:** `CONFIDENCE_THRESHOLD = 0.7`

Если confidence ниже порога ИЛИ AI вернул пустой ответ (`len(answer) < 5`) -- автоматическая эскалация.

### Rolling average

Средняя confidence сохраняется в `tg_support_sessions.ai_confidence_avg`:
```python
bot_count = max(1, new_count // 2)  # приблизительное число bot-сообщений
updates["ai_confidence_avg"] = round(
    old_avg + (confidence - old_avg) / bot_count, 3
)
```

---

## 4. Context management

### Persistent история в Supabase

Все сообщения сохраняются в `tg_support_messages` с ролями `user`, `bot`, `operator`. История не теряется при перезапуске бота.

### Стратегия контекста

```python
async def build_ai_context(session_id) -> list[dict]:
    messages = await get_session_messages(session_id, limit=50)

    if len(messages) <= 10:
        return _format_messages(messages)  # Полная история
    else:
        summary = await _get_or_create_summary(session_id, messages)
        recent = messages[-10:]
        return [
            {"role": "user", "content": f"[Краткое содержание: {summary}]"},
            {"role": "assistant", "content": "Понял, продолжаю с учётом контекста."},
            *_format_messages(recent),
        ]
```

| Сообщений | Стратегия | Токены (примерно) |
|-----------|-----------|------------------|
| 1 -- 10 | Полная история | ~500-2000 |
| 11+ | Summary (200 tokens) + последние 10 | ~700-2500 |

### Summarization

```python
# Claude Haiku, max_tokens=200, timeout=10s
system = "Сделай краткое резюме диалога поддержки в 2-3 предложениях. "
         "Укажи тему обращения и текущий статус вопроса."
```

Summary кешируется в `tg_support_sessions.conversation_summary`. При следующем вызове -- берётся из кеша (не генерируется повторно).

### Role mapping

| DB role | Claude API role | Примечание |
|---------|----------------|-----------|
| user | user | Прямое соответствие |
| bot | assistant | AI ответы |
| operator | assistant | Ответы оператора тоже как assistant |

Consecutive messages с одной ролью объединяются:
```python
if formatted and formatted[-1]["role"] == api_role:
    formatted[-1]["content"] += f"\n{content}"
```

---

## 5. Паттерны ответов

### Когда AI отвечает сам (confidence >= 0.7)

- Вопросы о тарифах и ценах
- Процесс подключения и настройки
- Синхронизация данных (частота, задержки)
- Общие вопросы о функционале продукта
- Ошибки с известными решениями (кеш, токены)

### Когда AI эскалирует (confidence < 0.7)

- Вопросы о конкретных данных пользователя ("Почему моя выручка упала?")
- Технические баги ("Не работает кнопка X")
- Вопросы вне scope (Amazon, другие маркетплейсы)
- Запросы на возврат средств
- Неоднозначные или сложные вопросы

### Формат ответа AI

- Обычный текст (без Markdown, без HTML)
- 1-3 предложения (максимум 4 для сложных тем)
- Русский язык
- БЕЗ шаблонного footer-а (кнопки после ответа достаточно)
- Если не знает -- честно говорит и предлагает оператора

### Что изменилось в v2

| Было (v1) | Стало (v2) |
|-----------|-----------|
| JSON формат `{"answer": "...", "confidence": 0.0}` | `[CONFIDENCE:X.X]` prefix + свободный текст |
| "Ты — AI-ассистент" | "Ты — ассистент RevioMP" (без упоминания ИИ) |
| 2-5 предложений | 1-3 предложения (краткость) |
| Шаблонный footer "Ответ сформирован AI-ассистентом" | Без footer-а (кнопки достаточно) |
| temperature не задан (default 1.0) | temperature=0.3 (консистентность) |
| Без имени пользователя | first_name из Telegram (персонализация) |
| Без времени | Текущее время МСК в system prompt |
| Резюме при эскалации | Полный транскрипт диалога при эскалации |

---

## 6. Graceful degradation

### Уровни отказа

| Ситуация | Поведение |
|----------|-----------|
| `ANTHROPIC_API_KEY` не задан | `ai_answer` возвращает `("", 0.0)` -- прямая эскалация |
| API timeout (10s) | `("", 0.0)` -- эскалация |
| Anthropic API error | `("", 0.0)` -- эскалация |
| [CONFIDENCE] prefix не найден | Весь текст как answer, confidence=0.5 |
| Пустой/короткий ответ (< 5 символов) | `("", 0.0)` -- эскалация |
| session_id = None | `save_message`, `build_ai_context` и др. -- no-op (return без ошибки) |
| Supabase error в session_manager | Логирование + fallback dict `{session_id: None}` |
| Forward в группу failed | Fallback на `forward_to_support()`, затем сообщение пользователю |

### Принцип

Бот НИКОГДА не крашится из-за AI-ошибок. При любом сбое -- graceful fallback на оператора или сообщение об ошибке.

---

## 7. Примеры диалогов

### FAQ (confidence ~0.9)

```
User: Сколько стоит Pro тариф?
Bot:  Pro — 990 руб/мес. До 20 SKU, WB + Ozon, FBS-аналитика,
      синхронизация каждые 6 часов.

      [Спасибо, помогло!] [Нужна помощь оператора]
```

### Персонализированный ответ (confidence ~0.85)

```
User: Как подключить Ozon?  (first_name: Алексей)
Bot:  Алексей, зайдите в настройки (reviomp.ru/settings),
      вкладка "Подключения". Вставьте Client-ID и API-ключ из ЛК Ozon Seller.

      [Спасибо, помогло!] [Нужна помощь оператора]
```

### Техподдержка (confidence ~0.75)

```
User: Данные не обновляются уже 2 дня
Bot:  Проверьте API-токены в настройках — WB и Ozon периодически
      требуют обновления. После сохранения новых токенов
      подождите до 30 минут.

      [Спасибо, помогло!] [Нужна помощь оператора]
```

### Эскалация (confidence ~0.4)

```
User: Почему прибыль за вчера отличается от кабинета WB?
Bot:  [CONFIDENCE:0.4] → автоматическая эскалация
      Полный транскрипт диалога → группа поддержки

      "Передаю ваш вопрос оператору. Ответим в ближайшее время."
```

### Продолжение диалога (контекст)

```
User: Как подключить Ozon?
Bot:  Зайдите в настройки reviomp.ru/settings, вкладка "Подключения".
      Вставьте Client-ID и API-ключ из ЛК Ozon Seller.

User: А какие права нужны?
Bot:  [Использует контекст предыдущих сообщений]
      Аналитика, Финансы, Товары, Склад — только чтение. Запись не нужна.
```

---

## 8. AI Insights (daily summary)

Файл: `ai_insights.py`. Генерирует 1-3 предложения анализа для ежедневной сводки.

### Архитектура

```
notifications.py:build_summary_message()
         |
    current_metrics + prev_metrics + stock_alerts
         |
         v
  ai_insights.py:generate_insights()
         |
    Claude Haiku API
    model: claude-haiku-4-5-20251001
    max_tokens: 300
    timeout: 10s
         |
         v
    1-3 строки анализа (plain text)
```

### System prompt (INSIGHTS_SYSTEM_PROMPT)

```
Роль: AI-аналитик RevioMP
Входные данные: текущие и предыдущие метрики за день
Задача: 1-3 коротких предложения

Бенчмарки:
  ДРР:    < 10% хорошо, 10-15% средне, > 15% плохо
  Маржа:  > 25% хорошо, 15-25% средне, < 15% плохо
  Выкуп:  > 70% норма для WB
  Остатки: < 7 дней критично, < 14 предупреждение

Формат: plain text, без markdown/HTML, русский
Числа: с пробелом-разделителем (1 000)
Не повторять цифры из сводки -- давать АНАЛИЗ
```

### Метрики для анализа

Текущий период:
```
orders, sales, revenue, profit, ad_cost, drr, margin, buyout_pct
```

Предыдущий период:
```
orders, revenue, profit
```

Stock alerts (до 5):
```
name, days (дней запаса), quantity (штук)
```

### Fallback

При ошибке AI insights -- сводка отправляется без блока "AI-анализ" (graceful degradation). Ошибка логируется как warning.
