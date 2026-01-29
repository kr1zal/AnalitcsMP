"""
Тестовый скрипт для проверки синхронизации данных
Запуск: python test_sync.py
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta

# Добавляем путь к app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Загружаем .env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from app.services.sync_service import SyncService


async def test_sync_products():
    """Тест синхронизации товаров"""
    print("\n" + "="*50)
    print("ТЕСТ: Синхронизация товаров (WB + Ozon ID)")
    print("="*50)

    sync = SyncService()
    result = await sync.sync_products()

    print(f"Статус: {result.get('status')}")
    if result.get('status') == 'success':
        print(f"Обновлено товаров: {result.get('updated')}")
    else:
        print(f"Ошибка: {result.get('message')}")

    return result


async def test_sync_stocks():
    """Тест синхронизации остатков"""
    print("\n" + "="*50)
    print("ТЕСТ: Синхронизация остатков")
    print("="*50)

    sync = SyncService()

    print("\n--- Wildberries ---")
    wb_result = await sync.sync_stocks_wb()
    print(f"Статус: {wb_result.get('status')}")
    if wb_result.get('status') == 'success':
        print(f"Записей: {wb_result.get('records')}")
    else:
        print(f"Ошибка: {wb_result.get('message')}")

    print("\n--- Ozon ---")
    ozon_result = await sync.sync_stocks_ozon()
    print(f"Статус: {ozon_result.get('status')}")
    if ozon_result.get('status') == 'success':
        print(f"Записей: {ozon_result.get('records')}")
    else:
        print(f"Ошибка: {ozon_result.get('message')}")

    return {"wb": wb_result, "ozon": ozon_result}


async def test_sync_sales():
    """Тест синхронизации продаж за последние 7 дней"""
    print("\n" + "="*50)
    print("ТЕСТ: Синхронизация продаж (7 дней)")
    print("="*50)

    sync = SyncService()
    date_from = datetime.now() - timedelta(days=7)
    date_to = datetime.now()

    print(f"Период: {date_from.strftime('%Y-%m-%d')} - {date_to.strftime('%Y-%m-%d')}")

    print("\n--- Wildberries ---")
    wb_result = await sync.sync_sales_wb(date_from, date_to)
    print(f"Статус: {wb_result.get('status')}")
    if wb_result.get('status') == 'success':
        print(f"Записей: {wb_result.get('records')}")
    else:
        print(f"Ошибка: {wb_result.get('message')}")

    print("\n--- Ozon ---")
    ozon_result = await sync.sync_sales_ozon(date_from, date_to)
    print(f"Статус: {ozon_result.get('status')}")
    if ozon_result.get('status') == 'success':
        print(f"Записей: {ozon_result.get('records')}")
    else:
        print(f"Ошибка: {ozon_result.get('message')}")

    return {"wb": wb_result, "ozon": ozon_result}


async def test_sync_costs():
    """Тест синхронизации удержаний за последние 30 дней"""
    print("\n" + "="*50)
    print("ТЕСТ: Синхронизация удержаний (30 дней)")
    print("="*50)

    sync = SyncService()
    date_from = datetime.now() - timedelta(days=30)
    date_to = datetime.now()

    print(f"Период: {date_from.strftime('%Y-%m-%d')} - {date_to.strftime('%Y-%m-%d')}")

    print("\n--- Wildberries ---")
    wb_result = await sync.sync_costs_wb(date_from, date_to)
    print(f"Статус: {wb_result.get('status')}")
    if wb_result.get('status') == 'success':
        print(f"Записей: {wb_result.get('records')}")
    else:
        print(f"Ошибка: {wb_result.get('message')}")

    print("\n--- Ozon ---")
    ozon_result = await sync.sync_costs_ozon(date_from, date_to)
    print(f"Статус: {ozon_result.get('status')}")
    if ozon_result.get('status') == 'success':
        print(f"Записей: {ozon_result.get('records')}")
    else:
        print(f"Ошибка: {ozon_result.get('message')}")

    return {"wb": wb_result, "ozon": ozon_result}


async def test_check_database():
    """Проверить данные в БД после синхронизации"""
    print("\n" + "="*50)
    print("ПРОВЕРКА: Данные в Supabase")
    print("="*50)

    from app.db.supabase import get_supabase_client
    supabase = get_supabase_client()

    # Товары
    products = supabase.table("mp_products").select("*").execute()
    print(f"\nТовары (mp_products): {len(products.data)} записей")
    for p in products.data:
        print(f"  - {p['name'][:30]}... | WB: {p.get('wb_nm_id')} | Ozon: {p.get('ozon_product_id')}")

    # Продажи
    sales = supabase.table("mp_sales").select("*").order("date", desc=True).limit(10).execute()
    print(f"\nПоследние продажи (mp_sales): {len(sales.data)} записей")
    for s in sales.data[:5]:
        print(f"  - {s['date']} | {s['marketplace']} | Заказов: {s['orders_count']} | Выкупов: {s['sales_count']}")

    # Остатки
    stocks = supabase.table("mp_stocks").select("*").execute()
    print(f"\nОстатки (mp_stocks): {len(stocks.data)} записей")
    for st in stocks.data[:5]:
        print(f"  - {st['marketplace']} | {st.get('warehouse', 'N/A')[:20]} | Кол-во: {st['quantity']}")

    # Удержания
    costs = supabase.table("mp_costs").select("*").order("date", desc=True).limit(5).execute()
    print(f"\nУдержания (mp_costs): {len(costs.data)} записей")
    for c in costs.data[:3]:
        print(f"  - {c['date']} | {c['marketplace']} | Комиссия: {c['commission']} | Логистика: {c['logistics']}")

    # Логи синхронизации
    logs = supabase.table("mp_sync_log").select("*").order("finished_at", desc=True).limit(10).execute()
    print(f"\nЛоги синхронизации (mp_sync_log): {len(logs.data)} записей")
    for log in logs.data[:5]:
        print(f"  - {log['marketplace']} | {log['sync_type']} | {log['status']} | Записей: {log['records_count']}")


async def main():
    """Главная функция тестирования"""
    print("\n" + "#"*60)
    print("#  ТЕСТИРОВАНИЕ СЕРВИСА СИНХРОНИЗАЦИИ")
    print("#"*60)

    try:
        # 1. Синхронизация товаров (обновление ID)
        await test_sync_products()

        # 2. Синхронизация остатков
        await test_sync_stocks()

        # 3. Синхронизация продаж
        await test_sync_sales()

        # 4. Синхронизация удержаний
        await test_sync_costs()

        # 5. Проверка данных в БД
        await test_check_database()

        print("\n" + "="*50)
        print("ТЕСТИРОВАНИЕ ЗАВЕРШЕНО")
        print("="*50)

    except Exception as e:
        print(f"\n!!! КРИТИЧЕСКАЯ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
