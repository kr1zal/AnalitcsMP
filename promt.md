# Промпт для нового чата: Analytics Dashboard WB & Ozon

Продолжаем разработку Analytics Dashboard для WB и Ozon.

**Production:** https://analitics.bixirun.ru
**Local:** Backend http://localhost:8000, Frontend http://localhost:5173

---

## ПРОМПТ ДЛЯ КОПИРОВАНИЯ В НОВЫЙ ЧАТ:

```
Продолжаем разработку Analytics Dashboard для WB и Ozon.

**Production:** https://analitics.bixirun.ru (Beget VPS 83.222.16.15)
**Local:** Backend http://localhost:8000, Frontend http://localhost:5173

**Текущее состояние (03.02.2026):**
- Деплой завершён, сайт работает на https://analitics.bixirun.ru
- SSL настроен (Let's Encrypt, автопродление)
- DashboardPage работает, RPC оптимизация активна, mobile-first дизайн готов
- ✅ Cron настроен (07:00, 13:00 — sales+costs; каждые 6ч — stocks)
- ✅ Ozon stocks 400 error исправлен
- ✅ Скелетоны реализованы
- ✅ **Мобильное меню улучшено:** swipe закрытие, компактнее, ярлычок виднее
- ✅ **Экспорт в Excel/PDF (03.02.2026):**
  - Excel: 6 листов (Сводка по OZON/WB, Продажи, Реклама, Удержания, Unit-экономика, Остатки)
  - **PDF: Playwright на backend** — идеальное качество, 3 страницы A4
  - Mobile: кнопки-иконки рядом с МП селектором
  - Backend: playwright + chromium, swap 2GB на сервере

**Текущие задачи:**
- 🔄 Улучшить UnitEconomicsPage (графики, детализация)
- 🔄 Улучшить AdsPage (графики ДРР)

---

## Деплой (03.02.2026):

**VPS Beget:**
- IP: 83.222.16.15
- Ubuntu 24.04, 1 ядро / 1 GB RAM + **2 GB swap**
- Домен: analitics.bixirun.ru (субдомен от bixirun.ru)
- SSL: Let's Encrypt (до 01.05.2026, автопродление)
- **Playwright + Chromium** установлен для PDF экспорта

**Структура на сервере:**
- `/var/www/analytics/backend` — FastAPI
- `/var/www/analytics/frontend` — React build (статика)
- `/var/www/analytics/.env` — API ключи
- systemd сервис: `analytics-api`
- Nginx: проксирует /api/ на :8000

**SSH доступ:**
```bash
ssh root@83.222.16.15
# Логи API
journalctl -u analytics-api -f
# Перезапуск
systemctl restart analytics-api
```

---

## Выполненные задачи (31.01.2026):

### ✅ 1. Ограничение календаря по датам
**Проблема:** Данные WB/Ozon за текущий день появляются только после 10:00 утра (МСК).
**Решение:** Функция `getMaxAvailableDateYmd()` в `utils.ts`:
- До 10:00 МСК → max = вчера (T-1) — сегодня недоступен
- После 10:00 МСК → max = сегодня (T-0) — день в день

### ✅ 2. Tooltips не уезжают за край экрана
**Проблема:** На мобильных правые карточки имели tooltip, уезжающий за правый край.
**Решение:** Добавлен prop `tooltipAlign="right"` в SummaryCard для правых карточек (Прибыль, Реклама, К перечисл., Δ к пред.).

### ✅ 3. Мобильное меню улучшено (02.02.2026)
**Swipe закрытие:** Touch handlers с threshold 60px — свайп вправо закрывает панель.
**Ярлычок виднее:** 16px полоска (было 12px), chevron внутри, 48px touch target, усиленная тень.
**Компактность:** Панель 240px (было 280px), уменьшены отступы, подсказка "← свайп для закрытия".

### ✅ 4. Tooltips с понятными формулами (02.02.2026)
**Было:** Техническая терминология (payout, costs-tree.total_accrued, unit-economics.purchase_costs).
**Стало:** Понятные формулы с цифрами:
- Прибыль = К перечислению − Закупка − Реклама = 2 521₽ − 1 804₽ − 0₽ = 717₽
- ДРР = Реклама / Продажи × 100%
- К перечисл. = Продажи − Удержания МП

### ✅ 5. Унифицированная система отступов (02.02.2026)
**Адаптивная шкала (вариант B):**
- Mobile: mb-4 (16px) между секциями, gap-2 (8px) между карточками
- Tablet: mb-5 (20px) между секциями, gap-3 (12px) между карточками
- Desktop: mb-6 (24px) между секциями, gap-3 (12px) между карточками

### ✅ 6. Экспорт в Excel и PDF (03.02.2026)
**Excel (6 листов):**
- Сводка: разбита по OZON/WB с итогами (Продажи, Начислено, Удержания)
- Продажи по дням, Реклама, Удержания МП, Unit-экономика, Остатки
- Зависимость: xlsx (SheetJS)

**PDF (Playwright на backend):**
- 3 страницы A4 landscape: Dashboard, Unit-экономика, Реклама
- Backend открывает `/print` страницу через Chromium
- Ждёт `data-pdf-ready="true"`, генерирует PDF
- Качество идеальное (настоящий браузер, не canvas)
- Размер: ~76 КБ, генерация ~15-20 сек

**UI:**
- Desktop: кнопки Excel/PDF после МП селектора
- Mobile: компактные кнопки-иконки (9x9) рядом с МП селектором
- Toast: loading → success/error через id replacement

---

## Текущие задачи:
- 🔄 Улучшить UnitEconomicsPage (графики, детализация по товарам)
- 🔄 Улучшить AdsPage (графики ДРР по дням)

---

## Ключевые файлы:

Frontend:
- `frontend/src/pages/DashboardPage.tsx` — главная страница
- `frontend/src/pages/PrintPage.tsx` — страница для PDF (3 секции A4, без UI)
- `frontend/src/pages/UnitEconomicsPage.tsx` — unit-экономика (TODO: улучшить)
- `frontend/src/components/Dashboard/OzonAccrualsCard.tsx` — карточка OZON
- `frontend/src/components/Dashboard/WbAccrualsCard.tsx` — карточка WB
- `frontend/src/components/Shared/FilterPanel.tsx` — фильтры + кнопки экспорта
- `frontend/src/hooks/useExport.ts` — hook для Excel/PDF экспорта
- `frontend/src/lib/exportExcel.ts` — генерация Excel (6 листов)
- `frontend/src/services/api.ts` — API клиент (включая exportApi)

Backend:
- `backend/app/api/v1/dashboard.py` — API endpoints (используют RPC)
- `backend/app/api/v1/export.py` — PDF экспорт через Playwright
- `backend/app/api/v1/sync.py` — синхронизация
- `backend/app/config.py` — настройки (frontend_url для Playwright)
- `backend/migrations/003_all_rpc_functions.sql` — все RPC функции

---

## ВАЖНО:

- **Production URL:** https://analitics.bixirun.ru
- OZON/WB мэтчинг начислений уже 1-в-1 с ЛК — НЕ ЛОМАТЬ
- RPC функции в Supabase — не удалять
- DateRangePicker: `captionLayout="label"` (не dropdown!)
- Не делать git команды без явного согласия

**Локальная разработка:**
- Backend: `cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000`
- Frontend: `cd frontend && npm run dev`

**Деплой изменений:**
```bash
# Frontend
cd frontend && npm run build
sshpass -p 'PASSWORD' rsync -avz --delete dist/ root@83.222.16.15:/var/www/analytics/frontend/

# Backend
sshpass -p 'PASSWORD' rsync -avz --exclude 'venv' --exclude '__pycache__' backend/ root@83.222.16.15:/var/www/analytics/backend/
ssh root@83.222.16.15 "systemctl restart analytics-api"
```

Документация: CLAUDE.md, frontend/README.md, backend/README.md
```

---

## Прошлые ошибки (не повторять):

1. `deferredEnabled` — создавал каскадные ре-рендеры
2. `useInView` с `rootMargin` — не триггерился для далёких элементов
3. Дублирование запросов — каждая AccrualsCard делала свой useCostsTree
4. `include_children: false` — возвращал пустое дерево
5. react-day-picker v8 classNames в v9 — day_selected → selected
6. `grid-cols-1 sm:grid-cols-2` — карточки стекались на mobile
7. `captionLayout="dropdown"` — синхронизировал год между месяцами
8. **SYNC_TOKEN блокировал запросы** — убран токен
9. **RPC не созданы в Supabase** — выполнить 003_all_rpc_functions.sql
10. **config.py env_file="../.env"** — .env должен лежать в родительской папке от backend
11. **НЕ использовать `useCostsTreeCombined`** — архитектурное решение: отдельные параллельные запросы лучше для масштабирования
12. **toast.dismiss() + toast.success()** — использовать `id: loadingToastId` для замены toast вместо dismiss + new
13. **html2canvas для PDF** — заменён на Playwright (качество несопоставимо лучше)

---

## Архитектурные решения (не менять):

- **Costs-tree запросы:** отдельные параллельные запросы для каждого МП (не combined)
  - Причины: progressive rendering, изоляция ошибок, масштабируемость на 3+ МП
  - `useCostsTreeCombined` существует, но НЕ активирован — это намеренно

---

## Технологии:

- **Frontend:** React 19.2, TypeScript 5.9, Vite 7.2, Tailwind CSS 3.4
- **Calendar:** react-day-picker 9.x + date-fns 4.x
- **State:** React Query 5.90, Zustand 5.0
- **Backend:** FastAPI, Supabase (PostgreSQL + RPC), Playwright (PDF)
- **Hosting:** Beget VPS (Ubuntu 24.04, 2GB swap) + Supabase + Let's Encrypt SSL
