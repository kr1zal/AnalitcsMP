"""
Тестовый скрипт для проверки подключения к API маркетплейсов
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Загружаем .env из корня проекта
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Штрихкоды товаров
BARCODES = [
    "4670157464824",  # Магний + В6 хелат 800 мг
    "4670157464831",  # Магний цитрат 800 мг
    "4670157464848",  # L-карнитин 720 мг
    "4670157464770",  # ВИТАМИН D3 + К2 260 МГ
    "4670227414995",  # Тестобустер
]


async def test_wildberries():
    """Тест Wildberries API"""
    print("\n" + "=" * 50)
    print("WILDBERRIES API TEST")
    print("=" * 50)

    token = os.getenv("WB_API_TOKEN")
    if not token:
        print("ERROR: WB_API_TOKEN не найден в .env")
        return []

    headers = {
        "Authorization": token,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Тест 1: Получение карточек
        print("\n1. Получение списка карточек...")
        url = "https://content-api.wildberries.ru/content/v2/get/cards/list"
        payload = {
            "settings": {
                "cursor": {"limit": 100},
                "filter": {"withPhoto": -1}
            }
        }

        try:
            response = await client.post(url, headers=headers, json=payload)
            print(f"   Status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                cards = data.get("cards", [])
                print(f"   Найдено карточек: {len(cards)}")

                # Ищем наши товары
                our_products = []
                for card in cards:
                    for size in card.get("sizes", []):
                        for sku in size.get("skus", []):
                            if sku in BARCODES:
                                our_products.append({
                                    "nmID": card.get("nmID"),
                                    "barcode": sku,
                                    "title": card.get("title"),
                                    "vendorCode": card.get("vendorCode")
                                })

                print(f"\n2. Найдено наших товаров: {len(our_products)}")
                for p in our_products:
                    title = p['title'][:40] if p['title'] else "N/A"
                    print(f"   - nmID: {p['nmID']}, {title}... (ШК: {p['barcode']})")

                return our_products
            else:
                print(f"   Response: {response.text[:500]}")

        except Exception as e:
            print(f"   ERROR: {e}")

    return []


async def test_ozon():
    """Тест Ozon API"""
    print("\n" + "=" * 50)
    print("OZON API TEST")
    print("=" * 50)

    client_id = os.getenv("OZON_CLIENT_ID")
    api_key = os.getenv("OZON_API_KEY")

    if not client_id or not api_key:
        print("ERROR: OZON_CLIENT_ID или OZON_API_KEY не найдены в .env")
        return []

    headers = {
        "Client-Id": client_id,
        "Api-Key": api_key,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Тест 1: Получение списка товаров
        print("\n1. Получение списка товаров...")
        url = "https://api-seller.ozon.ru/v3/product/list"
        payload = {
            "filter": {
                "visibility": "ALL"
            },
            "limit": 100
        }

        try:
            response = await client.post(url, headers=headers, json=payload)
            print(f"   Status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                items = data.get("result", {}).get("items", [])
                print(f"   Найдено товаров: {len(items)}")

                if items:
                    # Получаем детальную информацию
                    product_ids = [item["product_id"] for item in items]
                    offer_ids = [item.get("offer_id", "") for item in items]
                    print(f"   Product IDs: {product_ids}")
                    print(f"   Offer IDs: {offer_ids}")

                    # Используем /v3/product/info/list
                    info_url = "https://api-seller.ozon.ru/v3/product/info/list"
                    info_payload = {"product_id": product_ids}
                    info_response = await client.post(info_url, headers=headers, json=info_payload)
                    print(f"   Info Status: {info_response.status_code}")

                    if info_response.status_code == 200:
                        info_data = info_response.json()
                        products = info_data.get("items", info_data.get("result", {}).get("items", []))

                        # Показываем все найденные товары
                        print(f"\n   Детальная информация о товарах:")
                        our_products = []
                        for p in products:
                            name = p.get("name", "N/A")[:50]
                            product_id = p.get("id")
                            offer_id = p.get("offer_id", "")
                            barcode = p.get("barcode", "") or offer_id  # offer_id = штрихкод в Ozon
                            print(f"   - id: {product_id}, offer_id: {offer_id}")
                            print(f"     name: {name}")

                            # Ищем по offer_id (он же штрихкод)
                            if offer_id in BARCODES:
                                our_products.append({
                                    "product_id": product_id,
                                    "offer_id": offer_id,
                                    "barcode": offer_id,
                                    "name": p.get("name")
                                })

                        print(f"\n2. Найдено по штрихкодам: {len(our_products)}")
                        return our_products
                    else:
                        print(f"   Info Response: {info_response.text[:500]}")
            else:
                print(f"   Response: {response.text[:500]}")

        except Exception as e:
            print(f"   ERROR: {e}")

    return []


async def main():
    print("\n" + "#" * 50)
    print("# ТЕСТ ПОДКЛЮЧЕНИЯ К API МАРКЕТПЛЕЙСОВ")
    print("#" * 50)

    wb_products = await test_wildberries()
    ozon_products = await test_ozon()

    print("\n" + "=" * 50)
    print("ИТОГО")
    print("=" * 50)
    print(f"Wildberries: {len(wb_products)} товаров")
    print(f"Ozon: {len(ozon_products)} товаров")


if __name__ == "__main__":
    asyncio.run(main())
