"""
AI-powered support auto-responder for Telegram bot.
Uses Claude Haiku to answer user questions from knowledge base.
Falls back to human operator on low confidence or errors.

History is managed by session_manager (persistent DB storage),
NOT in-memory.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import anthropic

from ..config import get_settings
from ..db.supabase import get_supabase_client
from .support import FAQ_TEXTS

logger = logging.getLogger(__name__)

# Confidence threshold: below this, escalate to human operator
CONFIDENCE_THRESHOLD = 0.7

# Knowledge base for system prompt (product info + FAQ)
KNOWLEDGE_BASE = """
Ты — AI-ассистент службы поддержки RevioMP (reviomp.ru).
RevioMP — SaaS-платформа аналитики для маркетплейсов Wildberries и Ozon.

ПРОДУКТ:
- Единый дашборд для WB и Ozon: заказы, выкупы, выручка, прибыль, реклама, остатки
- Unit-экономика (UE): прибыль по каждому товару с разбивкой FBO/FBS
- Мониторинг заказов: воронка заказы -> выкупы -> возвраты
- Управление товарами: группировка, drag&drop, себестоимость
- План продаж: 3 уровня (общий -> по МП -> по товарам)
- Ежедневная сводка в Telegram
- Экспорт в Excel и PDF
- Виджетный дашборд с настраиваемыми карточками

ТАРИФЫ:
- Free: бесплатно, до 3 SKU, только WB, синхронизация 2 раза/день
- Pro: 990 руб/мес, до 20 SKU, WB + Ozon, FBS-аналитика, синхронизация каждые 6 часов, 1 ручная синхронизация/день

ПОДКЛЮЧЕНИЕ:
1. Регистрация на reviomp.ru
2. Вставить API-токен WB/Ozon в настройках (reviomp.ru/settings?tab=connections)
3. Дождаться первой синхронизации (до 30 минут)

ЧАСТЫЕ ВОПРОСЫ:
{faq_texts}

ТЕХНИЧЕСКИЕ ДЕТАЛИ:
- Данные синхронизируются автоматически по расписанию тарифа
- WB и Ozon API обновляют данные с задержкой 1-2 дня
- Прибыль = выплаты - себестоимость - реклама
- Остатки: прогноз в днях = текущий остаток / среднедневные продажи за 30 дней
- Оплата через YooKassa (карта, СБП)

ПРАВИЛА ОТВЕТА:
- Отвечай кратко и по делу (2-5 предложений)
- Если вопрос о конкретных данных пользователя — направь на дашборд reviomp.ru
- Если не знаешь точный ответ — скажи честно и предложи связаться с оператором
- Формат: обычный текст (без markdown, без HTML)
- Язык: русский

Ответь в формате JSON:
{{"answer": "текст ответа", "confidence": 0.0-1.0}}

confidence:
- 0.9-1.0: точный ответ из базы знаний
- 0.7-0.8: ответ вероятно корректный
- 0.3-0.6: не уверен, лучше спросить оператора
- 0.0-0.2: не знаю ответа
"""


async def fetch_user_context(user_id: str) -> dict:
    """
    Fetch user profile data from Supabase for AI context enrichment.
    Returns dict with plan, products_count, marketplaces, last_sync, name.
    Graceful degradation: returns empty dict on any error.
    """
    if not user_id:
        return {}

    try:
        supabase = get_supabase_client()
        ctx: dict = {"user_id": user_id}

        # 1. Subscription plan
        try:
            sub_result = (
                supabase.table("mp_subscriptions")
                .select("plan_id, status")
                .eq("user_id", user_id)
                .eq("status", "active")
                .limit(1)
                .execute()
            )
            if sub_result.data:
                ctx["plan"] = sub_result.data[0].get("plan_id", "free")
            else:
                ctx["plan"] = "free"
        except Exception:
            ctx["plan"] = "free"

        # 2. Products count
        try:
            prod_result = (
                supabase.table("mp_products")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            ctx["products_count"] = prod_result.count or 0
        except Exception:
            pass

        # 3. Connected marketplaces
        try:
            tokens_result = (
                supabase.table("mp_marketplace_tokens")
                .select("marketplace")
                .eq("user_id", user_id)
                .execute()
            )
            if tokens_result.data:
                mps = list({t["marketplace"] for t in tokens_result.data})
                ctx["marketplaces"] = mps
        except Exception:
            pass

        # 4. Last sync time
        try:
            sync_result = (
                supabase.table("mp_sync_queue")
                .select("completed_at")
                .eq("user_id", user_id)
                .eq("status", "completed")
                .order("completed_at", desc=True)
                .limit(1)
                .execute()
            )
            if sync_result.data:
                completed = sync_result.data[0].get("completed_at")
                if completed:
                    try:
                        completed_dt = datetime.fromisoformat(
                            completed.replace("Z", "+00:00")
                        )
                        delta = datetime.now(timezone.utc) - completed_dt
                        hours = int(delta.total_seconds() // 3600)
                        if hours < 1:
                            ctx["last_sync"] = "менее часа назад"
                        elif hours < 24:
                            ctx["last_sync"] = f"{hours} ч. назад"
                        else:
                            days = hours // 24
                            ctx["last_sync"] = f"{days} дн. назад"
                    except (ValueError, TypeError):
                        pass
        except Exception:
            pass

        logger.info(f"Fetched user context for {user_id}: plan={ctx.get('plan')}")
        return ctx

    except Exception as e:
        logger.error(f"fetch_user_context error for {user_id}: {e}")
        return {}


def _build_system_prompt() -> str:
    """Build system prompt with FAQ knowledge base."""
    faq_text = "\n\n".join(
        f"Вопрос: {key}\n{text}"
        for key, text in FAQ_TEXTS.items()
    )
    return KNOWLEDGE_BASE.format(faq_texts=faq_text)


def _get_client() -> Optional[anthropic.AsyncAnthropic]:
    """Get async Anthropic client if API key is configured."""
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not configured, AI support disabled")
        return None
    return anthropic.AsyncAnthropic(api_key=api_key)


async def ai_answer(
    question: str,
    context: Optional[dict] = None,
    history: Optional[list[dict]] = None,
) -> tuple[str, float]:
    """
    Generate AI answer to a support question with persistent conversation history.

    Args:
        question: User's question text
        context: Optional context (user_id, plan, etc.)
        history: Conversation history from session_manager.build_ai_context()

    Returns:
        Tuple of (answer_text, confidence_score).
        On error returns ("", 0.0) — triggers fallback to human operator.
    """
    client = _get_client()
    if not client:
        return ("", 0.0)

    try:
        system_prompt = _build_system_prompt()

        # Add enriched user context if available
        user_context = ""
        if context:
            parts = []
            if context.get("plan"):
                plan_names = {"free": "Free", "pro": "Pro", "business": "Business"}
                parts.append(f"тариф {plan_names.get(context['plan'], context['plan'])}")
            if context.get("marketplaces"):
                parts.append(f"подключены: {', '.join(context['marketplaces'])}")
            if context.get("products_count"):
                parts.append(f"{context['products_count']} товаров")
            if context.get("last_sync"):
                parts.append(f"последняя синхронизация: {context['last_sync']}")
            if parts:
                user_context = "\nКонтекст пользователя: " + ", ".join(parts)

        # Build messages with persistent conversation history
        messages = []
        if history:
            messages.extend(history)

        messages.append({
            "role": "user",
            "content": f"{question}{user_context}",
        })

        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=system_prompt,
            messages=messages,
            timeout=10.0,
        )

        # Parse response
        raw_text = message.content[0].text.strip()

        # Strip markdown code block wrapper if present (```json ... ```)
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            raw_text = "\n".join(lines).strip()

        # Try to parse as JSON
        try:
            parsed = json.loads(raw_text)
            answer = parsed.get("answer", "")
            confidence = float(parsed.get("confidence", 0.0))
        except (json.JSONDecodeError, ValueError, TypeError):
            answer = raw_text
            confidence = 0.5

        # Sanitize
        if not answer or len(answer) < 5:
            return ("", 0.0)

        confidence = max(0.0, min(1.0, confidence))

        history_len = len(history) if history else 0
        logger.info(
            f"AI support answer: confidence={confidence:.2f}, "
            f"history_messages={history_len}"
        )

        return (answer, confidence)

    except anthropic.APITimeoutError:
        logger.warning("AI support timeout (10s)")
        return ("", 0.0)
    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        return ("", 0.0)
    except Exception as e:
        logger.error(f"AI support unexpected error: {e}")
        return ("", 0.0)
