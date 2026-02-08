"""
Сервис синхронизации данных с маркетплейсов
Загружает данные из WB и Ozon в Supabase
"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from decimal import Decimal

from .wb_client import WildberriesClient
from .ozon_client import OzonClient, OzonPerformanceClient
from ..db.supabase import get_supabase_client
from ..config import get_settings

logger = logging.getLogger(__name__)


class SyncService:
    """Сервис синхронизации данных с маркетплейсов в Supabase"""

    def __init__(self, user_id: str | None = None):
        settings = get_settings()
        self.supabase = get_supabase_client()
        self.user_id = user_id

        # Загружаем токены: сначала из БД (per-user), fallback на .env
        wb_tok, oz_cid, oz_key, oz_perf_cid, oz_perf_sec = self._load_tokens(user_id, settings)
        self.wb_client = WildberriesClient(wb_tok)
        self.ozon_client = OzonClient(oz_cid, oz_key)
        self.ozon_perf_client = OzonPerformanceClient(oz_perf_cid, oz_perf_sec)

        # Штрихкоды наших товаров
        self.barcodes = [
            "4670157464824",  # Магний + В6 хелат 800 мг
            "4670157464831",  # Магний цитрат 800 мг
            "4670157464848",  # L-карнитин 720 мг
            "4670157464770",  # Витамин D3 + К2 260 мг
            "4670227414995",  # Тестобустер
        ]

        # Маппинг Ozon Analytics SKU → barcode (временное решение)
        # TODO: добавить колонку ozon_sku в mp_products
        self.ozon_sku_map = {
            "1659212207": "4670157464770",  # Витамин D3 + К2
            "1659298299": "4670157464848",  # L-карнитин
            "1691361926": "4670227414995",  # Тестобустер
            "1658273141": "4670157464824",  # Магний + В6 хелат
            "1658286198": "4670157464831",  # Магний цитрат
        }

    def _load_tokens(self, user_id: str | None, settings) -> tuple:
        """Загрузить токены: БД (per-user) → fallback на .env."""
        from ..crypto import decrypt_token

        if user_id:
            try:
                result = (
                    self.supabase.table("mp_user_tokens")
                    .select("wb_api_token, ozon_client_id, ozon_api_key, ozon_perf_client_id, ozon_perf_secret")
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    row = result.data[0]
                    return (
                        decrypt_token(row.get("wb_api_token") or "") or settings.wb_api_token,
                        decrypt_token(row.get("ozon_client_id") or "") or settings.ozon_client_id,
                        decrypt_token(row.get("ozon_api_key") or "") or settings.ozon_api_key,
                        decrypt_token(row.get("ozon_perf_client_id") or "") or settings.ozon_performance_client_id,
                        decrypt_token(row.get("ozon_perf_secret") or "") or settings.ozon_performance_client_secret,
                    )
            except Exception as e:
                logger.warning(f"Failed to load user tokens from DB, falling back to .env: {e}")

        # Fallback: .env
        return (
            settings.wb_api_token,
            settings.ozon_client_id,
            settings.ozon_api_key,
            settings.ozon_performance_client_id,
            settings.ozon_performance_client_secret,
        )

    def _log_sync(self, marketplace: str, sync_type: str, status: str,
                  records_count: int = 0, error_message: str = None,
                  started_at: datetime = None):
        """Записать лог синхронизации в БД"""
        row = {
            "marketplace": marketplace,
            "sync_type": sync_type,
            "status": status,
            "records_count": records_count,
            "error_message": error_message,
            "started_at": started_at.isoformat() if started_at else None,
            "finished_at": datetime.now().isoformat(),
        }
        if self.user_id:
            row["user_id"] = self.user_id
        self.supabase.table("mp_sync_log").insert(row).execute()

    def _get_product_id_by_barcode(self, barcode: str) -> Optional[str]:
        """Получить UUID товара по штрихкоду"""
        query = self.supabase.table("mp_products").select("id").eq("barcode", barcode)
        if self.user_id:
            query = query.eq("user_id", self.user_id)
        result = query.execute()
        if result.data:
            return result.data[0]["id"]
        return None

    def _get_products_map(self) -> dict:
        """Получить словарь товаров {barcode: {id, wb_nm_id, ozon_product_id}}"""
        query = self.supabase.table("mp_products").select("*")
        if self.user_id:
            query = query.eq("user_id", self.user_id)
        result = query.execute()
        return {p["barcode"]: p for p in result.data}

    def _get_or_create_system_product_id(self, barcode: str, name: str) -> str:
        """
        Создаёт (если нужно) системный товар-заглушку для операций WB без привязки к товару
        (например, хранение/прочие удержания на уровне аккаунта).

        Важно: purchase_price в схеме NOT NULL → ставим 0.
        """
        query = self.supabase.table("mp_products").select("id").eq("barcode", barcode)
        if self.user_id:
            query = query.eq("user_id", self.user_id)
        existing = query.execute()
        if existing.data:
            return existing.data[0]["id"]

        row = {
            "barcode": barcode,
            "name": name,
            "purchase_price": 0,
            "updated_at": datetime.now().isoformat(),
        }
        if self.user_id:
            row["user_id"] = self.user_id
        inserted = self.supabase.table("mp_products").insert(row).execute()
        # Supabase returns inserted row(s) in data for insert
        if inserted.data:
            return inserted.data[0]["id"]

        # Fallback: try re-select (in case insert returned empty but succeeded)
        query = self.supabase.table("mp_products").select("id").eq("barcode", barcode)
        if self.user_id:
            query = query.eq("user_id", self.user_id)
        existing = query.execute()
        if existing.data:
            return existing.data[0]["id"]
        raise RuntimeError(f"Failed to create system product for barcode={barcode}")

    # ==================== СИНХРОНИЗАЦИЯ ТОВАРОВ ====================

    async def sync_products(self) -> dict:
        """
        Синхронизация идентификаторов товаров с WB и Ozon
        Обновляет wb_nm_id, wb_vendor_code, ozon_product_id, ozon_offer_id
        """
        started_at = datetime.now()
        updated_count = 0
        errors = []

        try:
            # Получаем товары из WB
            wb_result = await self.wb_client.get_cards_by_barcode(self.barcodes)
            wb_cards = wb_result.get("cards", [])

            for card in wb_cards:
                nm_id = card.get("nmID")
                vendor_code = card.get("vendorCode")

                # Находим штрихкод в sizes -> skus
                for size in card.get("sizes", []):
                    for barcode in size.get("skus", []):
                        if barcode in self.barcodes:
                            # Обновляем в БД
                            query = self.supabase.table("mp_products").update({
                                "wb_nm_id": nm_id,
                                "wb_vendor_code": vendor_code,
                                "updated_at": datetime.now().isoformat()
                            }).eq("barcode", barcode)
                            if self.user_id:
                                query = query.eq("user_id", self.user_id)
                            query.execute()
                            updated_count += 1
                            logger.info(f"WB: обновлен товар {barcode} -> nm_id={nm_id}")

            # Получаем товары из Ozon (offer_id = штрихкод)
            ozon_result = await self.ozon_client.get_product_list(limit=100)
            ozon_products = ozon_result.get("result", {}).get("items", [])

            for product in ozon_products:
                product_id = product.get("product_id")
                offer_id = product.get("offer_id")  # offer_id = штрихкод в Ozon

                if offer_id in self.barcodes:
                    query = self.supabase.table("mp_products").update({
                        "ozon_product_id": product_id,
                        "ozon_offer_id": offer_id,
                        "updated_at": datetime.now().isoformat()
                    }).eq("barcode", offer_id)
                    if self.user_id:
                        query = query.eq("user_id", self.user_id)
                    query.execute()
                    updated_count += 1
                    logger.info(f"Ozon: обновлен товар {offer_id} -> product_id={product_id}")

            self._log_sync("all", "products", "success", updated_count, started_at=started_at)
            return {"status": "success", "updated": updated_count}

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Ошибка синхронизации товаров: {error_msg}")
            self._log_sync("all", "products", "error", 0, error_msg, started_at)
            return {"status": "error", "message": error_msg}

    # ==================== СИНХРОНИЗАЦИЯ ПРОДАЖ ====================

    async def sync_sales_wb(self, date_from: datetime, date_to: datetime = None) -> dict:
        """Синхронизация продаж с Wildberries"""
        started_at = datetime.now()
        date_to = date_to or datetime.now()
        records_count = 0

        try:
            products_map = self._get_products_map()

            # Источник истины для WB: финансовый отчёт reportDetailByPeriod (как в ЛК).
            # Важно: берём daily разрез, чтобы совпадать по датам.
            report = await self.wb_client.get_report_detail(date_from, date_to, period="daily")

            # Группируем по дате rr_dt и nm_id
            # sales/revenue считаем только по строкам "Продажа/Продажа".
            sales_agg = {}  # {(nm_id, date): {sales, returns, revenue}}

            for row in report:
                nm_id = row.get("nm_id")
                date = (row.get("rr_dt") or "")[:10]
                if not nm_id or not date:
                    continue
                key = (nm_id, date)
                if key not in sales_agg:
                    sales_agg[key] = {"sales": 0, "returns": 0, "revenue": 0.0}

                doc = str(row.get("doc_type_name") or "")
                oper = str(row.get("supplier_oper_name") or "")

                try:
                    qty = int(row.get("quantity") or 0)
                except Exception:
                    qty = 0

                # Выкупы
                if doc == "Продажа" and oper == "Продажа":
                    if qty <= 0:
                        qty = 1
                    sales_agg[key]["sales"] += qty
                    sales_agg[key]["revenue"] += float(row.get("retail_amount", 0) or 0)
                # Возвраты/сторно (best-effort)
                elif "Возврат" in doc or "Возврат" in oper or "Сторно" in doc or "Сторно" in oper:
                    if qty <= 0:
                        qty = 1
                    sales_agg[key]["returns"] += abs(qty)

            # Сохраняем в БД
            for (nm_id, date), data in sales_agg.items():
                # Находим товар по nm_id
                product_id = None
                for barcode, product in products_map.items():
                    if product.get("wb_nm_id") == nm_id:
                        product_id = product["id"]
                        break

                if not product_id:
                    continue

                # В reportDetailByPeriod нет заказов как сущности.
                # Для совместимости считаем orders = sales + returns (как "продажи и возвраты").
                orders_count = int(data["sales"] + data["returns"])
                buyout_percent = round(data["sales"] / orders_count * 100, 2) if orders_count > 0 else None

                # Upsert в mp_sales
                row = {
                    "product_id": product_id,
                    "marketplace": "wb",
                    "date": date,
                    "orders_count": orders_count,
                    "sales_count": data["sales"],
                    "returns_count": data["returns"],
                    "revenue": data["revenue"],
                    "buyout_percent": buyout_percent,
                }
                if self.user_id:
                    row["user_id"] = self.user_id
                self.supabase.table("mp_sales").upsert(
                    row, on_conflict="user_id,product_id,marketplace,date"
                ).execute()
                records_count += 1

            # Получаем воронку (cart_adds) если есть nm_ids
            nm_ids = [p.get("wb_nm_id") for p in products_map.values() if p.get("wb_nm_id")]
            if nm_ids:
                try:
                    funnel = await self.wb_client.get_funnel(date_from, date_to, nm_ids)
                    for card in funnel.get("data", {}).get("cards", []):
                        nm_id = card.get("nmID")
                        # Находим product_id
                        product_id = None
                        for barcode, product in products_map.items():
                            if product.get("wb_nm_id") == nm_id:
                                product_id = product["id"]
                                break

                        if product_id:
                            for stat in card.get("statistics", {}).get("selectedPeriod", {}).get("conversions", []):
                                # Обновляем cart_adds за период
                                cart_adds = stat.get("addToCart", 0)
                                query = self.supabase.table("mp_sales").update({
                                    "cart_adds": cart_adds
                                }).eq("product_id", product_id).eq("marketplace", "wb").gte("date", date_from.strftime("%Y-%m-%d"))
                                if self.user_id:
                                    query = query.eq("user_id", self.user_id)
                                query.execute()
                except Exception as e:
                    logger.warning(f"Не удалось получить воронку WB: {e}")

            self._log_sync("wb", "sales", "success", records_count, started_at=started_at)
            return {"status": "success", "records": records_count}

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Ошибка синхронизации продаж WB: {error_msg}")
            self._log_sync("wb", "sales", "error", 0, error_msg, started_at)
            return {"status": "error", "message": error_msg}

    async def sync_sales_ozon(self, date_from: datetime, date_to: datetime = None) -> dict:
        """Синхронизация продаж с Ozon (по дням)"""
        started_at = datetime.now()
        date_to = date_to or datetime.now()
        records_count = 0

        try:
            products_map = self._get_products_map()

            # Получаем аналитику с разбивкой по SKU и дням
            analytics = await self.ozon_client.get_analytics_data(
                date_from, date_to,
                dimensions=["sku", "day"],
                metrics=["ordered_units", "revenue", "returns", "session_view", "hits_tocart"]
            )

            for row in analytics.get("result", {}).get("data", []):
                dimensions = row.get("dimensions", [])
                metrics = row.get("metrics", [])

                if len(dimensions) < 2:
                    continue

                sku = str(dimensions[0].get("id"))
                day_str = dimensions[1].get("id", "")  # формат "2026-01-16"

                if not day_str:
                    continue

                # Находим barcode через маппинг SKU
                barcode = self.ozon_sku_map.get(sku)
                if not barcode:
                    logger.warning(f"Товар с Ozon SKU {sku} не найден в маппинге")
                    continue

                # Находим product_id по barcode
                product_id = None
                if barcode in products_map:
                    product_id = products_map[barcode]["id"]

                if not product_id:
                    logger.warning(f"Товар с barcode {barcode} не найден в БД")
                    continue

                # Метрики: [ordered_units, revenue, returns, session_view, hits_tocart]
                orders = int(metrics[0]) if len(metrics) > 0 else 0
                revenue = float(metrics[1]) if len(metrics) > 1 else 0
                returns = int(metrics[2]) if len(metrics) > 2 else 0
                cart_adds = int(metrics[4]) if len(metrics) > 4 else 0

                # Пропускаем дни без активности
                if orders == 0 and revenue == 0 and returns == 0:
                    continue

                # Upsert с реальной датой
                upsert_row = {
                    "product_id": product_id,
                    "marketplace": "ozon",
                    "date": day_str,
                    "orders_count": orders,
                    "sales_count": orders - returns,
                    "returns_count": returns,
                    "revenue": revenue,
                    "cart_adds": cart_adds,
                    "buyout_percent": round((orders - returns) / orders * 100, 2) if orders > 0 else None,
                }
                if self.user_id:
                    upsert_row["user_id"] = self.user_id
                self.supabase.table("mp_sales").upsert(
                    upsert_row, on_conflict="user_id,product_id,marketplace,date"
                ).execute()
                records_count += 1

            self._log_sync("ozon", "sales", "success", records_count, started_at=started_at)
            return {"status": "success", "records": records_count}

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Ошибка синхронизации продаж Ozon: {error_msg}")
            self._log_sync("ozon", "sales", "error", 0, error_msg, started_at)
            return {"status": "error", "message": error_msg}

    # ==================== СИНХРОНИЗАЦИЯ ОСТАТКОВ ====================

    async def sync_stocks_wb(self) -> dict:
        """Синхронизация остатков с Wildberries"""
        started_at = datetime.now()
        records_count = 0

        try:
            products_map = self._get_products_map()

            # WB stocks — срез по складам. Для "активного" остатка используем поле quantity.
            #
            # ВАЖНО: /api/v1/supplier/stocks параметр dateFrom ведёт себя как "изменения с даты",
            # поэтому ответ может быть НЕ полным снапшотом по всем складам/товарам.
            # Следствие: нельзя удалять отсутствующие в ответе склады, иначе будем терять остатки
            # на складах, где не было изменений (пример: "Электросталь" на скрине).
            #
            # Чтобы получить ПОЛНЫЙ срез "как в ЛК", WB рекомендует передавать максимально раннюю дату
            # (иначе при свежем dateFrom API возвращает только изменения по складам/товарам).
            stocks = await self.wb_client.get_stocks(datetime(2019, 6, 20))

            if not stocks:
                logger.warning("WB stocks: API returned empty list (skip DB update to avoid wiping data)")
                self._log_sync("wb", "stocks", "success", 0, started_at=started_at)
                return {"status": "success", "records": 0}

            barcode_to_pid: dict[str, str] = {}
            nm_to_pid: dict[int, str] = {}
            for bc, p in products_map.items():
                pid = p.get("id")
                if pid and bc:
                    barcode_to_pid[str(bc).strip()] = pid
                nm = p.get("wb_nm_id")
                if pid and nm:
                    try:
                        nm_int = int(nm)
                        # Если внезапно несколько product_id на один nm_id — логируем, но не валим.
                        if nm_int in nm_to_pid and nm_to_pid[nm_int] != pid:
                            logger.warning(f"WB stocks: multiple product_ids for nm_id={nm_int}: {nm_to_pid[nm_int]} vs {pid}")
                        else:
                            nm_to_pid[nm_int] = pid
                    except Exception:
                        pass

            def _pid_for_stock_row(row: dict) -> str | None:
                bc = str(row.get("barcode") or "").strip()
                if bc:
                    pid = barcode_to_pid.get(bc)
                    if pid:
                        return pid
                nm = row.get("nmId")
                if nm is not None:
                    try:
                        nm_int = int(nm)
                        return nm_to_pid.get(nm_int)
                    except Exception:
                        return None
                return None

            # Суммируем по (product_id, warehouse), т.к. WB может отдавать несколько строк на один товар
            # (разные barcodes/sizes) — нельзя "последней строкой" затирать значение.
            agg: dict[tuple[str, str], int] = {}
            for stock in stocks:
                pid = _pid_for_stock_row(stock)
                if not pid:
                    # диагностически полезно: есть строки WB, которые мы не смогли сопоставить
                    logger.info(f"WB stocks: unmapped row nmId={stock.get('nmId')} barcode={stock.get('barcode')}")
                    continue

                wh = str(stock.get("warehouseName") or "Unknown").strip() or "Unknown"
                try:
                    qty = int(stock.get("quantity") or 0)
                except Exception:
                    qty = 0
                if qty < 0:
                    qty = 0

                key = (pid, wh)
                agg[key] = agg.get(key, 0) + qty

            now_iso = datetime.now().isoformat()
            for (pid, wh), qty in agg.items():
                upsert_row = {
                    "product_id": pid,
                    "marketplace": "wb",
                    "warehouse": wh,
                    "quantity": qty,
                    "updated_at": now_iso,
                }
                if self.user_id:
                    upsert_row["user_id"] = self.user_id
                self.supabase.table("mp_stocks").upsert(
                    upsert_row,
                    on_conflict="user_id,product_id,marketplace,warehouse",
                ).execute()
                records_count += 1

            self._log_sync("wb", "stocks", "success", records_count, started_at=started_at)
            return {"status": "success", "records": records_count}

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Ошибка синхронизации остатков WB: {error_msg}")
            self._log_sync("wb", "stocks", "error", 0, error_msg, started_at)
            return {"status": "error", "message": error_msg}

    async def diagnose_stocks_wb(self, days_back: int = 365) -> dict:
        """
        Диагностика остатков WB: сравнение WB API vs mp_stocks.

        Возвращает:
        - сколько строк пришло из WB API, сколько не сматчилось
        - totals по баркодам
        - расхождения по складам (missing/extra) между WB и БД
        """
        products_map = self._get_products_map()

        barcode_to_pid: dict[str, str] = {}
        pid_to_barcode: dict[str, str] = {}
        pid_to_name: dict[str, str] = {}
        nm_to_pid: dict[int, str] = {}
        for bc, p in products_map.items():
            pid = p.get("id")
            if pid and bc:
                bcs = str(bc).strip()
                barcode_to_pid[bcs] = pid
                pid_to_barcode[pid] = bcs
            if pid:
                pid_to_name[pid] = str(p.get("name") or "")
            nm = p.get("wb_nm_id")
            if pid and nm:
                try:
                    nm_to_pid[int(nm)] = pid
                except Exception:
                    pass

        # Для точного мэтчинга с ЛК WB нужно запрашивать с максимально ранней даты.
        # days_back оставляем как override для экспериментов/отладки.
        if days_back >= 365:
            wb_rows = await self.wb_client.get_stocks(datetime(2019, 6, 20))
        else:
            wb_rows = await self.wb_client.get_stocks(datetime.now() - timedelta(days=days_back))
        if not wb_rows:
            wb_rows = []

        def _pid_for_row(row: dict) -> str | None:
            bc = str(row.get("barcode") or "").strip()
            if bc:
                pid = barcode_to_pid.get(bc)
                if pid:
                    return pid
            nm = row.get("nmId")
            if nm is not None:
                try:
                    return nm_to_pid.get(int(nm))
                except Exception:
                    return None
            return None

        # WB agg
        wb_unmapped = 0
        wb_by_pid_wh: dict[tuple[str, str], int] = {}
        wb_by_pid_total: dict[str, int] = {}
        for row in wb_rows:
            pid = _pid_for_row(row)
            if not pid:
                wb_unmapped += 1
                continue
            wh = str(row.get("warehouseName") or "Unknown").strip() or "Unknown"
            try:
                qty = int(row.get("quantity") or 0)
            except Exception:
                qty = 0
            if qty < 0:
                qty = 0
            wb_by_pid_wh[(pid, wh)] = wb_by_pid_wh.get((pid, wh), 0) + qty
            wb_by_pid_total[pid] = wb_by_pid_total.get(pid, 0) + qty

        # DB agg
        db_query = (
            self.supabase.table("mp_stocks")
            .select("product_id, warehouse, quantity, updated_at, mp_products(name, barcode)")
            .eq("marketplace", "wb")
        )
        if self.user_id:
            db_query = db_query.eq("user_id", self.user_id)
        db_rows = db_query.execute()
        db_by_pid_wh: dict[tuple[str, str], int] = {}
        db_by_pid_total: dict[str, int] = {}
        last_updated_by_pid: dict[str, str] = {}
        for row in (db_rows.data or []):
            pid = row.get("product_id")
            if not pid:
                continue
            wh = str(row.get("warehouse") or "Unknown").strip() or "Unknown"
            try:
                qty = int(row.get("quantity") or 0)
            except Exception:
                qty = 0
            if qty < 0:
                qty = 0
            db_by_pid_wh[(pid, wh)] = db_by_pid_wh.get((pid, wh), 0) + qty
            db_by_pid_total[pid] = db_by_pid_total.get(pid, 0) + qty
            upd = row.get("updated_at")
            if upd:
                cur = last_updated_by_pid.get(pid)
                if not cur or str(upd) > str(cur):
                    last_updated_by_pid[pid] = str(upd)

        # diffs per product
        all_pids = sorted(set(list(wb_by_pid_total.keys()) + list(db_by_pid_total.keys())))
        diffs = []
        for pid in all_pids:
            wb_total = wb_by_pid_total.get(pid, 0)
            db_total = db_by_pid_total.get(pid, 0)
            delta = wb_total - db_total

            wb_whs = {wh for (p, wh) in wb_by_pid_wh.keys() if p == pid}
            db_whs = {wh for (p, wh) in db_by_pid_wh.keys() if p == pid}
            missing_in_db = sorted(wb_whs - db_whs)
            extra_in_db = sorted(db_whs - wb_whs)

            # only include interesting diffs
            if delta != 0 or missing_in_db or extra_in_db:
                diffs.append(
                    {
                        "product_id": pid,
                        "barcode": pid_to_barcode.get(pid),
                        "product_name": pid_to_name.get(pid),
                        "wb_total": wb_total,
                        "db_total": db_total,
                        "delta": delta,
                        "missing_warehouses_in_db": missing_in_db,
                        "extra_warehouses_in_db": extra_in_db,
                        "db_last_updated_at": last_updated_by_pid.get(pid),
                    }
                )

        diffs.sort(key=lambda x: abs(int(x.get("delta") or 0)), reverse=True)

        return {
            "status": "success",
            "fetched_at": datetime.now().isoformat(),
            "days_back": days_back,
            "wb": {
                "rows": len(wb_rows),
                "unmapped_rows": wb_unmapped,
                "products_seen": len(wb_by_pid_total),
            },
            "db": {
                "rows": len(db_by_pid_wh),
                "products_seen": len(db_by_pid_total),
            },
            "diffs": diffs,
        }

    async def sync_stocks_ozon(self) -> dict:
        """Синхронизация остатков с Ozon"""
        started_at = datetime.now()
        records_count = 0

        try:
            products_map = self._get_products_map()

            # Ozon stocks API часто отдаёт items=[] при filter={}, даже если остатки есть.
            # Поэтому пробуем несколько стратегий:
            # 1) точечно по нашим offer_id (у нас offer_id = barcode) + visibility=ALL
            # 2) точечно по offer_id без visibility
            # 3) общая выборка visibility=ALL
            # Для stocks-запросов используем идентификаторы из Ozon API (sync_products),
            # а не предполагаем, что offer_id == barcode.
            offer_ids: list[str] = []
            product_ids: list[int] = []
            for bc, p in products_map.items():
                if not bc or bc == "WB_ACCOUNT":
                    continue
                oid = (p.get("ozon_offer_id") or "").strip()
                if oid:
                    offer_ids.append(oid)
                pid = p.get("ozon_product_id")
                if pid:
                    try:
                        product_ids.append(int(pid))
                    except Exception:
                        pass

            tried: list[tuple[str, dict]] = []

            async def _fetch_items(flt: dict) -> list[dict]:
                tried.append(("v4/product/info/stocks", flt))
                res = await self.ozon_client.get_all_stocks(filter=flt)
                return (res or {}).get("result", {}).get("items", []) or []

            # 1) product_id (самый надёжный для FBO/"Склад Ozon")
            stocks: list[dict] = []
            if product_ids:
                stocks = await _fetch_items({"visibility": "ALL", "product_id": product_ids})
                if not stocks:
                    stocks = await _fetch_items({"product_id": product_ids})

            # 2) offer_id
            if not stocks:
                stocks = await _fetch_items({"visibility": "ALL", "offer_id": offer_ids})
            if not stocks:
                stocks = await _fetch_items({"offer_id": offer_ids})
            if not stocks:
                stocks = await _fetch_items({"visibility": "ALL"})
            # Fallback: если по offer_id пусто, пробуем через product_id из /v3/product/info/list
            # (в некоторых аккаунтах/режимах Ozon stocks лучше работает по product_id, особенно для "Склад Ozon" (FBO)).
            if not stocks and offer_ids and not product_ids:
                try:
                    info = await self.ozon_client.get_product_info(offer_ids=offer_ids)
                    items = info.get("result", {}).get("items", []) if isinstance(info, dict) else []
                    product_ids_fb = [it.get("product_id") for it in items if it.get("product_id")]
                    if product_ids_fb:
                        stocks = await _fetch_items({"visibility": "ALL", "product_id": product_ids_fb})
                        if not stocks:
                            stocks = await _fetch_items({"product_id": product_ids_fb})
                except Exception as _e:
                    # Не валим sync полностью из-за fallback — просто продолжаем с пустыми stocks.
                    logger.warning(f"Ozon stocks fallback by product_id failed: {_e}")

            # === FBO fallback: Analytics /v2/analytics/stock_on_warehouses ===
            # В некоторых аккаунтах /v4/product/info/stocks отдаёт только "Мои склады" (FBS) или пусто,
            # тогда как FBO ("Склад Ozon") доступен через analytics отчёт.
            if not stocks:
                tried.append(("v2/analytics/stock_on_warehouses", {"warehouse_type": "ALL"}))
                try:
                    report = await self.ozon_client.get_all_stocks_on_warehouses(warehouse_type="ALL", limit=100)
                    rows = (report or {}).get("result", {}).get("rows", []) or []

                    # Индексы для маппинга
                    offer_to_pid: dict[str, str] = {}
                    for _, p in products_map.items():
                        oid = str(p.get("ozon_offer_id") or "").strip()
                        if oid and p.get("id"):
                            offer_to_pid[oid] = p["id"]

                    for row in rows:
                        item_code = str(row.get("item_code") or "").strip()
                        sku = row.get("sku")
                        warehouse = str(row.get("warehouse_name") or "Ozon").strip() or "Ozon"

                        # Qty: близко к "Активный сток" в ЛК: free_to_sell_amount
                        try:
                            qty = int(row.get("free_to_sell_amount") or 0)
                        except Exception:
                            qty = 0

                        # product_id (UUID) маппим по offer_id (item_code) или по sku-map (временная схема проекта)
                        product_id: str | None = None
                        if item_code:
                            product_id = offer_to_pid.get(item_code) or products_map.get(item_code, {}).get("id")

                        if not product_id and sku is not None:
                            barcode = self.ozon_sku_map.get(str(sku))
                            if barcode:
                                product_id = products_map.get(barcode, {}).get("id")

                        if not product_id:
                            logger.warning(f"Ozon stock_on_warehouses: unmapped row sku={sku} item_code={item_code}")
                            continue

                        upsert_row = {
                            "product_id": product_id,
                            "marketplace": "ozon",
                            "warehouse": warehouse,
                            "quantity": qty,
                            "updated_at": datetime.now().isoformat(),
                        }
                        if self.user_id:
                            upsert_row["user_id"] = self.user_id
                        self.supabase.table("mp_stocks").upsert(
                            upsert_row,
                            on_conflict="user_id,product_id,marketplace,warehouse",
                        ).execute()
                        records_count += 1

                    self._log_sync("ozon", "stocks", "success", records_count, started_at=started_at)
                    return {"status": "success", "records": records_count, "source": "v2/analytics/stock_on_warehouses"}
                except Exception as e:
                    logger.warning(f"Ozon analytics stock_on_warehouses failed: {e}")

            for stock in stocks:
                product_id_ozon = stock.get("product_id")
                offer_id = stock.get("offer_id")

                # Находим товар
                product_id = None
                for barcode, product in products_map.items():
                    if product.get("ozon_product_id") == product_id_ozon or product.get("ozon_offer_id") == offer_id:
                        product_id = product["id"]
                        break

                if not product_id:
                    continue

                # Суммируем остатки по складам
                for warehouse_stock in stock.get("stocks", []):
                    warehouse = warehouse_stock.get("warehouse_name", "FBS")
                    present = int(warehouse_stock.get("present", 0) or 0)
                    reserved = int(warehouse_stock.get("reserved", 0) or 0)
                    # Ближе к "доступно к продаже": present - reserved (если reserved есть).
                    quantity = max(present - reserved, 0)

                    upsert_row = {
                        "product_id": product_id,
                        "marketplace": "ozon",
                        "warehouse": warehouse,
                        "quantity": quantity,
                        "updated_at": datetime.now().isoformat(),
                    }
                    if self.user_id:
                        upsert_row["user_id"] = self.user_id
                    self.supabase.table("mp_stocks").upsert(
                        upsert_row,
                        on_conflict="user_id,product_id,marketplace,warehouse",
                    ).execute()
                    records_count += 1

            # Если по Ozon пусто — логируем как success с 0, но добавляем диагностическое сообщение
            # в стандартный error_message нельзя (это поле для error), поэтому пишем в лог сервера.
            if not stocks:
                logger.warning(f"Ozon stocks: items=0. Tried filters: {tried!r}")

            self._log_sync("ozon", "stocks", "success", records_count, started_at=started_at)
            return {"status": "success", "records": records_count}

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Ошибка синхронизации остатков Ozon: {error_msg}")
            self._log_sync("ozon", "stocks", "error", 0, error_msg, started_at)
            return {"status": "error", "message": error_msg}

    # ==================== СИНХРОНИЗАЦИЯ УДЕРЖАНИЙ ====================

    async def sync_costs_wb(self, date_from: datetime, date_to: datetime = None) -> dict:
        """Синхронизация удержаний с Wildberries"""
        started_at = datetime.now()
        date_to = date_to or datetime.now()
        records_count = 0

        try:
            products_map = self._get_products_map()

            # Источник истины для WB: reportDetailByPeriod (как в ЛК).
            report = await self.wb_client.get_report_detail(date_from, date_to, period="daily")

            # Агрегация для mp_costs (положительные суммы расходов)
            costs_agg = {}  # {(product_id, date): {commission, logistics, storage, ...}}

            # Гранулярные данные для mp_costs_details (tree-view)
            details_agg = {}  # {(product_id, date, category, subcategory): amount}
            payout_by_key = {}  # {(product_id, date): payout_sum}

            WB_SYSTEM_BARCODE = "WB_ACCOUNT"
            WB_SYSTEM_NAME = "WB: вне разреза товаров"
            wb_system_pid: str | None = None

            def _pid_by_nm(nm_id: int | None):
                if nm_id is None:
                    return None
                for _, product in products_map.items():
                    if product.get("wb_nm_id") == nm_id:
                        return product["id"]
                return None

            def _pid_for_row(row: dict) -> str:
                nonlocal wb_system_pid
                nm_id = row.get("nm_id")
                if nm_id:
                    pid = _pid_by_nm(nm_id)
                    if pid:
                        return pid

                # Fallback by barcode (если nm_id не замаплен, но barcode присутствует)
                bc = str(row.get("barcode") or "").strip()
                if bc:
                    pid = products_map.get(bc, {}).get("id")
                    if pid:
                        return pid

                # Account-level row (хранение/прочее) — складываем в системный "товар"
                if wb_system_pid is None:
                    wb_system_pid = self._get_or_create_system_product_id(WB_SYSTEM_BARCODE, WB_SYSTEM_NAME)
                    products_map[WB_SYSTEM_BARCODE] = {"id": wb_system_pid}
                return wb_system_pid

            for row in report:
                date = (row.get("rr_dt") or "")[:10]
                if not date:
                    continue
                product_id = _pid_for_row(row)

                key = (product_id, date)
                if key not in costs_agg:
                    costs_agg[key] = {
                        "commission": 0.0,
                        "logistics": 0.0,
                        "storage": 0.0,
                        "promotion": 0.0,
                        "penalties": 0.0,
                        "acquiring": 0.0,
                        "other": 0.0,
                    }
                    payout_by_key[key] = 0.0

                # === 1) Детализация для tree-view ===
                operation_type = str(row.get("doc_type_name") or row.get("supplier_oper_name") or "WB")
                operation_id = str(row.get("rrd_id") or "")
                for rec in self._classify_wb_report_row(row):
                    dkey = (product_id, date, rec["category"], rec["subcategory"])
                    if dkey not in details_agg:
                        details_agg[dkey] = {"amount": 0.0, "operation_type": operation_type, "operation_id": operation_id}
                    details_agg[dkey]["amount"] += float(rec["amount"] or 0)

                # К перечислению (для балансировки дерева под 100% мэтч с ЛК WB)
                payout_by_key[key] += float(row.get("ppvz_for_pay", 0) or 0)

                # === 2) Агрегация для mp_costs (без знаков, только расходы) ===
                vw = abs(float(row.get("ppvz_vw", 0) or 0))
                vw_nds = abs(float(row.get("ppvz_vw_nds", 0) or 0))
                costs_agg[key]["commission"] += (vw + vw_nds)

                # Логистика как расход — только "Услуги по доставке товара покупателю".
                # Возмещения (ПВЗ, перевозка/складские операции) — это отдельные начисления в отчёте, их не считаем расходом.
                delivery = abs(float(row.get("delivery_rub", 0) or 0))
                costs_agg[key]["logistics"] += delivery

                costs_agg[key]["acquiring"] += abs(float(row.get("acquiring_fee", 0) or 0))
                costs_agg[key]["storage"] += abs(float(row.get("storage_fee", 0) or 0))
                costs_agg[key]["penalties"] += abs(float(row.get("penalty", 0) or 0))

                # Прочие удержания/операции (best-effort, чтобы сходилась общая сумма)
                costs_agg[key]["other"] += abs(float(row.get("deduction", 0) or 0))
                costs_agg[key]["other"] += abs(float(row.get("acceptance", 0) or 0))

            # Доводка до "К перечислению" через кабинетную сущность "Прочие удержания/выплаты".
            # Это НЕ "затычка": в ЛК WB есть отдельная колонка "Прочие удержания/выплаты".
            for (pid, date) in payout_by_key.keys():
                payout = payout_by_key[(pid, date)]
                details_sum = 0.0
                for (p, d, _, _), data in details_agg.items():
                    if p == pid and d == date:
                        details_sum += float(data["amount"] or 0)
                diff = round(payout - details_sum, 2)
                if abs(diff) >= 0.01:
                    dkey = (pid, date, "Прочие удержания/выплаты", "Прочие удержания/выплаты")
                    if dkey not in details_agg:
                        details_agg[dkey] = {"amount": 0.0, "operation_type": "WB_RESIDUAL", "operation_id": ""}
                    details_agg[dkey]["amount"] += diff

            # Сохраняем mp_costs
            for (pid, date), costs in costs_agg.items():
                upsert_row = {
                    "product_id": pid,
                    "marketplace": "wb",
                    "date": date,
                    "commission": round(costs["commission"], 2),
                    "logistics": round(costs["logistics"], 2),
                    "storage": round(costs["storage"], 2),
                    "promotion": round(costs["promotion"], 2),
                    "penalties": round(costs["penalties"], 2),
                    "acquiring": round(costs["acquiring"], 2),
                    "other_costs": round(costs["other"], 2),
                }
                if self.user_id:
                    upsert_row["user_id"] = self.user_id
                self.supabase.table("mp_costs").upsert(
                    upsert_row, on_conflict="user_id,product_id,marketplace,date"
                ).execute()
                records_count += 1

            # Удаляем старые записи деталей WB за период и вставляем новые
            delete_query = (
                self.supabase.table("mp_costs_details")
                .delete()
                .eq("marketplace", "wb")
                .gte("date", date_from.strftime("%Y-%m-%d"))
                .lte("date", date_to.strftime("%Y-%m-%d"))
            )
            if self.user_id:
                delete_query = delete_query.eq("user_id", self.user_id)
            delete_query.execute()

            details_count = 0
            for (pid, date, category, subcategory), data in details_agg.items():
                insert_row = {
                    "product_id": pid,
                    "marketplace": "wb",
                    "date": date,
                    "category": category,
                    "subcategory": subcategory,
                    "amount": round(float(data["amount"] or 0), 2),
                    "operation_type": data.get("operation_type", "WB"),
                    "operation_id": data.get("operation_id", ""),
                }
                if self.user_id:
                    insert_row["user_id"] = self.user_id
                self.supabase.table("mp_costs_details").insert(insert_row).execute()
                details_count += 1

            self._log_sync("wb", "costs", "success", records_count, started_at=started_at)
            return {"status": "success", "records": records_count, "details": details_count}

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Ошибка синхронизации удержаний WB: {error_msg}")
            self._log_sync("wb", "costs", "error", 0, error_msg, started_at)
            return {"status": "error", "message": error_msg}

    def _classify_wb_report_row(self, row: dict) -> list[dict]:
        """
        Классифицирует строку WB reportDetailByPeriod в записи для mp_costs_details.
        Суммы в details: отрицательная = удержание, положительная = начисление.
        """
        records: list[dict] = []

        def f(key: str) -> float:
            try:
                return float(row.get(key, 0) or 0)
            except Exception:
                return 0.0

        doc = str(row.get("doc_type_name") or "")
        oper = str(row.get("supplier_oper_name") or "")

        # Продажи (WB реализовал Товар (Пр) ≈ retail_amount)
        if doc == "Продажа" and oper == "Продажа":
            sales_amt = f("retail_amount")
            if sales_amt:
                records.append({
                    "category": "Продажи",
                    "subcategory": "Продажа",
                    "amount": sales_amt,
                })

        # Вознаграждение WB (ВВ) и НДС — как в кабинетной выгрузке (две отдельные колонки)
        vw = f("ppvz_vw")
        if vw:
            records.append({
                "category": "Вознаграждение Вайлдберриз (ВВ)",
                "subcategory": "Вознаграждение Вайлдберриз (ВВ), без НДС",
                "amount": vw,  # в отчёте WB уже со знаком
            })
        vw_nds = f("ppvz_vw_nds")
        if vw_nds:
            records.append({
                "category": "Вознаграждение Вайлдберриз (ВВ)",
                "subcategory": "НДС с Вознаграждения Вайлдберриз",
                "amount": vw_nds,  # в отчёте WB уже со знаком
            })

        # Эквайринг
        acq = abs(f("acquiring_fee"))
        if acq:
            sub = str(row.get("payment_processing") or "Эквайринг")
            records.append({
                "category": "Эквайринг/Комиссии за организацию платежей",
                "subcategory": sub,
                "amount": -acq,
            })

        # Услуги доставки товара покупателю (расход)
        delivery = abs(f("delivery_rub"))
        if delivery:
            records.append({
                "category": "Услуги по доставке товара покупателю",
                "subcategory": "Услуги по доставке товара покупателю",
                "amount": -delivery,
            })

        # Возмещения (как в выгрузке) — это начисления, а не удержания.
        pvz = f("ppvz_reward")
        if pvz:
            records.append({
                "category": "Возмещения",
                "subcategory": "Возмещение за выдачу и возврат товаров на ПВЗ",
                "amount": pvz,
            })

        rebill = f("rebill_logistic_cost")
        if rebill:
            records.append({
                "category": "Возмещения",
                "subcategory": "Возмещение издержек по перевозке/по складским операциям с товаром",
                "amount": rebill,
            })

        # Хранение
        storage = abs(f("storage_fee"))
        if storage:
            records.append({
                "category": "Стоимость хранения",
                "subcategory": "Стоимость хранения",
                "amount": -storage,
            })

        # Штрафы
        penalty = abs(f("penalty"))
        if penalty:
            sub = str(row.get("bonus_type_name") or "Штрафы")
            records.append({
                "category": "Общая сумма штрафов",
                "subcategory": sub,
                "amount": -penalty,
            })

        # Прочие удержания/выплаты (кабинетная колонка)
        deduction = abs(f("deduction"))
        if deduction:
            records.append({
                "category": "Прочие удержания/выплаты",
                "subcategory": "Прочие удержания/выплаты",
                "amount": -deduction,
            })

        acceptance = abs(f("acceptance"))
        if acceptance:
            records.append({
                "category": "Стоимость операций при приемке",
                "subcategory": "Стоимость операций при приемке",
                "amount": -acceptance,
            })

        add = f("additional_payment")
        if add:
            records.append({
                "category": "Прочие удержания/выплаты",
                "subcategory": "Прочие удержания/выплаты",
                "amount": add,  # может быть и + и -
            })

        # Лояльность/кэшбэк (поля WB отчёта)
        cashback_amount = f("cashback_amount")
        if cashback_amount:
            records.append({
                "category": "Компенсация скидки по программе лояльности",
                "subcategory": "Компенсация скидки по программе лояльности",
                "amount": cashback_amount,
            })

        cashback_discount = abs(f("cashback_discount"))
        if cashback_discount:
            records.append({
                "category": "Стоимость участия в программе лояльности",
                "subcategory": "Стоимость участия в программе лояльности",
                "amount": -cashback_discount,
            })

        cashback_commission_change = f("cashback_commission_change")
        if cashback_commission_change:
            records.append({
                "category": "Корректировка Вознаграждения Вайлдберриз (ВВ)",
                "subcategory": "Корректировка Вознаграждения Вайлдберриз (ВВ)",
                "amount": cashback_commission_change,
            })

        payment_schedule = f("payment_schedule")
        if payment_schedule:
            records.append({
                "category": "Разовое изменение срока перечисления денежных средств",
                "subcategory": "Разовое изменение срока перечисления денежных средств",
                "amount": payment_schedule,
            })

        return records

    # Маппинг operation_type → (category, subcategory) для tree-view
    OZON_COSTS_CATEGORY_MAP = {
        "OperationAgentDeliveredToCustomer": ("Продажи", "Выручка"),
        "OperationItemReturn": ("Услуги доставки", "Возвраты"),
        "MarketplaceRedistributionOfAcquiringOperation": ("Услуги агентов", "Эквайринг"),
        "StarsMembership": ("Услуги агентов", "Звёздные товары"),
        "OperationMarketplaceServicePremiumCashbackIndividualPoints": ("Продвижение и реклама", "Бонусы продавца"),
        "OperationMarketplaceServiceStorage": ("Услуги FBO", "Размещение товаров"),
    }

    # Товары, которые мы относим к группе "Витамины" (наша аналитическая группировка).
    # ВАЖНО: это НЕ ставка/тариф из Ozon. Эффективные % считаются динамически в costs-tree как в ЛК.
    VITAMIN_SKUS = {"1659212207", "1659298299", "1658273141", "1658286198"}  # D3+K2, L-карнитин, Магний+В6, Магний цитрат

    def _classify_ozon_operation(self, op: dict) -> list[dict]:
        """
        Классифицирует операцию Ozon в записи для mp_costs_details.
        Возвращает список записей (одна операция может генерировать несколько записей).
        """
        op_type = op.get("operation_type", "")
        op_type_name = op.get("operation_type_name", "")
        amount = float(op.get("amount", 0))
        sale_commission = float(op.get("sale_commission", 0))
        accruals = float(op.get("accruals_for_sale", 0))
        services = op.get("services", [])
        items = op.get("items", [])

        records = []

        if op_type == "OperationAgentDeliveredToCustomer":
            # Это заказ — разбиваем на: Продажи, Комиссия, Услуги доставки, Услуги агентов.
            # Важно: суммы в finance API часто идут на уровне отправления/заказа,
            # поэтому ниже помечаем записи allocation="order" — дальше они будут
            # распределены между items пропорционально quantity (чтобы не было
            # мультипликации при нескольких товарах в одной операции).
            if accruals:
                records.append({
                    "category": "Продажи",
                    "subcategory": "Выручка",
                    "amount": accruals,
                    "operation_type": op_type,
                    "allocation": "order",
                })
            if sale_commission:
                # Наша аналитическая группировка (не "тариф").
                sku = str(items[0].get("sku", "")) if items else ""
                if sku in self.VITAMIN_SKUS:
                    sub = "Витамины"
                else:
                    sub = "Прочее"
                records.append({
                    "category": "Вознаграждение Ozon",
                    "subcategory": sub,
                    "amount": sale_commission,  # уже отрицательная
                    "operation_type": op_type,
                    "allocation": "order",
                })
            # Сервисы доставки/агентов (Logistic vs LastMile).
            # В ЛК Ozon "Последняя миля" отображается в "Услуги агентов → Доставка до места выдачи",
            # а не в "Услуги доставки".
            for svc in services:
                svc_name = svc.get("name", "")
                svc_price = float(svc.get("price", 0))
                if svc_price == 0:
                    continue
                if "LastMile" in svc_name:
                    records.append({
                        "category": "Услуги агентов",
                        "subcategory": "Доставка до места выдачи",
                        "amount": svc_price,
                        "operation_type": op_type,
                        "allocation": "order",
                    })
                elif "Logistic" in svc_name:
                    records.append({
                        "category": "Услуги доставки",
                        "subcategory": "Логистика",
                        "amount": svc_price,
                        "operation_type": op_type,
                        "allocation": "order",
                    })

        elif op_type == "OperationItemReturn":
            # Возврат — сервисы логистики возврата
            for svc in services:
                svc_price = float(svc.get("price", 0))
                if svc_price == 0:
                    continue
                records.append({
                    "category": "Услуги доставки",
                    "subcategory": "Возвраты",
                    "amount": svc_price,
                    "operation_type": op_type,
                    "allocation": "order",
                })

        elif op_type == "MarketplaceRedistributionOfAcquiringOperation":
            records.append({
                "category": "Услуги агентов",
                "subcategory": "Эквайринг",
                "amount": amount,
                "operation_type": op_type,
                "allocation": "order",
            })

        elif op_type == "StarsMembership":
            records.append({
                "category": "Услуги агентов",
                "subcategory": "Звёздные товары",
                "amount": amount,
                "operation_type": op_type,
                "allocation": "order",
            })

        elif op_type == "OperationMarketplaceServicePremiumCashbackIndividualPoints":
            records.append({
                "category": "Продвижение и реклама",
                "subcategory": "Бонусы продавца",
                "amount": amount,
                "operation_type": op_type,
                "allocation": "order",
            })

        elif op_type == "OperationMarketplaceServiceStorage":
            records.append({
                "category": "Услуги FBO",
                "subcategory": "Размещение товаров",
                "amount": amount,
                "operation_type": op_type,
                "allocation": "order",
            })

        else:
            # Неизвестный тип — сохраняем как "Прочее"
            if amount != 0:
                records.append({
                    "category": "Прочее",
                    "subcategory": op_type_name or op_type,
                    "amount": amount,
                    "operation_type": op_type,
                })

        return records

    async def sync_costs_ozon(self, date_from: datetime, date_to: datetime = None) -> dict:
        """Синхронизация удержаний с Ozon (mp_costs + mp_costs_details)"""
        started_at = datetime.now()
        date_to = date_to or datetime.now()
        records_count = 0
        details_count = 0

        try:
            products_map = self._get_products_map()

            # Получаем все транзакции с пагинацией
            all_operations = []
            page = 1
            while True:
                result = await self.ozon_client.get_finance_transaction_list(date_from, date_to, page=page)
                operations = result.get("result", {}).get("operations", [])
                if not operations:
                    break
                all_operations.extend(operations)
                page += 1
                if page > 20:  # safety limit
                    break

            logger.info(f"Ozon finance: получено {len(all_operations)} операций за {date_from.strftime('%Y-%m-%d')} - {date_to.strftime('%Y-%m-%d')}")

            # === 1. Агрегация для mp_costs (как раньше) ===
            costs_agg = {}  # {(barcode, date): {commission, logistics, ...}}

            for op in all_operations:
                date = op.get("operation_date", "")[:10]
                items = op.get("items", [])
                op_type = op.get("operation_type", "")
                amount = float(op.get("amount", 0))
                sale_commission = float(op.get("sale_commission", 0))
                services = op.get("services", [])

                for item in items:
                    sku = str(item.get("sku", ""))
                    barcode = self.ozon_sku_map.get(sku)
                    if not barcode:
                        continue

                    key = (barcode, date)
                    if key not in costs_agg:
                        costs_agg[key] = {
                            "commission": 0, "logistics": 0, "storage": 0,
                            "promotion": 0, "penalties": 0, "acquiring": 0, "other": 0
                        }

                    if op_type == "OperationAgentDeliveredToCustomer":
                        costs_agg[key]["commission"] += abs(sale_commission)
                        for svc in services:
                            svc_name = svc.get("name", "")
                            svc_price = abs(float(svc.get("price", 0)))
                            if "Logistic" in svc_name or "LastMile" in svc_name:
                                costs_agg[key]["logistics"] += svc_price
                    elif op_type == "OperationItemReturn":
                        for svc in services:
                            costs_agg[key]["logistics"] += abs(float(svc.get("price", 0)))
                    elif op_type == "MarketplaceRedistributionOfAcquiringOperation":
                        costs_agg[key]["acquiring"] += abs(amount)
                    elif op_type == "OperationMarketplaceServiceStorage":
                        costs_agg[key]["storage"] += abs(amount)
                    elif op_type == "OperationMarketplaceServicePremiumCashbackIndividualPoints":
                        costs_agg[key]["promotion"] += abs(amount)
                    elif op_type == "StarsMembership":
                        costs_agg[key]["other"] += abs(amount)
                    else:
                        costs_agg[key]["other"] += abs(amount)

            # Сохраняем mp_costs
            for (barcode, date), costs in costs_agg.items():
                product_id = products_map.get(barcode, {}).get("id")
                if not product_id:
                    continue

                upsert_row = {
                    "product_id": product_id,
                    "marketplace": "ozon",
                    "date": date,
                    "commission": costs["commission"],
                    "logistics": costs["logistics"],
                    "storage": costs["storage"],
                    "promotion": costs["promotion"],
                    "penalties": costs["penalties"],
                    "acquiring": costs["acquiring"],
                    "other_costs": costs["other"],
                }
                if self.user_id:
                    upsert_row["user_id"] = self.user_id
                self.supabase.table("mp_costs").upsert(
                    upsert_row, on_conflict="user_id,product_id,marketplace,date"
                ).execute()
                records_count += 1

            # === 2. Гранулярные данные для mp_costs_details (tree-view) ===
            details_agg = {}  # {(product_id, date, category, subcategory): amount}

            for op in all_operations:
                date = op.get("operation_date", "")[:10]
                items = op.get("items", [])
                operation_id = str(op.get("operation_id", ""))

                detail_records = self._classify_ozon_operation(op)

                if items:
                    # Распределяем "order-level" суммы по товарам, чтобы не было мультипликации
                    # при нескольких items в одной операции.
                    total_qty = 0
                    item_qtys = []
                    for it in items:
                        try:
                            q = int(it.get("quantity", 1) or 1)
                        except Exception:
                            q = 1
                        if q <= 0:
                            q = 1
                        item_qtys.append(q)
                        total_qty += q
                    if total_qty <= 0:
                        total_qty = len(items)

                    for item in items:
                        sku = str(item.get("sku", ""))
                        barcode = self.ozon_sku_map.get(sku)
                        if not barcode:
                            continue
                        pid = products_map.get(barcode, {}).get("id")
                        if not pid:
                            continue

                        # share by quantity (fallback: equal split)
                        try:
                            q = int(item.get("quantity", 1) or 1)
                        except Exception:
                            q = 1
                        if q <= 0:
                            q = 1
                        share = (q / total_qty) if total_qty > 0 else (1.0 / len(items))

                        for rec in detail_records:
                            alloc = rec.get("allocation")
                            amt = rec["amount"] * share if alloc == "order" else rec["amount"]
                            key = (pid, date, rec["category"], rec["subcategory"])
                            if key not in details_agg:
                                details_agg[key] = {
                                    "amount": 0,
                                    "operation_type": rec["operation_type"],
                                    "operation_id": operation_id,
                                }
                            details_agg[key]["amount"] += amt
                else:
                    # Операции без привязки к товару (хранение и т.п.)
                    # Распределяем равномерно между всеми товарами с продажами на Ozon
                    ozon_product_ids = [
                        p["id"] for p in products_map.values()
                        if p.get("ozon_product_id")
                    ]
                    if not ozon_product_ids:
                        continue
                    # Важно: делим в копейках так, чтобы сумма распределённых значений
                    # совпадала с исходной суммой до 0.01 ₽ (без накопления ошибок округления).
                    ozon_product_ids = sorted(ozon_product_ids)

                    for rec in detail_records:
                        total_cents = int(round(float(rec["amount"]) * 100))
                        n = len(ozon_product_ids)
                        if n == 0:
                            continue
                        sign = 1 if total_cents >= 0 else -1
                        abs_cents = abs(total_cents)
                        base_abs = abs_cents // n
                        rem = abs_cents % n

                        for i, pid in enumerate(ozon_product_ids):
                            key = (pid, date, rec["category"], rec["subcategory"])
                            if key not in details_agg:
                                details_agg[key] = {
                                    "amount": 0,
                                    "operation_type": rec["operation_type"],
                                    "operation_id": operation_id,
                                }
                            cents = base_abs + (1 if i < rem else 0)
                            details_agg[key]["amount"] += sign * (cents / 100.0)

            # Удаляем старые записи за период перед вставкой
            delete_query = (
                self.supabase.table("mp_costs_details")
                .delete()
                .eq("marketplace", "ozon")
                .gte("date", date_from.strftime("%Y-%m-%d"))
                .lte("date", date_to.strftime("%Y-%m-%d"))
            )
            if self.user_id:
                delete_query = delete_query.eq("user_id", self.user_id)
            delete_query.execute()

            # Сохраняем mp_costs_details
            for (pid, date, category, subcategory), data in details_agg.items():
                insert_row = {
                    "product_id": pid,
                    "marketplace": "ozon",
                    "date": date,
                    "category": category,
                    "subcategory": subcategory,
                    "amount": round(data["amount"], 2),
                    "operation_type": data["operation_type"],
                    "operation_id": data["operation_id"],
                }
                if self.user_id:
                    insert_row["user_id"] = self.user_id
                self.supabase.table("mp_costs_details").insert(insert_row).execute()
                details_count += 1

            logger.info(f"Ozon costs: {records_count} mp_costs records, {details_count} mp_costs_details records")
            self._log_sync("ozon", "costs", "success", records_count, started_at=started_at)
            return {"status": "success", "records": records_count, "details": details_count}

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Ошибка синхронизации удержаний Ozon: {error_msg}")
            self._log_sync("ozon", "costs", "error", 0, error_msg, started_at)
            return {"status": "error", "message": error_msg}

    # ==================== СИНХРОНИЗАЦИЯ РЕКЛАМЫ ====================

    async def sync_ads_wb(self, date_from: datetime, date_to: datetime = None) -> dict:
        """Синхронизация рекламных расходов с Wildberries"""
        started_at = datetime.now()
        date_to = date_to or datetime.now()
        records_count = 0

        try:
            products_map = self._get_products_map()

            # Получаем кампании
            campaigns = await self.wb_client.get_advert_campaigns()
            campaign_ids = []
            for adv_type in campaigns.get("adverts", []):
                for ad in adv_type.get("advert_list", []):
                    if ad.get("advertId"):
                        campaign_ids.append(ad["advertId"])

            if not campaign_ids:
                self._log_sync("wb", "ads", "success", 0, started_at=started_at)
                return {"status": "success", "records": 0}

            # Получаем статистику по одной кампании (WB API ограничение + rate limit)
            import asyncio
            stats = []
            for cid in campaign_ids:
                try:
                    result = await self.wb_client.get_advert_stats([cid], date_from, date_to)
                    if result and isinstance(result, list):
                        stats.extend(result)
                except Exception as e:
                    logger.warning(f"WB Ads: не удалось получить статистику кампании {cid}: {e}")
                await asyncio.sleep(5)  # Rate limit: WB Ads API ограничивает частоту

            for campaign_stat in stats:
                campaign_id = campaign_stat.get("advertId")

                for day in campaign_stat.get("days", []):
                    date = day.get("date")

                    for app in day.get("apps", []):
                        for nm in app.get("nm", []):
                            nm_id = nm.get("nmId")

                            # Находим товар
                            product_id = None
                            for barcode, product in products_map.items():
                                if product.get("wb_nm_id") == nm_id:
                                    product_id = product["id"]
                                    break

                            if not product_id:
                                continue

                            views = nm.get("views", 0)
                            clicks = nm.get("clicks", 0)
                            cost = float(nm.get("sum", 0))
                            orders = nm.get("orders", 0)

                            ctr = round(clicks / views * 100, 2) if views > 0 else 0
                            cpc = round(cost / clicks, 2) if clicks > 0 else 0
                            acos = round(cost / float(nm.get("ordersSumRub", 1)) * 100, 2) if nm.get("ordersSumRub") else None

                            upsert_row = {
                                "product_id": product_id,
                                "marketplace": "wb",
                                "date": date,
                                "campaign_id": str(campaign_id),
                                "impressions": views,
                                "clicks": clicks,
                                "cost": cost,
                                "orders_count": orders,
                                "ctr": ctr,
                                "cpc": cpc,
                                "acos": acos,
                            }
                            if self.user_id:
                                upsert_row["user_id"] = self.user_id
                            self.supabase.table("mp_ad_costs").upsert(
                                upsert_row, on_conflict="user_id,product_id,marketplace,date,campaign_id"
                            ).execute()
                            records_count += 1

            self._log_sync("wb", "ads", "success", records_count, started_at=started_at)
            return {"status": "success", "records": records_count}

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Ошибка синхронизации рекламы WB: {error_msg}")
            self._log_sync("wb", "ads", "error", 0, error_msg, started_at)
            return {"status": "error", "message": error_msg}

    async def sync_ads_ozon(self, date_from: datetime, date_to: datetime = None) -> dict:
        """Синхронизация рекламных расходов с Ozon"""
        import asyncio
        started_at = datetime.now()
        date_to = date_to or datetime.now()
        records_count = 0

        try:
            products_map = self._get_products_map()

            # Получаем кампании (только SKU-типа, не REF_VK/SEARCH_PROMO)
            campaigns = await self.ozon_perf_client.get_campaigns()
            sku_campaigns = [
                c for c in campaigns.get("list", [])
                if c.get("id") and c.get("advObjectType") == "SKU"
            ]

            if not sku_campaigns:
                self._log_sync("ozon", "ads", "success", 0, started_at=started_at)
                return {"status": "success", "records": 0}

            # Обрабатываем по одной кампании (ограничение API: 1 запрос одновременно)
            for campaign in sku_campaigns:
                campaign_id = str(campaign["id"])
                try:
                    stats = await self.ozon_perf_client.get_campaign_stats(
                        [campaign_id], date_from, date_to
                    )

                    for row in stats.get("rows", []):
                        date = row.get("date")
                        if not date:
                            continue

                        views = row.get("views", 0)
                        clicks = row.get("clicks", 0)
                        cost = float(row.get("expense", 0))
                        orders = row.get("orders", 0)

                        # Пропускаем дни без активности
                        if views == 0 and clicks == 0 and cost == 0:
                            continue

                        ctr = round(clicks / views * 100, 2) if views > 0 else 0
                        cpc = round(cost / clicks, 2) if clicks > 0 else 0

                        upsert_row = {
                            "product_id": None,
                            "marketplace": "ozon",
                            "date": date,
                            "campaign_id": campaign_id,
                            "impressions": views,
                            "clicks": clicks,
                            "cost": cost,
                            "orders_count": orders,
                            "ctr": ctr,
                            "cpc": cpc,
                        }
                        if self.user_id:
                            upsert_row["user_id"] = self.user_id
                        self.supabase.table("mp_ad_costs").upsert(
                            upsert_row, on_conflict="user_id,product_id,marketplace,date,campaign_id"
                        ).execute()
                        records_count += 1

                except Exception as e:
                    logger.warning(f"Ozon Ads: не удалось получить статистику кампании {campaign_id}: {e}")

                # Ждём между кампаниями (ограничение: 1 активный отчёт)
                await asyncio.sleep(5)

            self._log_sync("ozon", "ads", "success", records_count, started_at=started_at)
            return {"status": "success", "records": records_count}

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Ошибка синхронизации рекламы Ozon: {error_msg}")
            self._log_sync("ozon", "ads", "error", 0, error_msg, started_at)
            return {"status": "error", "message": error_msg}

    # ==================== ПОЛНАЯ СИНХРОНИЗАЦИЯ ====================

    async def sync_all(self, days_back: int = 30) -> dict:
        """
        Полная синхронизация всех данных
        days_back - за сколько дней загружать данные
        """
        date_from = datetime.now() - timedelta(days=days_back)
        date_to = datetime.now()

        results = {
            "products": await self.sync_products(),
            "sales_wb": await self.sync_sales_wb(date_from, date_to),
            "sales_ozon": await self.sync_sales_ozon(date_from, date_to),
            "stocks_wb": await self.sync_stocks_wb(),
            "stocks_ozon": await self.sync_stocks_ozon(),
            "costs_wb": await self.sync_costs_wb(date_from, date_to),
            "costs_ozon": await self.sync_costs_ozon(date_from, date_to),
            "ads_wb": await self.sync_ads_wb(date_from, date_to),
            "ads_ozon": await self.sync_ads_ozon(date_from, date_to),
        }

        # Подсчёт успешных/ошибок
        success = sum(1 for r in results.values() if r.get("status") == "success")
        errors = sum(1 for r in results.values() if r.get("status") == "error")

        return {
            "status": "completed",
            "success_count": success,
            "error_count": errors,
            "details": results
        }
