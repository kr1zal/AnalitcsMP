"""
Daily summary and stock alert notifications for Telegram bot.
Reuses dashboard.py logic via Supabase RPC calls.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from html import escape as html_escape
from typing import Optional

from aiogram import Bot

from ..db.supabase import get_supabase_client
from .keyboards import main_keyboard
from .ai_insights import generate_insights

logger = logging.getLogger(__name__)

MSK_OFFSET = timedelta(hours=3)


def _now_msk() -> datetime:
    """Current datetime in Moscow timezone."""
    return datetime.now(timezone.utc) + MSK_OFFSET


def _format_number(value: float) -> str:
    """Format number with thousands separator."""
    if abs(value) >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if abs(value) >= 1_000:
        return f"{value:,.0f}".replace(",", " ")
    if isinstance(value, float) and value != int(value):
        return f"{value:.1f}"
    return str(int(value))


def _format_currency(value: float) -> str:
    """Format as currency with ruble sign."""
    return f"{_format_number(value)} ₽"


def _change_indicator(current: float, previous: float) -> str:
    """Return change percentage indicator."""
    if previous == 0:
        return ""
    change = ((current - previous) / previous) * 100
    if change > 0:
        return f" (+{change:.1f}%)"
    elif change < 0:
        return f" ({change:.1f}%)"
    return ""


async def build_summary_message(user_id: str, use_yesterday: bool = True) -> Optional[str]:
    """
    Build daily summary message for a user.
    Uses same RPC as GET /dashboard/summary.

    Args:
        user_id: Supabase user UUID
        use_yesterday: If True, show yesterday's data (for morning summary).
                       If False, show today's data (for evening/on-demand).
    """
    supabase = get_supabase_client()
    now = _now_msk()

    if use_yesterday:
        # Morning summary: show yesterday's full data
        date_main = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        date_compare = (now - timedelta(days=2)).strftime("%Y-%m-%d")
    else:
        # Evening summary or on-demand: show today's data
        date_main = now.strftime("%Y-%m-%d")
        date_compare = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    try:
        # Get main period summary
        main_result = supabase.rpc(
            "get_dashboard_summary",
            {
                "p_date_from": date_main,
                "p_date_to": date_main,
                "p_marketplace": None,
                "p_user_id": user_id,
                "p_fulfillment_type": None,
            }
        ).execute()

        # Get comparison period
        compare_result = supabase.rpc(
            "get_dashboard_summary",
            {
                "p_date_from": date_compare,
                "p_date_to": date_compare,
                "p_marketplace": None,
                "p_user_id": user_id,
                "p_fulfillment_type": None,
            }
        ).execute()

        today = main_result.data if main_result.data else {}
        yesterday = compare_result.data if compare_result.data else {}

        # Handle case where RPC returns a list
        if isinstance(today, list):
            today = today[0] if today else {}
        if isinstance(yesterday, list):
            yesterday = yesterday[0] if yesterday else {}

        # Unpack nested summary from RPC response
        # RPC returns {status, period, marketplace, summary: {orders, sales, ...}}
        if isinstance(today, dict) and "summary" in today:
            today = today["summary"]
        if isinstance(yesterday, dict) and "summary" in yesterday:
            yesterday = yesterday["summary"]

        # Extract metrics
        orders = float(today.get("orders", 0))
        sales = float(today.get("sales", 0))
        revenue = float(today.get("revenue", 0))
        profit = float(today.get("net_profit", 0))
        ad_cost = float(today.get("ad_cost", 0))
        buyout_pct = float(today.get("buyout_percent", 0))

        prev_orders = float(yesterday.get("orders", 0))
        prev_revenue = float(yesterday.get("revenue", 0))
        prev_profit = float(yesterday.get("net_profit", 0))

        # DRR & Margin
        drr = (ad_cost / revenue * 100) if revenue > 0 else 0
        margin = (profit / revenue * 100) if revenue > 0 else 0

        # Determine greeting
        if now.hour < 15:
            greeting = "Утренняя сводка"
        else:
            greeting = "Вечерняя сводка"

        lines = [
            f"<b>{greeting} за {date_main}</b>",
            "",
            f"Заказы: <b>{_format_number(orders)}</b>{_change_indicator(orders, prev_orders)}",
            f"Выкупы: <b>{_format_number(sales)}</b> ({buyout_pct:.1f}%)",
            f"Выручка: <b>{_format_currency(revenue)}</b>{_change_indicator(revenue, prev_revenue)}",
            f"Прибыль: <b>{_format_currency(profit)}</b>{_change_indicator(profit, prev_profit)} (маржа {margin:.1f}%)",
            f"Реклама: <b>{_format_currency(ad_cost)}</b> (ДРР {drr:.1f}%)",
        ]

        # Order-based deductions estimate from mp_orders (no settlement delay)
        try:
            order_result = (
                supabase.table("mp_orders")
                .select("commission, logistics, storage_fee, other_fees")
                .eq("user_id", user_id)
                .gte("order_date", f"{date_main}T00:00:00+03:00")
                .lte("order_date", f"{date_main}T23:59:59+03:00")
                .limit(10000)
                .execute()
            )
            order_rows = order_result.data or []
            if order_rows:
                total_deductions = sum(
                    float(r.get("commission") or 0)
                    + float(r.get("logistics") or 0)
                    + float(r.get("storage_fee") or 0)
                    + float(r.get("other_fees") or 0)
                    for r in order_rows
                )
                if total_deductions > 0:
                    lines.append(
                        f"Удержания МП: ~<b>{_format_currency(total_deductions)}</b> (оценка)"
                    )
        except Exception as e:
            logger.warning(f"Order-based deductions failed, skipping: {e}")

        # P6: Anomaly alerts — reuse already-loaded data (no extra RPC)
        try:
            anomalies = check_anomalies_from_data(
                orders_today=orders,
                orders_prev=prev_orders,
                revenue_today=revenue,
                profit_today=profit,
                ad_cost_today=ad_cost,
            )
            if anomalies:
                lines.append("")
                for anomaly in anomalies:
                    lines.append(f"⚠ {anomaly}")
        except Exception as e:
            logger.warning(f"Anomaly check failed, skipping: {e}")

        # Stock alerts
        stock_alerts = await _get_stock_alerts(user_id)
        if stock_alerts:
            lines.append("")
            lines.append("<b>Остатки менее 7 дней:</b>")
            for alert in stock_alerts[:5]:
                lines.append(
                    f"  {html_escape(alert['name'])}: {alert['days']} дн. "
                    f"({alert['quantity']} шт.)"
                )
            if len(stock_alerts) > 5:
                lines.append(f"  ...и ещё {len(stock_alerts) - 5} товаров")

        # AI insights — analyze metric changes
        try:
            current_metrics = {
                "orders": orders,
                "sales": sales,
                "revenue": revenue,
                "profit": profit,
                "ad_cost": ad_cost,
                "drr": drr,
                "margin": margin,
                "buyout_pct": buyout_pct,
            }
            prev_metrics = {
                "orders": prev_orders,
                "revenue": prev_revenue,
                "profit": prev_profit,
            }
            insights = await generate_insights(
                current_metrics, prev_metrics, stock_alerts
            )
            if insights:
                lines.append("")
                lines.append(f"<b>AI-анализ:</b>")
                # Each insight line as a separate message line
                for insight_line in insights.split("\n"):
                    if insight_line.strip():
                        lines.append(insight_line.strip())
        except Exception as e:
            logger.warning(f"AI insights failed, skipping: {e}")

        lines.append("")
        lines.append("<i>reviomp.ru</i>")

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"Failed to build summary for user {user_id}: {e}")
        return None


def check_anomalies_from_data(
    orders_today: float,
    orders_prev: float,
    revenue_today: float,
    profit_today: float,
    ad_cost_today: float,
) -> list[str]:
    """
    Check for metric anomalies using pre-loaded data (P6).
    Pure function — no DB calls, no async. Used by build_summary_message.
    Thresholds:
    - Orders drop > 30%
    - DRR > 20% (absolute)
    - Margin below 10%
    """
    alerts: list[str] = []

    # 1. Orders drop > 30%
    if orders_prev > 0 and orders_today > 0:
        drop_pct = ((orders_prev - orders_today) / orders_prev) * 100
        if drop_pct > 30:
            alerts.append(
                f"Заказы упали на {drop_pct:.0f}% по сравнению со вчера. "
                f"Рекомендуем проверить рекламные кампании."
            )

    # 2. DRR > 20%
    if revenue_today > 0:
        drr = (ad_cost_today / revenue_today) * 100
        if drr > 20:
            alerts.append(
                f"ДРР составляет {drr:.1f}% — реклама забирает значительную часть выручки. "
                f"Рекомендуем пересмотреть бюджеты кампаний."
            )

    # 3. Margin below 10%
    if revenue_today > 0:
        margin = (profit_today / revenue_today) * 100
        if 0 < margin < 10:
            alerts.append(
                f"Маржинальность составляет {margin:.1f}% — ниже безопасного уровня 10%. "
                f"Проверьте себестоимость и рекламные расходы."
            )

    return alerts


async def check_anomalies(user_id: str) -> list[str]:
    """
    Check for metric anomalies comparing yesterday vs day-before (P6).
    Standalone version for use outside build_summary_message (e.g. proactive alerts).
    Returns list of alert strings. Empty list if no anomalies.
    """
    supabase = get_supabase_client()
    now = _now_msk()
    date_today = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    date_prev = (now - timedelta(days=2)).strftime("%Y-%m-%d")

    try:
        today_result = supabase.rpc(
            "get_dashboard_summary",
            {
                "p_date_from": date_today,
                "p_date_to": date_today,
                "p_marketplace": None,
                "p_user_id": user_id,
                "p_fulfillment_type": None,
            }
        ).execute()

        prev_result = supabase.rpc(
            "get_dashboard_summary",
            {
                "p_date_from": date_prev,
                "p_date_to": date_prev,
                "p_marketplace": None,
                "p_user_id": user_id,
                "p_fulfillment_type": None,
            }
        ).execute()

        today = today_result.data if today_result.data else {}
        prev = prev_result.data if prev_result.data else {}

        if isinstance(today, list):
            today = today[0] if today else {}
        if isinstance(prev, list):
            prev = prev[0] if prev else {}

        # Unpack nested summary from RPC response
        if isinstance(today, dict) and "summary" in today:
            today = today["summary"]
        if isinstance(prev, dict) and "summary" in prev:
            prev = prev["summary"]

        return check_anomalies_from_data(
            orders_today=float(today.get("orders", 0)),
            orders_prev=float(prev.get("orders", 0)),
            revenue_today=float(today.get("revenue", 0)),
            profit_today=float(today.get("net_profit", 0)),
            ad_cost_today=float(today.get("ad_cost", 0)),
        )

    except Exception as e:
        logger.error(f"check_anomalies error for user {user_id}: {e}")
        return []


async def _get_stock_alerts(user_id: str) -> list[dict]:
    """
    Get products with stock forecast < 7 days.
    Reuses stocks endpoint logic.
    """
    supabase = get_supabase_client()

    try:
        # Get stocks
        stocks_result = (
            supabase.table("mp_stocks")
            .select("*, mp_products(name, barcode)")
            .eq("user_id", user_id)
            .execute()
        )

        # Get 30-day sales for forecast
        date_30d = (_now_msk() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_today = _now_msk().strftime("%Y-%m-%d")

        sales_result = (
            supabase.table("mp_sales")
            .select("product_id, sales_count")
            .eq("user_id", user_id)
            .gte("date", date_30d)
            .lte("date", date_today)
            .execute()
        )

        # Sum sales by product
        sales_by_product: dict[str, int] = {}
        for sale in sales_result.data:
            pid = sale.get("product_id")
            if pid:
                sales_by_product[pid] = sales_by_product.get(pid, 0) + sale.get("sales_count", 0)

        # Aggregate stocks by product
        stocks_by_product: dict[str, dict] = {}
        for stock in stocks_result.data:
            product_data = stock.get("mp_products")
            if not product_data:
                continue
            product_id = stock.get("product_id")
            key = str(product_id)

            if key not in stocks_by_product:
                stocks_by_product[key] = {
                    "name": product_data.get("name", "N/A"),
                    "quantity": 0,
                    "product_id": product_id,
                }
            stocks_by_product[key]["quantity"] += stock.get("quantity", 0)

        # Calculate forecast and filter < 7 days
        alerts = []
        for key, info in stocks_by_product.items():
            total_sales = sales_by_product.get(info["product_id"], 0)
            avg_daily = total_sales / 30
            if avg_daily > 0:
                days_remaining = info["quantity"] / avg_daily
                if days_remaining < 7:
                    alerts.append({
                        "name": info["name"],
                        "days": round(days_remaining, 1),
                        "quantity": info["quantity"],
                    })

        # Sort by days remaining
        alerts.sort(key=lambda x: x["days"])
        return alerts

    except Exception as e:
        logger.error(f"Failed to get stock alerts for user {user_id}: {e}")
        return []


async def send_daily_summaries(target_time: str) -> dict:
    """
    Send daily summaries to all users whose schedule matches target_time.
    Called by cron endpoint.

    Args:
        target_time: HH:MM format (MSK), e.g. "09:00"

    Returns:
        { sent: int, errors: int, skipped: int }
    """
    from . import get_bot

    supabase = get_supabase_client()
    bot = get_bot()

    stats = {"sent": 0, "errors": 0, "skipped": 0}

    try:
        # Get all telegram links
        result = (
            supabase.table("mp_telegram_links")
            .select("user_id, telegram_chat_id, settings")
            .execute()
        )

        if not result.data:
            return stats

        for link in result.data:
            settings = link.get("settings") or {}
            user_id = link["user_id"]
            chat_id = link["telegram_chat_id"]

            # Check if morning or evening matches
            is_morning = False
            is_evening = False
            if settings.get("daily_summary", True) and settings.get("morning_time", "09:00") == target_time:
                is_morning = True
            if settings.get("evening_enabled", False) and settings.get("evening_time", "21:00") == target_time:
                is_evening = True

            if not is_morning and not is_evening:
                stats["skipped"] += 1
                continue

            try:
                # Morning = yesterday's data, Evening = today's data
                use_yesterday = is_morning and not is_evening
                message = await build_summary_message(user_id, use_yesterday=use_yesterday)
                if message:
                    await bot.send_message(
                        chat_id,
                        message,
                        reply_markup=main_keyboard(),
                    )
                    stats["sent"] += 1
                else:
                    stats["skipped"] += 1

                # Rate limit: 50ms between sends (Telegram limit: 30 msg/sec)
                await asyncio.sleep(0.05)

            except Exception as e:
                error_msg = str(e).lower()
                # Bot was blocked by user or chat not found
                if "blocked" in error_msg or "chat not found" in error_msg or "forbidden" in error_msg:
                    logger.warning(f"User {user_id} blocked bot, unlinking")
                    try:
                        supabase.table("mp_telegram_links").delete().eq("user_id", user_id).execute()
                    except Exception:
                        pass
                else:
                    logger.error(f"Failed to send summary to {chat_id}: {e}")
                stats["errors"] += 1

    except Exception as e:
        logger.error(f"Failed to process daily summaries: {e}")

    return stats
