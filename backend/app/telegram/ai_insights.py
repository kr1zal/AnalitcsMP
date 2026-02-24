"""
AI-powered insights generator for daily Telegram summaries.
Analyzes metric changes and provides 1-3 actionable sentences.
Falls back to empty string on errors (summary sends without insights).
"""
import logging
from typing import Optional

import anthropic

from ..config import get_settings

logger = logging.getLogger(__name__)

INSIGHTS_SYSTEM_PROMPT = """
Ты — AI-аналитик RevioMP. Анализируешь метрики маркетплейсов (WB + Ozon).

Тебе дают текущие и предыдущие метрики за день. Сформируй 1-3 коротких предложения:
- Что изменилось и почему это важно
- Конкретные действия, если нужны (проверить рекламу, пополнить остатки)
- Если всё стабильно — скажи "показатели стабильны"

ФОРМАТ:
- 1-3 предложения, каждое на новой строке
- Без markdown, без HTML тегов
- Русский язык
- Числа с пробелом-разделителем (1 000, не 1000)
- Проценты с одним знаком (15.2%, не 15.23456%)
- Не повторяй цифры, которые уже есть в сводке — давай АНАЛИЗ

БЕНЧМАРКИ:
- ДРР < 10% = хорошо, 10-15% = средне, > 15% = плохо
- Маржа > 25% = хорошо, 15-25% = средне, < 15% = плохо
- Выкуп > 70% = норма для WB
- Остатки < 7 дней = критично, < 14 = предупреждение

Ответь ТОЛЬКО текстом анализа (1-3 строки). Без JSON, без обёрток.
"""


def _get_client() -> Optional[anthropic.AsyncAnthropic]:
    """Get async Anthropic client if API key is configured."""
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        return None
    return anthropic.AsyncAnthropic(api_key=api_key)


def _build_metrics_prompt(
    metrics: dict,
    prev_metrics: dict,
    stock_alerts: Optional[list] = None,
) -> str:
    """Build user message with current and previous metrics."""
    lines = [
        "Текущий период:",
        f"  Заказы: {metrics.get('orders', 0)}",
        f"  Выкупы: {metrics.get('sales', 0)}",
        f"  Выручка: {metrics.get('revenue', 0):.0f} руб",
        f"  Прибыль: {metrics.get('profit', 0):.0f} руб",
        f"  Реклама: {metrics.get('ad_cost', 0):.0f} руб",
        f"  ДРР: {metrics.get('drr', 0):.1f}%",
        f"  Маржа: {metrics.get('margin', 0):.1f}%",
        f"  Выкуп: {metrics.get('buyout_pct', 0):.1f}%",
        "",
        "Предыдущий период:",
        f"  Заказы: {prev_metrics.get('orders', 0)}",
        f"  Выручка: {prev_metrics.get('revenue', 0):.0f} руб",
        f"  Прибыль: {prev_metrics.get('profit', 0):.0f} руб",
    ]

    if stock_alerts:
        lines.append("")
        lines.append("Критичные остатки (< 7 дней):")
        for alert in stock_alerts[:5]:
            lines.append(
                f"  {alert['name']}: {alert['days']} дн. ({alert['quantity']} шт.)"
            )

    return "\n".join(lines)


async def generate_insights(
    metrics: dict,
    prev_metrics: dict,
    stock_alerts: Optional[list] = None,
) -> str:
    """
    Generate AI insights from dashboard metrics comparison.

    Args:
        metrics: Current period metrics (orders, revenue, profit, ad_cost, drr, margin, buyout_pct, sales)
        prev_metrics: Previous period metrics (orders, revenue, profit)
        stock_alerts: Optional list of stock alerts [{name, days, quantity}]

    Returns:
        1-3 sentences of analysis in Russian. Empty string on error.
    """
    client = _get_client()
    if not client:
        return ""

    try:
        user_message = _build_metrics_prompt(metrics, prev_metrics, stock_alerts)

        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=INSIGHTS_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": user_message,
                }
            ],
            timeout=10.0,
        )

        insights = message.content[0].text.strip()

        # Sanity check
        if not insights or len(insights) < 10:
            return ""

        # Limit to 3 lines max
        lines = [line.strip() for line in insights.split("\n") if line.strip()]
        insights = "\n".join(lines[:3])

        logger.info(f"AI insights generated: {len(insights)} chars")
        return insights

    except anthropic.APITimeoutError:
        logger.warning("AI insights timeout (10s)")
        return ""
    except anthropic.APIError as e:
        logger.error(f"Anthropic API error in insights: {e}")
        return ""
    except Exception as e:
        logger.error(f"AI insights unexpected error: {e}")
        return ""
