# Analytics Dashboard - Frontend

React + TypeScript приложение для аналитики продаж на Wildberries и Ozon.

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- Backend запущен на http://localhost:8000

### Запуск

```bash
npm install
npm run dev
```

Приложение: http://localhost:5173

---

## ✅ Что реализовано (MVP v0.1)

- [x] Vite + React + TypeScript + Tailwind CSS
- [x] TypeScript типы на основе backend API
- [x] Axios client + React Query
- [x] DashboardPage: метрики, фильтры, графики, остатки
- [x] MarketplaceBreakdown:
  - WB: карточка метрик
  - OZON: карточка начислений (как в ЛК) `OzonAccrualsCard` + раскрываемая
    детализация
- [x] Подключение к backend API
- [x] Toast уведомления (Sonner)
- [x] StocksTable (операционный вид):
  - сортировка: OOS/критичные товары вверху
  - фильтры: Все / OOS WB / OOS Ozon / Low
  - статусы раздельно: `WB: ...` и `Ozon: ...`
  - “Обновлено … назад” (по `updated_at` из backend)

---

## 📝 Следующие шаги

1. FilterPanel (даты, маркетплейс)
2. SalesChart (Recharts LineChart)
3. StocksTable
4. Unit-Economics страница
5. Синхронизация

---

## 🛠 Технологии

- React 19.2 + TypeScript
- Vite 7.2
- Tailwind CSS 3
- React Query 5.90
- axios, recharts, sonner, date-fns, zustand

---

Подробная документация: см. файлы в корне проекта

- [DESIGN_REFERENCE.md](DESIGN_REFERENCE.md)
- [../DECISIONS.md](../DECISIONS.md)
- [../backend/README.md](../backend/README.md)
- [../ozon/OZON_ACCRUALS_MATCHING.md](../ozon/OZON_ACCRUALS_MATCHING.md)
