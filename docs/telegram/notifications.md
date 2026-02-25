# Telegram Bot -- Уведомления

> Версия: 1.0 | Обновлено: 25.02.2026

---

## Содержание

1. [Daily summary](#1-daily-summary)
2. [Stock alerts](#2-stock-alerts)
3. [AI Insights](#3-ai-insights)
4. [Расписание и cron](#4-расписание-и-cron)
5. [Персонализация настроек](#5-персонализация-настроек)

---

## 1. Daily summary

### Источник данных

Summary использует RPC `get_dashboard_summary` -- тот же источник, что и дашборд в вебе.

```python
supabase.rpc("get_dashboard_summary", {
    "p_date_from": date_main,     # вчера (утро) или сегодня (вечер)
    "p_date_to": date_main,
    "p_marketplace": None,        # все МП
    "p_user_id": user_id,
    "p_fulfillment_type": None,   # FBO + FBS
})
```

### Метрики

| Метрика | Источник | Формула |
|---------|---------|---------|
| Заказы | `orders` | Прямое значение |
| Выкупы | `sales` | Прямое значение + `buyout_percent` |
| Выручка | `revenue` | Прямое значение + % изменение |
| Прибыль | `net_profit` | Прямое значение + % изменение + маржа |
| Реклама | `ad_cost` | Прямое значение + ДРР |
| ДРР | вычисляется | `ad_cost / revenue * 100%` |
| Маржа | вычисляется | `profit / revenue * 100%` |

### Утро vs Вечер

| Параметр | Утренняя сводка | Вечерняя сводка |
|----------|----------------|-----------------|
| `use_yesterday` | `True` | `False` |
| Основной день | Вчера | Сегодня |
| Сравнение | Позавчера | Вчера |
| Greeting | "Утренняя сводка" | "Вечерняя сводка" |
| Логика | Данные вчера полные (final) | Данные сегодня промежуточные |

Разделение: `hour < 15` -> утренняя, `hour >= 15` -> вечерняя.

### Формат сообщения

```
<b>Утренняя сводка за 2026-02-24</b>

Заказы: <b>12</b> (+20.0%)
Выкупы: <b>8</b> (66.7%)
Выручка: <b>15 200 ₽</b> (+8.5%)
Прибыль: <b>3 400 ₽</b> (-12.3%) (маржа 22.4%)
Реклама: <b>1 200 ₽</b> (ДРР 7.9%)

<b>Остатки менее 7 дней:</b>
  Тестобустер: 3.2 дн. (15 шт.)

<b>AI-анализ:</b>
Маржинальность снизилась на фоне роста себестоимости.
ДРР остаётся в пределах нормы -- рекламный бюджет эффективен.

<i>reviomp.ru</i>
```

### Форматирование чисел

```python
def _format_number(value):
    if abs(value) >= 1_000_000:  return f"{value / 1_000_000:.1f}M"
    if abs(value) >= 1_000:      return f"{value:,.0f}".replace(",", " ")
    # float: 1 знак, int: без десятичных
```

### Change indicator

```python
def _change_indicator(current, previous):
    if previous == 0: return ""
    change = ((current - previous) / previous) * 100
    # "+8.5%" или "(-12.3%)"
```

---

## 2. Stock alerts

### Логика

```python
async def _get_stock_alerts(user_id):
    # 1. SELECT mp_stocks + mp_products для user_id
    # 2. SELECT mp_sales за последние 30 дней (sales_count)
    # 3. Агрегация stocks по product_id (сумма quantity)
    # 4. avg_daily_sales = total_sales / 30
    # 5. days_remaining = total_quantity / avg_daily_sales
    # 6. Фильтр: days_remaining < 7
    # 7. Сортировка по days_remaining ASC
```

### Формула

```
days_remaining = total_quantity / (total_sales_30d / 30)
```

Где:
- `total_quantity` -- сумма `mp_stocks.quantity` по всем складам для товара
- `total_sales_30d` -- сумма `mp_sales.sales_count` за 30 дней

### Порог

`days_remaining < 7` -- товар попадает в алерт.

### Лимит

В сводке показываются максимум 5 товаров. Если больше -- строка "...и ещё N товаров".

---

## 3. AI Insights

### Генерация

```python
insights = await generate_insights(
    current_metrics,  # orders, sales, revenue, profit, ad_cost, drr, margin, buyout_pct
    prev_metrics,     # orders, revenue, profit
    stock_alerts,     # [{name, days, quantity}]
)
```

### Модель и параметры

| Параметр | Значение |
|----------|---------|
| Модель | `claude-haiku-4-5-20251001` |
| max_tokens | 300 |
| timeout | 10 секунд |
| Формат | Plain text, 1-3 строки |

### Бенчмарки в промпте

| Метрика | Хорошо | Средне | Плохо |
|---------|--------|--------|-------|
| ДРР | < 10% | 10-15% | > 15% |
| Маржа | > 25% | 15-25% | < 15% |
| Выкуп | > 70% | -- | < 70% |
| Остатки | > 14 дн. | 7-14 дн. | < 7 дн. |

### Правила ответа

- 1-3 предложения, каждое на новой строке
- Без Markdown/HTML
- Числа с пробелом-разделителем
- Проценты с одним знаком
- Не повторять цифры из сводки -- только АНАЛИЗ

### Fallback

При ошибке (timeout, API error) -- сводка отправляется без блока "AI-анализ":
```python
try:
    insights = await generate_insights(...)
except Exception as e:
    logger.warning(f"AI insights failed, skipping: {e}")
```

---

## 4. Расписание и cron

### Cron endpoint

```
POST /api/telegram/send-summaries
Header: X-Cron-Secret
```

Вызывается каждые 15 минут.

### Алгоритм matching

```python
# 1. Текущее MSK время
now_hhmm = _now_msk_hhmm()  # "09:14"

# 2. Округление до 15 минут
rounded_m = (int(m) // 15) * 15  # 14 -> 0
target_time = f"{h}:{rounded_m:02d}"  # "09:00"

# 3. Также проверить точный час
target_hour = f"{h}:00"  # "09:00"

# 4. Проверить оба времени
times_to_check = {target_time, target_hour}  # {"09:00"}
```

### Matching пользователя

Для каждого `mp_telegram_links`:
```python
# Утренняя сводка: включена + время совпадает
is_morning = settings.daily_summary and settings.morning_time == target_time
# Вечерняя сводка: включена + время совпадает
is_evening = settings.evening_enabled and settings.evening_time == target_time
```

### Временные зоны

Все времена в **МСК** (UTC+3):
```python
MSK_OFFSET = timedelta(hours=3)
def _now_msk():
    return datetime.now(timezone.utc) + MSK_OFFSET
```

Пользователь выбирает HH:00 в МСК. Cron работает каждые 15 минут и проверяет совпадение.

### Статистика

Endpoint возвращает:
```json
{
  "target_time": "09:00",
  "sent": 3,
  "errors": 0,
  "skipped": 5
}
```

---

## 5. Персонализация настроек

### Настройки пользователя

Хранятся в `mp_telegram_links.settings` (JSONB):

| Поле | Тип | Default | Описание |
|------|-----|---------|----------|
| `daily_summary` | bool | `true` | Утренняя сводка вкл/выкл |
| `morning_time` | string | `"09:00"` | Время утренней сводки (МСК) |
| `evening_enabled` | bool | `false` | Вечерняя сводка вкл/выкл |
| `evening_time` | string | `"21:00"` | Время вечерней сводки (МСК) |
| `stock_alerts` | bool | `true` | Алерты остатков в сводке |

### Управление настройками

**Через бот** (InlineKeyboard):
- Toggle утро/вечер/алерты
- +1/-1 час для утра/вечера
- Данные обновляются в Supabase напрямую

**Через web** (ProfileTab -> TelegramSection):
- Toggle switches для каждого параметра
- TimeSelect (dropdown 00:00--23:00)
- `PUT /api/telegram/settings` с полным объектом настроек
- Валидация формата времени на backend

### Settings keyboard (бот)

```
[Утренняя сводка: вкл (09:00)]
[Вечерняя сводка: выкл (21:00)]
[Алерты остатков: вкл]
[Утро: раньше] [Утро: позже]
[Вечер: раньше] [Вечер: позже]
[Назад]
```

### Клавиатуры бота (7 шт.)

| Клавиатура | Контекст | Кнопки |
|------------|---------|--------|
| `main_keyboard` | После сводки | [Дашборд] [Остатки] [Настройки] (URL кнопки) |
| `welcome_keyboard` | При /start, после действий | [Сводка] [Настройки] / [Поддержка] [Справка] |
| `support_keyboard` | Меню поддержки | 3 FAQ + [Оператор] + [Назад] |
| `settings_keyboard` | Настройки | Toggles + время + [Назад] |
| `operator_cancel_keyboard` | Ожидание сообщения | [Отмена] |
| `after_ai_keyboard` | После AI ответа | [Вопрос решён] [Связаться с оператором] |
| `csat_keyboard` | После "Вопрос решён" | [Да, помогли] [Нет, не помогли] |

### URL кнопки (WebApp)

```python
WEBAPP_URL = "https://reviomp.ru"

# main_keyboard:
"Дашборд"   -> https://reviomp.ru/
"Остатки"   -> https://reviomp.ru/?scrollTo=stocks
"Настройки" -> https://reviomp.ru/settings?tab=profile
```
