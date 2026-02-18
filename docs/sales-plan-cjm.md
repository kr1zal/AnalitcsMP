# CJM: Система планирования продаж

> Analytics Dashboard -- WB + Ozon, 5 SKU (витамины/БАДы), SaaS Free/Pro/Business
> Дата: 2026-02-18

---

## Секция 1: User Personas

### Персона A: Начинающий ("Катя, первый бизнес")

| Параметр | Описание |
|----------|----------|
| **Профиль** | 1-2 товара на WB, 0-3 месяца опыта, подписка Free/Pro |
| **Мотивация** | "Хочу понять, нормально ли идут продажи" |
| **Опыт планирования** | Нулевой. Не знает, сколько ставить в план |
| **Паттерн ввода** | Ставит один общий план (total) на месяц. Lazy mode |
| **Болевые точки** | Не понимает 3-уровневую систему; пугает обилие полей ввода; не знает свой средний оборот |
| **Ожидания от UI** | Подсказки ("средний за прошлые 3 мес: X"), минимум полей, четкий progress bar |

### Персона B: Средний ("Денис, растущий бренд")

| Параметр | Описание |
|----------|----------|
| **Профиль** | 3-5 товаров на WB + Ozon, 6-12 месяцев, подписка Pro |
| **Мотивация** | "Хочу контролировать рост и видеть отклонения от плана" |
| **Опыт планирования** | Пользовался Excel-таблицами. Знает свои цифры |
| **Паттерн ввода** | Ставит plan per-MP (WB/Ozon), иногда per-product для ключевых товаров |
| **Болевые точки** | Хочет быстро скопировать план из прошлого месяца; раздражает ввод по одному; нужен bulk edit |
| **Ожидания от UI** | "Скопировать из прошлого месяца", bulk заполнение, темп/прогноз, BCG-матрица |

### Персона C: Enterprise ("Ирина, несколько брендов")

| Параметр | Описание |
|----------|----------|
| **Профиль** | 5+ товаров, WB + Ozon, 12+ месяцев, подписка Business |
| **Мотивация** | "Управление по целям: планирую сверху вниз, контролирую снизу вверх" |
| **Опыт планирования** | Ведет финмодель. Есть годовой план, разбивает по месяцам |
| **Паттерн ввода** | Total → per-MP → auto-distribute per-product. Корректирует в середине месяца |
| **Болевые точки** | Нет auto-calculate (ввел total -- автоматом разбей по товарам по весу); нет plan vs fact отчета; нет истории изменений плана |
| **Ожидания от UI** | Автораспределение, план-факт детализация, копирование шаблонов, экспорт |

---

## Секция 2: Полный CJM -- все точки входа

### Обзорная карта навигации

```
                     +---------------------+
                     |    LANDING PAGE     |
                     |   (не авторизован)  |
                     +----------+----------+
                                |
                           [Login/Signup]
                                |
                     +----------v----------+
                     |     DASHBOARD       |
                     | PlanCompletionCard  |
                     | (read-only, если    |
                     |  plan > 0)          |
                     +----+--------+-------+
                          |        |
         [клик "Target"]  |        | [nav menu]
         (нет линка)      |        |
                          |   +----v---------------+
                          |   |   UE PAGE          |
                          |   | UePlanPanel (edit)  |
                          |   | UeKpiCards (read)   |
                          |   | UeTable (inline)    |
                          |   | BCG Matrix          |
                          |   +----+--------+-------+
                          |        |        |
                          |   [link]|   [inline edit]
                          |        |        |
                     +----v--------v--------v------+
                     |     SETTINGS                |
                     |  Tab: "Товары"              |
                     |  SalesPlanEditor (full edit) |
                     +-----------------------------+
```

### Точка входа 1: Settings -> SalesPlanEditor (ТЕКУЩАЯ)

```
[Пользователь]
    |
    v
Navbar -> "Настройки" -> Tab "Товары"
    |
    v
SalesPlanEditor виден ПОД списком товаров
    |
    +-- [Уровень 1] Общий план на месяц -> SaveInput (blur-save)
    |       |
    |       +-- onBlur/Enter -> PUT /sales-plan/summary {level:"total"}
    |       +-- invalidate: ['sales-plan','summary',month] + ['sales-plan','completion']
    |
    +-- [Уровень 2] По маркетплейсам (WB / Ozon) -> 2x SaveInput
    |       |
    |       +-- onBlur -> PUT /sales-plan/summary {level:"wb"/"ozon"}
    |       +-- invalidate: аналогично
    |       +-- Подсказка: "Сумма: {wb + ozon}"
    |
    +-- [Уровень 3] По товарам (collapsible, default скрыт)
    |       |
    |       +-- [Клик "По товарам"] -> expand
    |       +-- Tab: WB | Ozon
    |       +-- Для каждого товара: SaveInput (blur-save)
    |       +-- onBlur -> PUT /sales-plan {marketplace, items:[{product_id, plan_revenue}]}
    |       +-- invalidate: ['sales-plan',month,mp] + ['sales-plan','completion']
    |       +-- Итого внизу: sum(product plans)
    |
    +-- [Навигация по месяцам] <- ChevronLeft | "Февраль 2026" | ChevronRight ->
    |
    +-- [Сброс] "Сбросить план" -> confirm -> DELETE /sales-plan/reset?month=
            +-- invalidate: ВСЕ ['sales-plan'] (полный invalidate)
```

**Результат:** План сохранен в БД, completion обновляется на Dashboard и UE page.
**Куда дальше:** Пользователь может перейти на Dashboard (увидит PlanCompletionCard) или на UE page (увидит прогресс в таблице).

### Точка входа 2: Dashboard -> PlanCompletionCard (ТЕКУЩАЯ, read-only)

```
[Dashboard загружается]
    |
    v
useSalesPlanCompletion(filters) -> GET /sales-plan/completion?date_from=&date_to=&marketplace=
    |
    v
[total_plan > 0?]
    |
    +-- НЕТ -> карточка НЕ рендерится (return null)
    |
    +-- ДА -> Рендер:
            +-- Цветной фон (emerald >= 100%, indigo >= 70%, amber < 70%)
            +-- Процент: "78%"
            +-- Progress bar
            +-- Суммы: "156 000 / 200 000"
            +-- Месяц-label: "Февраль 2026"
            |
            +-- [Клик] -> НИЧЕГО (нет интерактивности!)
```

**Результат:** Пользователь ВИДИТ прогресс, но не может редактировать.
**Куда дальше:** Нет прямого перехода. Пользователь должен сам перейти в Settings или UE.
**Проблема:** Нет ссылки "Редактировать план" -- тупик UX.

### Точка входа 3: UE Page -> UePlanPanel (ТЕКУЩАЯ, с редактированием)

```
[UE Page загружается]
    |
    v
Параллельные запросы:
  - useSalesPlanCompletion(filters) -> планы + completion
  - useSalesPlanSummary(planMonth)  -> summary (total/wb/ozon)
  - useSalesPlan(planMonth, 'wb')   -> per-product WB
  - useSalesPlan(planMonth, 'ozon') -> per-product Ozon
    |
    v
UePlanPanel (collapsible, default OPEN)
    |
    +-- Header: "План продаж: Февраль 2026" + badge "78%"
    |       [Клик] -> toggle collapse
    |
    +-- [Expanded content]:
    |   +-- Grid 1x3: Общий план | Wildberries | Ozon
    |   |       Каждый: SaveInput -> PUT /sales-plan/summary
    |   |
    |   +-- Progress bar + метрики:
    |   |       "156 000 из 200 000 | Темп: 5 200/день | Прогноз: ~82% | Нужно: 6 300/день"
    |   |
    |   +-- Footer:
    |       +-- [Link] "Подробное редактирование" -> /settings?tab=products
    |       +-- [Button] "Сбросить" -> confirm -> DELETE /sales-plan/reset
    |
    +-- [После save]:
        invalidate: ['sales-plan','summary',month] + ['sales-plan','completion']
```

**Результат:** Можно быстро скорректировать total/WB/Ozon plan не уходя со страницы UE.
**Куда дальше:** "Подробное редактирование" ведет в Settings для per-product ввода.

### Точка входа 4: UE Page -> UeTable (ТЕКУЩАЯ, read-only для планов)

```
[UeTable рендерит колонку "План"]
    |
    v
[hasPlan?]
    |
    +-- НЕТ -> колонка "План" скрыта
    |
    +-- ДА -> Для каждого товара:
            +-- planMap.get(product_id) -> completion % badge
            +-- planPaceMap.get(product_id) -> tooltip с прогнозом
            +-- Цвет: emerald >= 100%, indigo >= 70%, amber < 70%
            +-- Под %: "Опережает" / "На уровне" / "Отстаёт"
            |
            +-- [Expanded Row] -> UeExpandedRow
                    +-- WB Card: progress bar (plan_revenue, actual, %)
                    +-- Ozon Card: progress bar (plan_revenue, actual, %)
```

**ВАЖНО:** Несмотря на props `onPlanSave` и `planMonth` в UeTable, фактически inline edit НЕ используется в текущем коде. `_onPlanSave` и `_planMonth` -- подчеркнуты (underscore = unused). Это подготовленный, но не реализованный функционал.

**Результат:** Пользователь видит % выполнения per-product, но не может редактировать прямо в таблице.
**Куда дальше:** Клик на товар раскрывает expanded row с breakdown по MP.

### Точка входа 5: ПРЕДЛАГАЕМАЯ -- /planning page (dedicated)

```
[Navbar] -> "Планирование" (новый пункт)
    |
    v
+---------------------------------------------------------------------+
|  ПЛАНИРОВАНИЕ ПРОДАЖ                                                |
|                                                                     |
|  [<- Январь 2026]  [Февраль 2026]  [Март 2026 ->]                 |
|                                                                     |
|  +-- Quick Actions Bar --+                                          |
|  | [Копировать прошлый] [Auto-distribute] [Сбросить] [Export PDF] | |
|  +------------------------+                                         |
|                                                                     |
|  +-- Summary Row (editable) ---+                                    |
|  | Общий: [200 000] | WB: [120 000] | Ozon: [80 000]             | |
|  | Progress: ████████░░ 78%  | Прогноз: ~82% к концу мес.         | |
|  +------------------------------+                                   |
|                                                                     |
|  +-- Per-Product Table (bulk-editable) ---+                         |
|  |  Товар          | WB план | Ozon план | Факт WB | Факт Ozon   | |
|  |  Витамин D      | [30000] | [20000]   | 25 600  | 14 300      | |
|  |  Омега-3        | [25000] | [15000]   | 22 100  | 12 800      | |
|  |  Магний B6      | [20000] | [18000]   | 15 200  | 16 900      | |
|  |  Цинк           | [25000] | [15000]   | 18 400  | 11 200      | |
|  |  Мультивит.     | [20000] | [12000]   | 17 300  | 9 800       | |
|  |  ─────────────────────────────────────────────────             | |
|  |  ИТОГО          | 120 000 | 80 000    | 98 600  | 65 000      | |
|  +----------------------------------------------------------------+ |
|                                                                     |
|  +-- Validation Alerts ---+                                         |
|  | ⚠ Сумма товаров WB (120 000) = План WB (120 000) -- ОК        | |
|  | ⚠ Сумма товаров Ozon (80 000) = План Ozon (80 000) -- ОК      | |
|  | ⚠ Сумма МП (200 000) = Общий план (200 000) -- ОК             | |
|  +-------------------------------+                                  |
+---------------------------------------------------------------------+
```

**Преимущество:** Все уровни плана на одном экране, bulk edit, validation, copy from prev month.

### Точка входа 6: ПРЕДЛАГАЕМАЯ -- Dashboard -> expanded plan widget

```
[PlanCompletionCard] -> [Клик / Кнопка "Подробнее"]
    |
    v
+-- Expanded Widget (Modal или inline accordion) --+
|                                                   |
|  План продаж: Февраль 2026                78%    |
|  ████████████████████░░░░░  156 000 / 200 000    |
|                                                   |
|  WB:   ████████████░░░░░  98 600 / 120 000 (82%) |
|  Ozon: ████████░░░░░░░░  65 000 / 80 000  (81%) |
|                                                   |
|  Темп: 5 200/день | Прогноз: ~82%                |
|  Нужно: 6 300/день для 100%                      |
|                                                   |
|  [Редактировать план ->]  (link to Settings/UE)  |
+---------------------------------------------------+
```

**Преимущество:** Пользователь видит breakdown без перехода на другую страницу.

---

## Секция 3: Сценарии ввода планов

### Сценарий A: Новый пользователь, первый план (onboarding)

**Персона:** Катя (начинающий)

**Пошаговый flow:**

```
1. Катя зарегистрировалась, прошла Onboarding, подключила WB
2. Открывает Dashboard -> видит карточки метрик, но PlanCompletionCard НЕ видна
   (total_plan = 0 -> return null)
3. Катя не знает, что планы существуют
4. [Проблема] Нет ни одного CTA "Поставьте план продаж"
5. Позже, исследуя меню, переходит в "Настройки" -> tab "Товары"
6. Скроллит вниз, видит секцию "План продаж" с иконкой Target
7. Видит пустые поля: "Общий план на месяц" с placeholder "Общий план"
8. Вводит 100000, нажимает Tab (blur) -> сохранение
9. Возвращается на Dashboard -> видит PlanCompletionCard "0%" (если нет продаж)
   или "XX%" (если есть)
```

**API запросы:**
```
[Шаг 8] PUT /sales-plan/summary
  Body: { month: "2026-02", level: "total", plan_revenue: 100000 }
  -> Response: { status: "success" }

[React Query invalidation]:
  -> invalidate ['sales-plan', 'summary', '2026-02']
  -> invalidate ['sales-plan', 'completion']

[Шаг 9] GET /sales-plan/completion?date_from=2026-02-01&date_to=2026-02-18&marketplace=all
  -> Response: { total_plan: 100000, total_actual: 78000, completion_percent: 78.0, ... }
```

**Что видит пользователь на каждом шаге:**
1. Dashboard без PlanCompletionCard
2-5. Нет подсказки о планировании
6. Секция "План продаж" с пустыми полями
7. Input с placeholder
8. Spinner (Loader2 animate-spin) -> Check (зеленая галка) -> toast не показывается (blur save)
9. PlanCompletionCard появляется с прогресс-баром

**Проблемы:**
- Discoverability: нет подсказки "Поставьте план" нигде на Dashboard
- Нет рекомендации "ваш средний оборот за 3 месяца = X, поставить?"
- Первый план = пустая страница без контекста (какую цифру ставить?)

---

### Сценарий B: Пользователь задает план на следующий месяц

**Персона:** Денис (средний)

**Пошаговый flow:**

```
1. Денис на странице Settings -> tab "Товары"
2. Видит SalesPlanEditor, текущий месяц: "Февраль 2026"
3. Нажимает ChevronRight (->)
4. Месяц меняется на "Март 2026"
5. Все поля = 0 (нового плана еще нет)
6. Вводит Total: 250000 -> blur -> save
7. Вводит WB: 150000 -> blur -> save
8. Вводит Ozon: 100000 -> blur -> save
9. Раскрывает "По товарам" -> tab WB
10. Вводит plan для каждого товара WB -> blur -> save (5 раз)
11. Переключает tab на Ozon -> вводит plan (5 раз)
12. Видит "Итого WB: 150 000" совпадает с планом WB -- ОК
```

**API запросы (в порядке):**
```
[Шаг 3] Автоматически:
  GET /sales-plan/summary?month=2026-03
  GET /sales-plan?month=2026-03&marketplace=wb    (при expand)
  GET /sales-plan?month=2026-03&marketplace=ozon  (при expand)

[Шаг 6] PUT /sales-plan/summary { month:"2026-03", level:"total", plan_revenue:250000 }
[Шаг 7] PUT /sales-plan/summary { month:"2026-03", level:"wb", plan_revenue:150000 }
[Шаг 8] PUT /sales-plan/summary { month:"2026-03", level:"ozon", plan_revenue:100000 }

[Шаги 10-11] PUT /sales-plan { month:"2026-03", marketplace:"wb", items:[{product_id, plan_revenue}] }
              PUT /sales-plan { month:"2026-03", marketplace:"ozon", items:[{product_id, plan_revenue}] }
              (по 5 запросов для WB + 5 для Ozon = 10 PUT запросов)
```

**React Query invalidation chain:**
```
Каждый PUT summary ->
  invalidate ['sales-plan', 'summary', '2026-03']
  invalidate ['sales-plan', 'completion']     <-- НО completion для марта не покажется
                                                    на Dashboard, т.к. Dashboard range =
                                                    текущий период (февраль)

Каждый PUT per-product ->
  invalidate ['sales-plan', '2026-03', 'wb']  (или 'ozon')
  invalidate ['sales-plan', 'completion']
```

**Проблемы:**
- 10+ отдельных PUT запросов (по одному на товар) -- нет batch save
- Нет подсказки "рекомендуемый plan на основе тренда"
- Нет валидации total = sum(products) в реальном времени
- Completion для будущего месяца не отобразится на Dashboard до наступления месяца

---

### Сценарий C: Пользователь корректирует план в середине месяца

**Персона:** Ирина (enterprise)

**Пошаговый flow:**

```
1. Ирина видит на Dashboard: PlanCompletionCard = 45% (за 18 дней из 28)
2. Переходит на UE page
3. UePlanPanel показывает: "Темп: 5 000/день | Прогноз: ~70% | Нужно: 11 000/день"
4. Понимает: план нереалистичный, нужно скорректировать
5. В UePlanPanel меняет "Общий план" с 200 000 на 160 000 -> blur -> save
6. Progress bar пересчитывается: 45% -> 56%
7. Метрики обновляются: "Прогноз: ~88%"
8. Ирина также хочет скорректировать per-product:
9. Нажимает "Подробное редактирование" -> переход на /settings?tab=products
10. В SalesPlanEditor корректирует per-product plans
```

**API запросы:**
```
[Шаг 5] PUT /sales-plan/summary { month:"2026-02", level:"total", plan_revenue:160000 }

[React Query invalidation]:
  -> invalidate ['sales-plan', 'summary', '2026-02']
    -> refetch -> UePlanPanel обновляется
  -> invalidate ['sales-plan', 'completion']
    -> refetch -> PlanCompletionCard на Dashboard обновится при возврате
    -> refetch -> UeKpiCards "План" обновится
    -> refetch -> UeTable planMap обновится
    -> refetch -> BCG Matrix пересчитается
```

**Что видит пользователь:**
- Шаг 5: Spinner в input -> Check -> данные обновляются
- Шаг 6-7: Progress bar анимированно расширяется, метрики пересчитываются
- Между UE page и Settings -- полная перезагрузка при возврате (SPA навигация)

**Проблемы:**
- Нет истории изменений плана (audit log)
- При корректировке total не перерасчитываются product-level plans
- Нет подсказки "если скорректировать до X -- план будет выполним при текущем темпе"

---

### Сценарий D: Пользователь копирует план из прошлого месяца

**Персона:** Денис (средний)

**Текущее состояние: ФУНКЦИОНАЛ НЕ РЕАЛИЗОВАН**

**Желаемый flow:**
```
1. Денис открывает SalesPlanEditor, переключает на "Март 2026"
2. Видит пустые поля
3. [Кнопка "Копировать из февраля"] <- НЕ СУЩЕСТВУЕТ
4. Нажимает кнопку
5. Все значения (total, WB, Ozon, per-product) копируются из февраля
6. Может скорректировать отдельные значения
```

**Текущий workaround:**
```
1. Открывает SalesPlanEditor, месяц "Февраль 2026" -- запоминает значения
2. Переключает на "Март 2026"
3. Вручную вводит все значения заново
4. Очень утомительно при 5+ товарах x 2 МП = 10+ полей
```

**Рекомендация:** Реализовать кнопку "Скопировать из прошлого месяца" с bulk upsert.

---

### Сценарий E: "Заполнить все строчки разом" -- bulk edit

**Персона:** Ирина (enterprise)

**Текущее состояние: ФУНКЦИОНАЛ ЧАСТИЧНО РЕАЛИЗОВАН**

Текущий API `PUT /sales-plan` принимает массив `items: [{product_id, plan_revenue}]`, но фронтенд вызывает его по одному товару:

```typescript
// saveProduct -- вызывается blur каждого input отдельно
const saveProduct = useCallback(
  (productId: string) => async (value: number) => {
    await upsertProductMut.mutateAsync({
      month,
      marketplace: productTab,
      items: [{ product_id: productId, plan_revenue: value }], // <-- всегда 1 item
    });
  },
  [month, productTab, upsertProductMut],
);
```

**Текущий flow (неэффективный):**
```
1. Ирина раскрывает "По товарам" -> tab WB
2. Вводит plan для товара 1 -> blur -> PUT (1 запрос)
3. Вводит plan для товара 2 -> blur -> PUT (1 запрос)
4. ...
5. Вводит plan для товара 5 -> blur -> PUT (1 запрос)
6. Переключает на Ozon -> 5 PUT запросов
7. Итого: 10 PUT запросов последовательно
```

**Желаемый flow:**
```
1. Ирина раскрывает "По товарам"
2. Видит все товары WB + Ozon в одной таблице
3. Вводит все значения (Tab между полями)
4. Нажимает "Сохранить все" -> 1 PUT для WB + 1 PUT для Ozon
5. Все сохранено за 2 запроса
```

**Проблемы:**
- Blur-save паттерн не подходит для bulk ввода (каждый blur = запрос)
- Нет кнопки "Сохранить все"
- При быстром Tab-переключении между полями может быть race condition

---

### Сценарий F: Пользователь задает только total plan (lazy mode)

**Персона:** Катя (начинающий)

**Пошаговый flow:**
```
1. Катя в Settings -> SalesPlanEditor
2. Видит "Общий план на месяц"
3. Вводит 100000 -> blur -> save
4. НЕ заполняет WB/Ozon
5. НЕ раскрывает "По товарам"
6. Уходит
```

**API:**
```
PUT /sales-plan/summary { month:"2026-02", level:"total", plan_revenue:100000 }
```

**Как это работает в completion:**
```
GET /sales-plan/completion
  -> Backend видит: summary "total" = 100000
  -> Priority 1 срабатывает: plan_level = "total"
  -> actual = SUM(ALL mp_sales.revenue за февраль)
  -> completion = actual / 100000 * 100%
  -> by_product = [] (пустой -- нет per-product breakdown)
```

**Что видит пользователь:**
- Dashboard: PlanCompletionCard = "78% | 78 000 / 100 000"
- UE page: UePlanPanel показывает progress, НО UeTable НЕ показывает колонку "План" (planMap.size = 0, hasPlan = false)
- BCG Matrix НЕ отображается

**Проблема:**
- Нет per-product breakdown -- теряется ценность UE page для анализа плана
- Нет подсказки "Хотите детализировать план по товарам?"

---

### Сценарий G: Пользователь задает product plans но не total (bottom-up)

**Персона:** Денис (средний)

**Пошаговый flow:**
```
1. Денис в Settings -> SalesPlanEditor
2. Не вводит "Общий план"
3. Не вводит WB / Ozon
4. Раскрывает "По товарам"
5. Tab WB: вводит план для 5 товаров (blur save x5)
6. Tab Ozon: вводит план для 5 товаров (blur save x5)
7. Видит "Итого WB: 120 000" и "Итого Ozon: 80 000"
```

**Как это работает в completion:**
```
GET /sales-plan/completion
  -> Backend проверяет Priority 1: summary "total" = 0 -> пропуск
  -> Priority 2: summary "wb" + "ozon" = 0 -> пропуск
  -> Priority 3: per-product plans существуют (10 записей)
  -> plan_level = "product"
  -> total_plan = SUM(all product plans) = 200 000
  -> actual = SUM(mp_sales.revenue для product_ids с планом)
  -> by_product = [{product_id, plan_revenue, actual_revenue, completion_percent}, ...]
```

**Что видит пользователь:**
- Dashboard: PlanCompletionCard = "X% | actual / 200 000"
- UE page: UeTable ПОКАЗЫВАЕТ колонку "План" (hasPlan = true, planMap.size > 0)
- BCG Matrix ОТОБРАЖАЕТСЯ (есть per-product completion)
- UePlanPanel: "Общий план" = 0, но progress bar показывается (от sum products)

**Проблема:**
- UePlanPanel показывает "Общий план = 0" -- путаница, хотя план фактически 200 000
- Нет подсказки "Хотите задать общий план? Сумма по товарам = 200 000"

---

### Сценарий H: Сброс плана

**Персона:** Любая

**Пошаговый flow (из Settings):**
```
1. Пользователь в SalesPlanEditor, видит заполненные планы
2. Нажимает "Сбросить план"
3. Появляется confirm: "Сбросить все планы на Февраль 2026?"
4. Кнопки: [Да] [Отмена]
5. Нажимает [Да]
6. API: DELETE /sales-plan/reset?month=2026-02
7. Backend удаляет ВСЕ записи из mp_sales_plan_summary + mp_sales_plan для этого месяца
8. React Query: invalidate ['sales-plan'] (ВСЕ ключи с этим префиксом)
9. Все поля обнуляются
10. PlanCompletionCard на Dashboard исчезает (total_plan = 0 -> return null)
```

**Пошаговый flow (из UE page):**
```
1. Пользователь в UePlanPanel, видит "Сбросить"
2. Первый клик: текст меняется на "Точно сбросить?" (confirmReset = true)
3. Второй клик: вызов DELETE /sales-plan/reset
4. Аналогичный результат
```

**API:**
```
DELETE /sales-plan/reset?month=2026-02
  -> Удаляет mp_sales_plan_summary WHERE user_id AND month
  -> Удаляет mp_sales_plan WHERE user_id AND month
  -> Response: { status: "success" }
```

**React Query invalidation:**
```
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['sales-plan'] });
  // Инвалидирует ВСЕ: summary, completion, per-product -- все mp
}
```

**Проблемы:**
- Нет undo (удаление необратимо)
- Нет подтверждения "Будут удалены N записей по X товарам"
- Нет soft delete (нельзя восстановить)

---

## Секция 4: Карта отображения планов

### Текущая реализация

| Место | Что показывается | Источник данных | Hook | Интерактивно? |
|-------|-----------------|-----------------|------|---------------|
| **Dashboard: PlanCompletionCard** | % выполнения, progress bar, actual/plan суммы, month_label | `useSalesPlanCompletion(filters)` | GET /sales-plan/completion | Нет (read-only). Нет ссылки на редактирование |
| **UE: UePlanPanel** | 3 input (total/WB/Ozon), progress bar, темп, прогноз, requiredDaily | `useSalesPlanCompletion(filters)` + `useSalesPlanSummary(planMonth)` | GET /completion + GET /summary | Да: edit summary plans, reset, link to Settings |
| **UE: UeKpiCards** | KPI "План" карточка с %, month_label, цвет | `planData` (prop от UnitEconomicsPage, из `useSalesPlanCompletion`) | -- (props from parent) | Нет |
| **UE: UeTable** | Колонка "План": % badge + pace status per-product | `planMap` (prop, Map<productId, completion%>) + `planPaceMap` (prop) | -- (props from parent) | Нет (inline edit подготовлен но не активен) |
| **UE: UeExpandedRow** | Per-MP progress bars (WB plan, Ozon plan) | `wbPlanMap` + `ozonPlanMap` (props) | -- (props from parent) | Нет |
| **UE: UePlanMatrix** | BCG 2x2 матрица: Звезды/Ловушки/Потенциал/Проблемы | `classifyMatrix(unitProducts, planMap)` | -- (computed) | Да: клик по квадранту фильтрует UeTable |
| **Settings: SalesPlanEditor** | 3-level editor: total, per-MP, per-product (с месячной навигацией) | `useSalesPlanSummary(month)` + `useSalesPlan(month, mp)` | GET /summary + GET /sales-plan | Да: blur-save, reset |

### Рекомендуемые дополнения

| Место | Что добавить | Источник данных | Обоснование |
|-------|-------------|-----------------|-------------|
| **Dashboard: PlanCompletionCard** | Ссылка "Редактировать план" -> UE page или Settings | Тот же | Устраняет тупик UX |
| **Dashboard: PlanCompletionCard** | Expandable: breakdown по WB/Ozon | completion response | Контекст без перехода |
| **Onboarding (после 1 месяца данных)** | Подсказка "Поставьте план продаж, средний оборот = X" | historical data | Discoverability |
| **UE: UeTable** | Активация inline edit (уже есть `onPlanSave`) | `useUpsertSalesPlan` | Быстрая коррекция |
| **Dedicated /planning page** | Единая страница с bulk edit, copy, validation | Все hooks | Для Enterprise |

---

## Секция 5: Технологическая карта

### Полная цепочка для каждого компонента

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ КОМПОНЕНТ             HOOK                      API ENDPOINT        DB TABLE    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ SalesPlanEditor       useSalesPlanSummary       GET  /summary       mp_sales_   │
│  (L1: total)          useUpsertSummaryPlan      PUT  /summary       plan_summary│
│                                                                                  │
│ SalesPlanEditor       useSalesPlan              GET  /sales-plan    mp_sales_   │
│  (L3: per-product)    useUpsertSalesPlan        PUT  /sales-plan    plan        │
│                                                                                  │
│ SalesPlanEditor       useResetSalesPlan         DEL  /reset         оба         │
│  (Reset)                                                                        │
│                                                                                  │
│ PlanCompletionCard    useSalesPlanCompletion    GET  /completion    mp_sales_   │
│  (Dashboard)           (filters)                                    plan +      │
│                                                                     plan_summary│
│                                                                     + mp_sales  │
│                                                                                  │
│ UePlanPanel           useSalesPlanCompletion    GET  /completion    (aggregate)  │
│  (UE page)            useSalesPlanSummary       GET  /summary                   │
│                       useUpsertSummaryPlan      PUT  /summary                   │
│                       useResetSalesPlan         DEL  /reset                     │
│                                                                                  │
│ UeTable               planMap (prop)            --                  (derived    │
│  (колонка "План")     planPaceMap (prop)        --                  от parent)  │
│                                                                                  │
│ UeKpiCards            planData (prop)           --                  (от parent) │
│  (KPI "План")                                                                   │
│                                                                                  │
│ UeExpandedRow         wbPlanMap (prop)          --                  (от parent) │
│                       ozonPlanMap (prop)                                         │
│                                                                                  │
│ UePlanMatrix          classifyMatrix()          --                  (computed)  │
│                       (unitProducts + planMap)                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Формулы в каждом звене

```
PlanCompletionCard:
  completion_percent = total_actual / total_plan * 100
  (вычисляется на backend в /completion endpoint)

UePlanPanel:
  totalPace = computePlanPace(totalPlan, totalActual, period)
  dailyPace = actualRevenue / currentDay
  forecastRevenue = dailyPace * totalDays
  forecastPct = forecastRevenue / planRevenue * 100
  requiredDaily = (planRevenue - actualRevenue) / remainingDays
  status = forecastPct >= 105 ? 'ahead' : forecastPct >= 95 ? 'on_track' : 'behind'

UeTable (per-product):
  pct = planMap.get(product_id)  -- completion % от backend
  pace = planPaceMap.get(product_id)  -- computePlanPace(plan, actual, period)

UePlanMatrix (BCG):
  highPlan = completion >= 70%
  profitable = net_profit >= 0
  stars     = highPlan && profitable
  traps     = highPlan && !profitable
  potential = !highPlan && profitable
  problems  = !highPlan && !profitable

Completion priority (backend):
  1. total > 0 ? use total
  2. wb + ozon > 0 ? use MP sum
  3. per-product exists ? use product sum
  4. none
```

### Схема БД

```
mp_sales_plan_summary:
  PK: (user_id, month, level)
  Columns: user_id, month (DATE "YYYY-MM-01"), level ("total"|"wb"|"ozon"),
           plan_revenue (float), updated_at

mp_sales_plan:
  PK: (user_id, product_id, month, marketplace)
  Columns: user_id, product_id (FK mp_products.id), month (DATE "YYYY-MM-01"),
           marketplace ("wb"|"ozon"), plan_revenue (float), updated_at

mp_sales:
  (для completion -- source of actual revenue)
  Columns: user_id, product_id, date, marketplace, revenue, ...
```

---

## Секция 6: Пересечения и конфликты

### Пересечение 1: SalesPlanEditor и UePlanPanel оба правят mp_sales_plan_summary

```
Точки записи:
  A) SalesPlanEditor.saveSummary()
     -> useUpsertSummaryPlan.mutateAsync({ month, level, plan_revenue })
     -> PUT /sales-plan/summary

  B) UePlanPanel.handleSave()
     -> summaryMut.mutateAsync({ month, level, plan_revenue })
     -> PUT /sales-plan/summary  (тот же endpoint!)
```

**Есть ли конфликт?** Нет race condition, т.к.:
- Одна вкладка браузера = один пользователь
- Blur-save паттерн -- один save в момент времени
- Upsert на backend (ON CONFLICT UPDATE) -- idempotent

**Как синхронизируется:**
```
Оба хука используют одинаковый invalidation:
  invalidateQueries({ queryKey: ['sales-plan', 'summary', month] })
  invalidateQueries({ queryKey: ['sales-plan', 'completion'] })

Если пользователь отредактировал в UePlanPanel, а затем
перешел в Settings -- useQuery refetch подхватит новые данные
(staleTime = 5 минут, но invalidation сразу помечает как stale).
```

**Что если рассинхронизировались:**
- Невозможно при одном пользователе в одной вкладке
- При двух вкладках: последний save побеждает (upsert). При переключении между вкладками данные обновятся при refetch (window focus)

### Пересечение 2: SalesPlanEditor и UeTable inline edit оба правят mp_sales_plan

```
Точки записи:
  A) SalesPlanEditor.saveProduct()
     -> useUpsertSalesPlan.mutateAsync({ month, marketplace, items: [{product_id, plan_revenue}] })
     -> PUT /sales-plan

  B) UeTable.onPlanSave (НЕАКТИВЕН -- props есть, но не используются)
     -> UnitEconomicsPage.handlePlanSave()
     -> upsertPlanMut.mutateAsync({ ... })
     -> PUT /sales-plan (тот же endpoint)
```

**Текущий статус:** Конфликта НЕТ, т.к. UeTable inline edit не реализован (props подчеркнуты как unused: `_onPlanSave`, `_planMonth`).

**При активации inline edit:**
- Тот же endpoint, тот же invalidation pattern -- конфликтов не будет
- Но нужно добавить в UeTable использование props `onPlanSave` и `planMonth`

### Пересечение 3: PlanCompletionCard и UeKpiCards оба показывают completion %

```
Источник данных:
  A) PlanCompletionCard:
     -> useSalesPlanCompletion(dashboardFilters)  -- свой query
     -> queryKey: ['sales-plan', 'completion', { date_from, date_to, marketplace }]

  B) UeKpiCards:
     -> planData (prop от UnitEconomicsPage)
     -> UnitEconomicsPage: useSalesPlanCompletion(ueFilters)  -- свой query
     -> queryKey: ['sales-plan', 'completion', { date_from, date_to, marketplace }]
```

**Есть ли конфликт?** Может быть РАЗНИЦА, если:
- Dashboard и UE page используют РАЗНЫЕ date ranges (разные пресеты/custom dates)
- Dashboard marketplace = "all", а UE фильтр = "wb" -- разные completion %

**Это баг или фича?** Фича. Каждая страница показывает completion для СВОЕГО контекста фильтров.

**Как синхронизируется:**
- Invalidation по prefix `['sales-plan', 'completion']` инвалидирует ВСЕ варианты completion queries
- При изменении плана в любом месте -- оба источника рефетчатся

### Пересечение 4: Reset из двух мест (Settings и UE page)

```
  A) SalesPlanEditor -> handleReset -> useResetSalesPlan -> DELETE /sales-plan/reset
  B) UePlanPanel -> handleReset -> resetMut -> useResetSalesPlan -> DELETE /sales-plan/reset
```

**Одинаковая механика:**
- Оба используют `useResetSalesPlan()`
- Оба инвалидируют `['sales-plan']` (весь prefix)
- Оба имеют двухшаговый confirm

**Нет конфликтов**, но UX отличается:
- Settings: текст "Сбросить все планы на Февраль 2026?" + [Да] + [Отмена] (кнопки)
- UE page: "Точно сбросить?" (текст-кнопка, два клика)

---

## Секция 7: Рекомендации

### 1. Можно ли ввести сразу все строчки планов? Как реализовать?

**Да, и это приоритетная фича.**

Текущая проблема: blur-save паттерн (SaveInput) вызывает API на каждый blur. При 5 товарах x 2 MP = 10 последовательных PUT запросов.

**Рекомендация: режим "Bulk Edit"**

```
Реализация:
1. Добавить кнопку "Режим редактирования" (toggle)
2. В bulk mode: убрать blur-save, добавить "Сохранить все" кнопку
3. При "Сохранить все":
   - 1 PUT /sales-plan { items: [все товары WB] } для WB
   - 1 PUT /sales-plan { items: [все товары Ozon] } для Ozon
   - 1-3 PUT /sales-plan/summary (total, wb, ozon -- если изменились)
4. Итого: 2-5 запросов вместо 10+

API уже поддерживает batch:
  PUT /sales-plan { items: [{product_id, plan_revenue}, ...] }
  -- принимает массив items любой длины.
```

**Дополнительно: "Заполнить все одним значением"**
```
Добавить: [Ввод] + [Применить ко всем] кнопку
  -> заполняет все строки одинаковым значением
  -> пользователь корректирует отдельные
  -> "Сохранить все"
```

### 2. Нужна ли валидация согласованности между уровнями?

**Да, но мягкая (warning, не blocking).**

Текущая ситуация: нет никакой валидации. total, WB, Ozon, per-product -- полностью независимы.

**Рекомендация:**
```
Уровень 1 (warning-only):
  - total != wb + ozon -> жёлтый alert:
    "Общий план (200 000) != WB (120 000) + Ozon (80 000) = 200 000"
    или "Общий план (200 000) != WB (130 000) + Ozon (80 000) = 210 000 [+5%]"

  - sum(product plans WB) != WB summary -> жёлтый alert:
    "Сумма товаров WB (115 000) != План WB (120 000)"

Уровень 2 (info):
  - Если total задан, а per-product нет:
    "Подсказка: Задайте план по товарам для BCG-матрицы"

НЕ БЛОКИРОВАТЬ сохранение:
  - Пользователь может сознательно ставить total != sum(products)
    (например, общий план = целевой, а per-product = минимальный)
  - Приоритет completion: total > MP > product -- это уже обработано в backend
```

### 3. Нужен ли auto-calculate (задал total -> распределил по товарам)?

**Да, как опциональная фича.**

**Рекомендация: кнопка "Распределить по весу продаж"**

```
Алгоритм:
1. Пользователь задает total = 200 000 и WB = 120 000, Ozon = 80 000
2. Нажимает "Распределить по товарам"
3. Фронтенд берет доли из mp_sales за последние 30 дней:
   - Товар A: revenue_share_wb = 25% -> WB plan = 120000 * 0.25 = 30 000
   - Товар B: revenue_share_wb = 20% -> WB plan = 120000 * 0.20 = 24 000
   - ...
4. Значения подставляются в inputs (НЕ сохраняются автоматически)
5. Пользователь корректирует -> "Сохранить все"

Fallback (нет истории продаж):
  -> Равномерное распределение: WB plan / количество товаров

UI:
  [Распределить по продажам] [Распределить поровну]
```

**Где данные для весов:** `useUnitEconomics` уже возвращает per-product revenue. Можно использовать `item.metrics.revenue` для расчета share.

### 4. Нужна ли кнопка "Скопировать из прошлого месяца"?

**Однозначно да. Это #1 запрос для повторяющегося планирования.**

**Рекомендация:**

```
UI:
  [Копировать из прошлого месяца] -- появляется если:
    a) текущий месяц пустой (все планы = 0)
    b) прошлый месяц НЕ пустой

Flow:
1. Клик "Копировать из января 2026"
2. Фронтенд делает:
   GET /sales-plan/summary?month=2026-01  -> total, wb, ozon
   GET /sales-plan?month=2026-01&marketplace=wb  -> per-product WB
   GET /sales-plan?month=2026-01&marketplace=ozon  -> per-product Ozon
3. Все значения подставляются в текущий месяц (в state, НЕ сохранены)
4. Пользователь видит заполненные поля с badge "Скопировано из Январь 2026"
5. Корректирует при необходимости
6. Blur-save / "Сохранить все" -- фиксирует

Вариант: "Копировать +X%"
  [Копировать +10%]  -> все значения * 1.10 (рост 10%)
  [Копировать как есть]
```

**Backend:** Никаких изменений не нужно. Фронтенд читает прошлый месяц и пишет в текущий через существующие PUT endpoints.

### 5. Как обрабатывать конфликт total != sum(products)?

**Текущее поведение (backend):**

```python
# Priority в /completion endpoint:
1. total > 0   -> используем total (игнорируем products)
2. wb+ozon > 0 -> используем MP sum (игнорируем products)
3. products    -> используем sum(product plans)
```

Это означает: если задан total = 200 000, а sum(products) = 180 000, Dashboard покажет прогресс к 200 000, а UeTable покажет per-product прогресс к 180 000. **Это расхождение может путать.**

**Рекомендация: трёхуровневая стратегия**

```
Уровень 1 -- Предупреждение (фронтенд):
  Если total != sum(MP) или sum(MP) != sum(products):
  -> Жёлтый alert в SalesPlanEditor/UePlanPanel:
     "Общий план: 200 000 | Сумма по товарам: 180 000 (Δ −20 000)"
     Кнопка: [Выровнять total] -- устанавливает total = sum(products)

Уровень 2 -- Объяснение (UX):
  Tooltip на PlanCompletionCard:
  "Используется общий план (200 000), а не сумма по товарам (180 000),
   т.к. общий план имеет приоритет."

Уровень 3 -- НЕ менять backend логику:
  Приоритет total > MP > product -- это правильно.
  Не нужно автоматически менять total при изменении products.
  Но нужно ПОКАЗЫВАТЬ расхождение.
```

### Дополнительные рекомендации

**6. Активировать inline edit в UeTable**

Всё уже подготовлено: props `onPlanSave` и `planMonth` прокидываются из UnitEconomicsPage. Нужно:
1. Убрать underscore с `_onPlanSave` и `_planMonth` в UeTable
2. Заменить read-only badge на SaveInput в колонке "План"
3. При blur -> вызвать `onPlanSave(mp, productId, value)`

**7. Добавить ссылку на PlanCompletionCard**

```tsx
// PlanCompletionCard.tsx -- добавить:
<Link to="/unit-economics" className="text-xs text-indigo-500">
  Подробнее
</Link>
```

**8. Empty state для Dashboard (нет плана)**

Когда total_plan = 0, вместо "ничего" показывать:
```
+----------------------------------------------+
|  Поставьте план продаж                       |
|  Отслеживайте выполнение в реальном времени  |
|  [Поставить план ->]                         |
+----------------------------------------------+
```

**9. Уведомления о темпе**

Ежедневное/еженедельное push-уведомление (если plan > 0):
- "Темп: 5 200/день. Прогноз: ~82%. Нужно 6 300/день для 100%."
- Реализация: backend cron -> email/telegram (будущая фаза)

---

## Приложение: Полная карта React Query keys

```
['sales-plan', month, marketplace]          -- per-product plans
['sales-plan', 'summary', month]            -- summary (total/wb/ozon)
['sales-plan', 'completion', {filters}]     -- completion % + by_product

Invalidation patterns:
  useUpsertSalesPlan:      ['sales-plan', month, mp] + ['sales-plan', 'completion']
  useUpsertSummaryPlan:    ['sales-plan', 'summary', month] + ['sales-plan', 'completion']
  useResetSalesPlan:       ['sales-plan']  -- ВСЁ (nuclear option)
```

## Приложение: Схема API endpoints

```
GET  /sales-plan              ?month=YYYY-MM&marketplace=wb|ozon
PUT  /sales-plan              { month, marketplace, items: [{product_id, plan_revenue}] }
GET  /sales-plan/summary      ?month=YYYY-MM
PUT  /sales-plan/summary      { month, level: total|wb|ozon, plan_revenue }
GET  /sales-plan/completion   ?date_from=&date_to=&marketplace=
DEL  /sales-plan/reset        ?month=YYYY-MM
```
