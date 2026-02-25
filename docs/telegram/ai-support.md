# Telegram Bot -- AI-поддержка

> Версия: 1.0 | Обновлено: 25.02.2026
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
    ai_answer(question, context, history)
         |
    Claude Haiku API
    model: claude-haiku-4-5-20251001
    max_tokens: 500
    timeout: 10s
         |
         v
    JSON parse: {"answer": "...", "confidence": 0.0-1.0}
         |
    +----+----+
    |         |
    v         v
 >= 0.7    < 0.7
    |         |
    v         v
save_message  escalate_session("low_confidence")
("bot")       forward_to_support()
    |
    v
after_ai_keyboard:
  ["Вопрос решён", "Связаться с оператором"]
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
1. Роль: "Ты — AI-ассистент службы поддержки RevioMP"
2. ПРОДУКТ: описание всех функций (дашборд, UE, мониторинг, план продаж, экспорт)
3. ТАРИФЫ: Free (бесплатно, 3 SKU, WB) / Pro (990 руб/мес, 20 SKU, WB+Ozon)
4. ПОДКЛЮЧЕНИЕ: 3 шага (регистрация, API-токен, синхронизация)
5. FAQ: динамически подставляются из FAQ_TEXTS (faq_billing, faq_sync, faq_errors)
6. ТЕХНИЧЕСКИЕ ДЕТАЛИ: синхронизация, задержки API, формула прибыли, прогноз остатков
7. ПРАВИЛА ОТВЕТА: кратко, 2-5 предложений, русский, без markdown
8. ФОРМАТ ОТВЕТА: JSON {"answer": "...", "confidence": 0.0-1.0}
```

### FAQ Knowledge Base

FAQ тексты берутся из `support.py:FAQ_TEXTS` и подставляются в system prompt:

| Ключ | Тема | Содержание |
|------|------|-----------|
| `faq_billing` | Тарифы и оплата | Free/Pro описание, YooKassa, ссылка на настройки |
| `faq_sync` | Синхронизация | Частота по тарифам, ручная синхронизация, troubleshooting |
| `faq_errors` | Ошибки | Не загружаются данные, несовпадение с ЛК, кеш |

### Пользовательский контекст

В каждый запрос к Claude добавляется контекст пользователя (если доступен):
```python
user_context = ""
if context.get("plan"):
    user_context += f"Тариф пользователя: {context['plan']}"
if context.get("user_id"):
    user_context += f"User ID: {context['user_id']}"
```

---

## 3. Confidence scoring

AI возвращает confidence в JSON ответе:

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
- 2-5 предложений
- Русский язык
- Если не знает -- честно говорит и предлагает оператора

### JSON parsing

```python
try:
    parsed = json.loads(raw_text)
    answer = parsed.get("answer", "")
    confidence = float(parsed.get("confidence", 0.0))
except (json.JSONDecodeError, ValueError, TypeError):
    answer = raw_text  # Fallback: весь текст как ответ
    confidence = 0.5   # Default confidence для non-JSON
```

Обработка markdown code block wrapper (```` ```json ... ``` ````): удаляется перед JSON parse.

---

## 6. Graceful degradation

### Уровни отказа

| Ситуация | Поведение |
|----------|-----------|
| `ANTHROPIC_API_KEY` не задан | `ai_answer` возвращает `("", 0.0)` -- прямая эскалация |
| API timeout (10s) | `("", 0.0)` -- эскалация |
| Anthropic API error | `("", 0.0)` -- эскалация |
| JSON parse error | Весь текст как answer, confidence=0.5 |
| Пустой/короткий ответ (< 5 символов) | `("", 0.0)` -- эскалация |
| session_id = None | `save_message`, `build_ai_context` и др. -- no-op (return без ошибки) |
| Supabase error в session_manager | Логирование + fallback dict `{session_id: None}` |
| Forward в группу failed | Сообщение пользователю "Попробуйте позже или support@reviomp.ru" |

### Принцип

Бот НИКОГДА не крашится из-за AI-ошибок. При любом сбое -- graceful fallback на оператора или сообщение об ошибке.

---

## 7. Примеры диалогов

### FAQ (confidence ~0.9)

```
User: Сколько стоит Pro тариф?
Bot:  Тариф Pro стоит 990 рублей в месяц. Он включает
      поддержку до 20 SKU, работу с WB и Ozon, FBS-аналитику
      и синхронизацию каждые 6 часов. Оплата через YooKassa
      (банковская карта или СБП).

      Ответ сформирован AI-ассистентом.

      [Вопрос решён] [Связаться с оператором]
```

### Техподдержка (confidence ~0.75)

```
User: Данные не обновляются уже 2 дня
Bot:  Проверьте API-токены в настройках (reviomp.ru/settings).
      Убедитесь, что токены не истекли -- WB и Ozon периодически
      требуют обновления. После сохранения новых токенов
      подождите до 30 минут для первой синхронизации.

      Ответ сформирован AI-ассистентом.

      [Вопрос решён] [Связаться с оператором]
```

### Эскалация (confidence ~0.4)

```
User: Почему прибыль за вчера отличается от кабинета WB?
Bot:  [confidence=0.4, < 0.7]
      --> Автоматическая эскалация в группу поддержки

      "Сообщение отправлено в поддержку. Ответим в ближайшее время."
```

### Продолжение диалога (контекст)

```
User: Как подключить Ozon?
Bot:  Для подключения Ozon перейдите в настройки reviomp.ru/settings,
      вкладка "Подключения". Вставьте Client-ID и API-ключ Ozon.
      Для получения ключей зайдите в ЛК Ozon Seller, раздел API.

User: А какие права нужны?
Bot:  [Использует контекст предыдущих сообщений]
      Для API-ключа Ozon нужны права на чтение: Аналитика,
      Финансы, Товары, Склад. Права на запись не требуются.
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
