# Товары (ProductsTab)

> Управление товарами: 3-колоночный layout (WB | Links | Ozon), drag&drop сортировка, редактирование себестоимости, связывание товаров кросс-МП.

**Правила CLAUDE.md:** #12, #17

## Визуальная структура

```
/settings?tab=products
+-----------------------------------------------------------------------+
| Настройки                                                             |
| +------------------+ +----------------------------------------------+|
| |  Подключения     | | +--- Товары [?] ---------- SKU 5/20 ------+||
| | [Товары]         | | |                                          |||
| |  План продаж     | | |  Wildberries        [?] Ozon             |||
| |  Тариф           | | |  ⋮⋮ Витамин D  [450]  🔒  ⋮⋮ Витамин D [450]||
| |  Профиль         | | |  ⋮⋮ Омега-3    [380]  🔓  ⋮⋮ Омега-3   [380]||
| |                  | | |  ⋮⋮ Магний     [290]  🔓  ⋮⋮ Магний    [290]||
| |                  | | |  ⋮⋮ Цинк      [150]  🔒  ⋮⋮ Цинк     [150]||
| |                  | | |  ⋮⋮ Коллаген  [520]       ⋮⋮ Коллаген [520]||
| |                  | | |                                          |||
| |                  | | | 🔒 = авто-связь (один баркод, нельзя      |||
| |                  | | |      разорвать)                           |||
| |                  | | | 🔓 = ручная связь (можно разорвать)        |||
| |                  | | | 🔓(серый) = не связаны (нажать = связать) |||
| |                  | | +------------------------------------------+||
| +------------------+ +----------------------------------------------+|
+-----------------------------------------------------------------------+

Модалки (click-to-open, НЕ hover):
[?] "Управление товарами"  — InfoModal (bottom-sheet mobile, center desktop)
[?] "Связь товаров WB+Ozon" — InfoModal (описание авто/ручной связи)
CC Conflict Modal — при разной себестоимости, выбор цены
Unlink Confirmation — "Разорвать связь?" с подтверждением
```

## Файлы

| Компонент | Путь | Props / Exports |
|-----------|------|-----------------|
| ProductsTab | `frontend/src/components/Settings/ProductsTab.tsx` | Обёртка (12 строк), рендерит ProductManagement |
| ProductManagement | `frontend/src/components/Settings/ProductManagement.tsx` | Main component (749 строк) |
| useProducts | `frontend/src/hooks/useProducts.ts` | Hook (staleTime: 5min) |
| useUpdatePurchasePrice | `frontend/src/hooks/useProducts.ts` | Mutation, invalidates `['products', 'dashboard']` |
| useReorderProducts | `frontend/src/hooks/useProducts.ts` | Mutation, invalidates `['products']` |
| useLinkProducts | `frontend/src/hooks/useProducts.ts` | Mutation, invalidates `['products']` |
| useUnlinkProducts | `frontend/src/hooks/useProducts.ts` | Mutation, invalidates `['products']` |
| productsApi | `frontend/src/services/api.ts` (строки 161-225) | `getAll`, `updatePurchasePrice`, `reorder`, `link`, `unlink` |
| products.py | `backend/app/api/v1/products.py` | Router: GET/PUT/POST /products |
| Product (type) | `frontend/src/types/index.ts` (строки 15-29) | Interface |

## Data Flow

### Загрузка списка товаров

```
ProductManagement
  └─ useProducts()
       queryKey: ['products']
       staleTime: 5min (300000ms)
       └─ API: productsApi.getAll()
            └─ GET /api/v1/products
                 └─ Backend: products.py → get_products() (строки 40-73)
                      └─ SELECT * FROM mp_products
                           WHERE user_id=... AND barcode != 'WB_ACCOUNT'
                           ORDER BY sort_order
```

### Фильтрация WB / Ozon (фронтенд)

```
ProductManagement (строки 470-478)
  ├─ wbProducts = useMemo(() =>
  |     products.filter(p => p.wb_nm_id).sort(by sort_order))
  └─ ozonProducts = useMemo(() =>
        products.filter(p => p.ozon_product_id).sort(by sort_order))
```

Один товар может быть в ОБЕИХ колонках (если имеет и `wb_nm_id`, и `ozon_product_id`).

### Обновление себестоимости

```
SortableProductRow → onBlur (input)
  └─ ProductManagement.handlePriceChange(productId, price)
       └─ useUpdatePurchasePrice.mutate({ productId, price })
            └─ API: productsApi.updatePurchasePrice(productId, price)
                 └─ PUT /api/v1/products/{id}/purchase-price
                      └─ Backend: products.py → update_purchase_price() (строки 132-190)
                           ├─ UPDATE mp_products SET purchase_price WHERE id=...
                           └─ Если product_group_id:
                                └─ UPDATE mp_products SET purchase_price
                                   WHERE product_group_id=... AND id!=...
                                   (все связанные товары)
```

### Drag&Drop сортировка

```
ProductColumn → DndContext.onDragEnd
  └─ arrayMove(products, oldIndex, newIndex)
       └─ ProductManagement.handleReorder(newProducts)
            └─ useReorderProducts.mutate(items: [{product_id, sort_order}, ...])
                 └─ API: productsApi.reorder(items)
                      └─ PUT /api/v1/products/reorder
                           └─ Backend: products.py → reorder_products() (строки 193-221)
                                └─ for item in items:
                                     UPDATE mp_products SET sort_order WHERE id=...
```

### Связывание товаров (Link)

```
LinkColumn → [Unlock icon] → onClick
  └─ ProductManagement.handleLink(wb, ozon) (строки 508-529)
       ├─ Если purchase_price совпадает:
       |     └─ useLinkProducts.mutate({ wbId, ozonId, purchasePrice })
       └─ Если purchase_price различается:
             ├─ 1. setShakeIds([wb.id, ozon.id]) — анимация shake 0.4с
             └─ 2. setTimeout(450ms) → setConflict({ wbProduct, ozonProduct })
                    └─ CCConflictModal → onResolve(wbId, ozonId, выбранная цена)
                         └─ useLinkProducts.mutate(...)

useLinkProducts.mutate → API: productsApi.link(wbId, ozonId, purchasePrice)
  └─ POST /api/v1/products/link
       └─ Backend: products.py → link_products() (строки 224-297)
            ├─ Валидация: один WB, другой Ozon, не один и тот же
            ├─ group_id = существующий || uuid.uuid4()
            └─ UPDATE обоих: product_group_id=group_id, purchase_price=price
```

### Разрыв связи (Unlink)

```
LinkColumn → [Lock icon] → onClick (только для ручных связей)
  └─ ProductManagement.handleUnlinkClick(groupId) → setUnlinkConfirm(groupId)
       └─ Unlink Confirmation Modal → [Разорвать]
            └─ handleUnlinkConfirm()
                 └─ useUnlinkProducts.mutate(groupId)
                      └─ API: productsApi.unlink(groupId)
                           └─ POST /api/v1/products/unlink/{group_id}
                                └─ Backend: products.py → unlink_products() (строки 300-332)
                                     └─ UPDATE mp_products
                                        SET product_group_id=NULL
                                        WHERE product_group_id=... AND user_id=...
```

## 3-колоночный layout (правило #17)

### Структура

```
<div className="flex gap-0 sm:gap-1">
  <ProductColumn title="Wildberries" />   ← flex-1 min-w-0
  <LinkColumn />                           ← w-6 sm:w-10, flex-shrink-0
  <ProductColumn title="Ozon" />           ← flex-1 min-w-0
</div>
```

- Каждая `ProductColumn` — независимый `DndContext` с `SortableContext`
- Drag&drop работает ВНУТРИ колонки (нельзя перетащить из WB в Ozon)
- `LinkColumn` отображает иконки Lock/Unlock между строками с одинаковым индексом

### Layout constants (общие для 3 колонок)

```typescript
const ROW_H = 'h-[44px] sm:h-[40px]';   // строка товара = строка замка
const HEADER_H = 'h-7';                   // заголовок колонки (28px)
```

### Типы связей в LinkColumn (строки 248-299)

| Тип | Условие | Иконка | Клик |
|-----|---------|--------|------|
| Авто-связь | `wb.id === ozon.id` (один товар в БД) | Lock (indigo-400) | disabled |
| Ручная связь | `wb.product_group_id === ozon.product_group_id` | Lock (indigo-600) | onUnlink (с подтверждением) |
| Не связаны | Остальные | Unlock (gray-300) | onLink |

## Drag&Drop через @dnd-kit

### Sensors (строки 182-185)

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
);
```

- `PointerSensor`: активация после 5px перемещения (предотвращает случайный drag при клике)
- `TouchSensor`: задержка 150мс + tolerance 5px (для мобильных)

### SortableProductRow (строки 75-163)

Использует `useSortable` из `@dnd-kit/sortable`:
- `setNodeRef` — ref на DOM-элемент
- `transform`, `transition` — CSS для анимации перетаскивания
- `attributes`, `listeners` — привязка к drag handle (GripVertical иконка)
- `isDragging`: opacity 0.5 + bg-indigo-50 + shadow-md

### DragEnd handler (строки 187-193)

```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  const oldIndex = products.findIndex(p => p.id === active.id);
  const newIndex = products.findIndex(p => p.id === over.id);
  onReorder(arrayMove(products, oldIndex, newIndex));
};
```

## Редактирование себестоимости

### SortableProductRow price input (строки 100-113)

- Local state `localPrice` синхронизируется с `product.purchase_price` через `useEffect`
- Сохранение: `onBlur` (и `Enter` через `inputRef.blur()`)
- Валидация: `parseFloat`, `>= 0`, не равно текущей цене
- При ошибке: откат к серверному значению

### Shake animation при конфликте (строки 32-39)

```css
@keyframes pm-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
  20%, 40%, 60%, 80% { transform: translateX(3px); }
}
```

- Инжектируется через `<style>` тег (строка 580)
- Применяется к input через `shakeIds: Set<string>` — красная рамка + анимация 0.4с

## CC Conflict Modal (строки 304-394)

Модальное окно при различающейся себестоимости:

```
+--------------------------------+
| Себестоимость не совпадает   [X]|
|                                |
| WB: Витамин D           450₽  |
| Ozon: Витамин D          380₽  |
|                                |
| Какую себестоимость?           |
| [450₽ (WB)]                   |
| [380₽ (Ozon)]                 |
| [______] [OK] (своя цена)     |
+--------------------------------+
```

- 3 варианта: цена WB, цена Ozon, произвольная
- Подтверждение: `linkMut.mutate({ wbId, ozonId, purchasePrice })`

## Help Modals (правило #12: click-to-open, НЕ hover)

### InfoModal (строки 423-451)

- **Desktop:** `items-center`, `rounded-xl`, `max-w-sm`
- **Mobile:** bottom-sheet, `items-end`, `rounded-t-2xl`, `w-full`
- Закрытие: клик по overlay или кнопка X

### "Управление товарами" (строки 658-682)

Содержимое:
- Откуда берутся товары (автоимпорт при sync)
- Себестоимость (число справа, используется для расчёта прибыли)
- Порядок отображения (drag&drop)
- Группы товаров (связанные делят CC)
- SKU лимит по тарифу

### "Связь товаров WB + Ozon" (строки 684-712)

Содержимое:
- Авто-связь (Lock indigo-400): один штрихкод, разорвать нельзя
- Ручная связь (Lock indigo-600): нажать = разорвать
- Не связаны (Unlock gray-400): нажать = связать

## Backend логика

### GET /products (products.py, строки 40-73)

```python
query = supabase.table("mp_products")
    .select("*")
    .eq("user_id", current_user.id)
    .neq("barcode", "WB_ACCOUNT")    # Фильтрует системный товар
    .order("sort_order")
```

- Опциональная фильтрация по marketplace: `wb_nm_id IS NOT NULL` / `ozon_product_id IS NOT NULL`
- Возвращает: `{ status, count, products[] }`

### PUT /products/{id}/purchase-price (products.py, строки 132-190)

1. Находит товар по `id + user_id`
2. Обновляет `purchase_price` и `updated_at`
3. Если товар в группе (`product_group_id`):
   - Обновляет ВСЕ товары с тем же `product_group_id`
   - Возвращает `linked_updated` (количество обновлённых связанных)

### PUT /products/reorder (products.py, строки 193-221)

Массовое обновление `sort_order`:
```python
for item in body.items:
    UPDATE mp_products SET sort_order=item.sort_order WHERE id=item.product_id AND user_id=...
```

### POST /products/link (products.py, строки 224-297)

Валидация:
- Первый товар ДОЛЖЕН иметь `wb_nm_id`
- Второй товар ДОЛЖЕН иметь `ozon_product_id`
- Товары НЕ должны быть одним и тем же

Логика `group_id`:
```python
group_id = wb_product.product_group_id
        or ozon_product.product_group_id
        or str(uuid.uuid4())
```

Обновляет ОБА товара: `product_group_id`, `purchase_price`, `updated_at`.

### POST /products/unlink/{group_id} (products.py, строки 300-332)

```python
UPDATE mp_products SET product_group_id=NULL WHERE product_group_id={group_id} AND user_id=...
```

`purchase_price` остаётся как есть.

## Product type

```typescript
// frontend/src/types/index.ts, строки 15-29
interface Product {
  id: string;
  barcode: string;
  name: string;
  purchase_price: number;
  wb_nm_id?: number | null;
  wb_vendor_code?: string | null;
  ozon_product_id?: number | null;
  ozon_offer_id?: string | null;
  ozon_sku?: string | null;
  sort_order: number;
  product_group_id?: string | null;
  created_at: string;
  updated_at: string;
}
```

## Ozon Pro Lock

Если подписка не включает Ozon (`subscription.limits.marketplaces` не содержит `'ozon'`):
- Вместо колонки Ozon + LinkColumn показывается `OzonProOverlay` (строки 398-419)
- Lock icon + "Доступно на Pro" + CTA "Подключить Pro -- 990 руб./мес"

## SKU Counter

Компонент: `SKUCounter` (строки 55-71)

```
ratio = current / max
  >= 1.0  → red    "SKU 6/5" (лимит превышен)
  >= 0.8  → amber  "SKU 4/5" (близко к лимиту)
  <  0.8  → green  "SKU 3/5" (в норме)
  max=null → gray  "SKU: 5" (нет лимита)
```

При превышении лимита: warning banner "Лимит SKU превышен... Новые товары не будут импортироваться" (строки 593-607).

## Состояние и кэширование

- **React Query key:** `['products']` — staleTime: 5min
- **Zustand:** не используется
- **Invalidation:**
  - `useUpdatePurchasePrice` -> `['products', 'dashboard']` (цена влияет на прибыль)
  - `useReorderProducts` -> `['products']`
  - `useLinkProducts` -> `['products']`
  - `useUnlinkProducts` -> `['products']`
- **Подписка:** `useSubscription()` для SKU лимита и Ozon доступности

## Edge Cases

1. **Нет товаров** — сообщение "Товары появятся после первой синхронизации" (строки 609-614)
2. **SKU лимит превышен** — red warning banner, новые товары не импортируются при sync
3. **Один товар в двух колонках** — товар с `wb_nm_id` И `ozon_product_id` показан в обеих, `wb.id === ozon.id` = авто-связь
4. **Разная себестоимость при связывании** — shake animation (0.4с) + CCConflictModal с выбором цены
5. **Ozon недоступен на тарифе** — OzonProOverlay вместо колонки Ozon
6. **Drag&drop на мобильном** — TouchSensor с delay 150мс (предотвращает scroll-конфликт)
7. **Optimistic update** — нет explicit optimistic update; React Query refetch после mutation
8. **Пустая себестоимость** — `localPrice = ''`, при blur откатывается к серверному значению

## Зависимости

- **Зависит от:** SettingsPage (tab controller), @dnd-kit/core + @dnd-kit/sortable (drag&drop), useSubscription (SKU лимит)
- **Используется в:** SettingsPage -> ProductsTab (единственный потребитель)
- **Feature gate:** Ozon-колонка требует Pro+ (marketplaces includes 'ozon')
- **БД таблицы:** `mp_products` (поля: id, user_id, barcode, name, purchase_price, wb_nm_id, ozon_product_id, product_group_id, sort_order)

## API Endpoints (сводка)

| Метод | Endpoint | Назначение |
|-------|----------|------------|
| GET | `/products` | Список товаров (без WB_ACCOUNT) |
| GET | `/products/{id}` | Товар по UUID |
| GET | `/products/barcode/{barcode}` | Товар по штрихкоду |
| PUT | `/products/{id}/purchase-price` | Обновить CC (+ связанные) |
| PUT | `/products/reorder` | Массовое обновление sort_order |
| POST | `/products/link` | Связать WB + Ozon товары |
| POST | `/products/unlink/{group_id}` | Разорвать связь |

## Известные проблемы

- [ ] Нет batch-валидации себестоимости (каждое изменение = отдельный API-вызов)
- [ ] Drag&drop работает только внутри одной колонки (нет cross-column DnD)
- [ ] Reorder mutation не optimistic — видимый lag на медленном соединении
