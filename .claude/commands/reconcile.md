Сверка данных из CSV ЛК маркетплейсов с нашим API `/dashboard/costs-tree`.

Аргумент $ARGUMENTS может содержать: marketplace (wb/ozon/all), даты, JWT токен.
Если не указаны — спроси.

## Шаг 1: Определи параметры

Нужно знать:
- **Маркетплейс:** wb, ozon или all (по умолчанию: all)
- **Период:** date_from и date_to (YYYY-MM-DD). Если не указан — посмотри какие CSV есть и предложи доступный период
- **JWT токен:** нужен для API запросов. Если нет — попроси пользователя:
  ```
  Открой DevTools (F12) → Console → вставь:
  JSON.parse(localStorage.getItem('sb-xpushkwswfbkdkbmghux-auth-token')).access_token
  ```

## Шаг 2: Проверь доступные CSV файлы

```bash
# WB
ls -la wb/Еженедельн*детализированн*.csv 2>/dev/null
# Ozon
ls -la ozon/Отчет\ по\ начислениям_*.csv 2>/dev/null
ls -la ozon/Отчет\ по\ товарам\ за\ период*.csv 2>/dev/null
```

Если CSV нет — скажи пользователю какие файлы скачать из ЛК.

## Шаг 3: Offline сверка (CSV → итоги "как в ЛК")

### WB:
```bash
cd /Users/kr1zal/Documents/ii-devOps/Projects/Analitics
python3 wb/reconcile_wb.py --date-from DATE_FROM --date-to DATE_TO --json
```

### Ozon:
```bash
cd /Users/kr1zal/Documents/ii-devOps/Projects/Analitics
python3 ozon/reconcile_accruals.py --json
```

Покажи итоги по категориям.

## Шаг 4: Reconcile с API (если есть JWT)

ВАЖНО: Скрипты reconcile НЕ умеют передавать JWT. Используй прямые curl запросы:

### WB costs-tree:
```bash
curl -s -H "Authorization: Bearer JWT_TOKEN" \
  "http://localhost:8000/api/v1/dashboard/costs-tree?date_from=DATE_FROM&date_to=DATE_TO&marketplace=wb" | python3 -m json.tool
```

### Ozon costs-tree:
```bash
curl -s -H "Authorization: Bearer JWT_TOKEN" \
  "http://localhost:8000/api/v1/dashboard/costs-tree?date_from=DATE_FROM&date_to=DATE_TO&marketplace=ozon" | python3 -m json.tool
```

## Шаг 5: Сравни и выведи отчёт

Для каждой категории из CSV сравни с соответствующим tree item из API.

Формат отчёта:
```
=== RECONCILIATION REPORT ===
Период: DATE_FROM — DATE_TO
Маркетплейс: WB / Ozon

| Категория              | CSV (ЛК)    | API          | Разница     | ✓/✗ |
|------------------------|-------------|--------------|-------------|-----|
| Продажи                | 10,130.25 ₽ | 10,130.25 ₽ |      0.00 ₽ | ✓   |
| Вознаграждение ВБ      | -2,345.67 ₽ | -2,345.67 ₽ |      0.00 ₽ | ✓   |
| ...                    |             |              |             |     |
| ИТОГО к перечислению   |  7,435.00 ₽ |  7,435.00 ₽ |      0.00 ₽ | ✓   |

Допустимое расхождение: ≤ 1.00 ₽ (округление)
Результат: ✓ ВСЕ СОВПАДАЕТ / ✗ РАСХОЖДЕНИЕ (описание)
```

## Маппинг категорий CSV → API tree

### WB:
| CSV колонка | API tree name |
|-------------|---------------|
| Вайлдберриз реализовал Товар | Продажи |
| Вознаграждение ВВ + НДС | Вознаграждение Вайлдберриз (ВВ) |
| Эквайринг | Эквайринг/Комиссии за организацию платежей |
| Услуги по доставке | Услуги по доставке товара покупателю |
| Хранение | Стоимость хранения |
| Возмещение ПВЗ + транспорт | Возмещения |
| Штрафы | Общая сумма штрафов |
| Удержания | Прочие удержания/выплаты |
| К перечислению | total_accrued |

### Ozon:
| CSV "Группа услуг" | API tree name |
|---------------------|---------------|
| Продажи | Продажи |
| Вознаграждение Ozon | Вознаграждение Ozon |
| Услуги доставки | Услуги доставки |
| Возвраты | Возвраты и отмены |
| ИТОГО | total_accrued |

## Важно
- Если токен истёк (401) — попроси новый
- Backend должен быть запущен на localhost:8000
- CSV файлы лежат в `wb/` и `ozon/` папках проекта
- Расхождение ≤ 1₽ = ОК (округление копеек)
- Расхождение > 1₽ = надо разбираться, показать какие категории не совпали
