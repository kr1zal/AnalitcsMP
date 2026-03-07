"""
FAQ texts and support escalation for Telegram bot.
Forwards user messages to support group and routes replies back.
Operator replies are persisted in tg_support_messages via session_manager.
"""
import logging
from html import escape as html_escape
from typing import Optional

from aiogram import Bot
from aiogram.types import Message

from . import get_support_group_id

logger = logging.getLogger(__name__)

# ─── FAQ texts ───

FAQ_TEXTS = {
    "faq_billing": (
        "<b>Тарифы и оплата</b>\n\n"
        "Доступны 2 тарифа:\n"
        "\u2014 <b>Free</b> \u2014 бесплатно, 15 SKU, WB+Ozon, детализация удержаний, сравнение периодов, 1 ручная синхронизация/день\n"
        "\u2014 <b>Pro</b> \u2014 1 490 руб/мес, 50 SKU, WB+Ozon, UE, реклама, план продаж, PDF, 3 ручных синхронизации/день\n\n"
        "Оплата через YooKassa (карта, СБП).\n"
        "Управление подпиской: reviomp.ru/settings?tab=billing\n\n"
        "Если оплата не прошла \u2014 напишите оператору."
    ),
    "faq_sync": (
        "<b>Синхронизация данных</b>\n\n"
        "Данные синхронизируются автоматически:\n"
        "\u2014 <b>Free:</b> 2 раза в день + 1 ручная синхронизация\n"
        "\u2014 <b>Pro:</b> каждые 6 часов + 3 ручных синхронизации/день\n\n"
        "Ручная синхронизация: reviomp.ru/settings?tab=connections\n\n"
        "Если данные не обновляются:\n"
        "1. Проверьте API-токены в настройках\n"
        "2. Убедитесь, что токены не истекли\n"
        "3. Подождите 30 минут после сохранения токенов"
    ),
    "faq_errors": (
        "<b>Ошибки и проблемы</b>\n\n"
        "Частые проблемы:\n\n"
        "<b>Не загружаются данные:</b>\n"
        "\u2014 Проверьте интернет-соединение\n"
        "\u2014 Обновите страницу (Ctrl+F5)\n"
        "\u2014 Очистите кеш браузера\n\n"
        "<b>Несовпадение цифр с ЛК:</b>\n"
        "\u2014 WB/Ozon обновляют данные с задержкой 1-2 дня\n"
        "\u2014 Проверьте диапазон дат\n"
        "\u2014 Убедитесь, что синхронизация завершена\n\n"
        "Если проблема не решена \u2014 напишите оператору."
    ),
}


async def forward_to_support(
    bot: Bot,
    user_message: Message,
    link: Optional[dict] = None,
) -> bool:
    """
    Forward user message to support group with user info header.
    Returns True if forwarded successfully.
    """
    group_id = get_support_group_id()
    if not group_id:
        logger.error("Support group ID not configured")
        return False

    try:
        user = user_message.from_user
        username = f"@{html_escape(user.username)}" if user and user.username else "нет username"
        name = html_escape(user.full_name) if user and user.full_name else "Неизвестный"
        user_id_line = f"\nUser ID: <code>{link['user_id']}</code>" if link else ""

        header = (
            f"<b>Заявка в поддержку</b>\n"
            f"Пользователь: {name} ({username}){user_id_line}\n"
            f"Chat ID: <code>{user_message.chat.id}</code>\n"
            f"{'=' * 30}"
        )

        # Send header
        await bot.send_message(group_id, header)

        # Forward original message
        await user_message.forward(group_id)

        return True
    except Exception as e:
        logger.error(f"Failed to forward to support group: {e}")
        return False


async def reply_from_support(
    bot: Bot,
    support_message: Message,
) -> bool:
    """
    Route reply from support group back to user.
    Works when support replies to a forwarded message.
    Saves operator message to session DB for history tracking.
    P4: Sends "operator joined" notification once per session.
    Returns True if reply sent successfully.
    """
    reply = support_message.reply_to_message
    if not reply:
        return False

    user_chat_id = None

    # Check if replied message contains chat ID in text (from our header)
    if reply.text and "Chat ID:" in reply.text:
        try:
            for line in reply.text.split("\n"):
                if "Chat ID:" in line:
                    chat_id_str = line.split("Chat ID:")[1].strip()
                    # Strip HTML code tags if present
                    chat_id_str = chat_id_str.replace("<code>", "").replace("</code>", "")
                    user_chat_id = int(chat_id_str)
                    break
        except (ValueError, IndexError):
            pass

    # Fallback: if replied to forwarded message, get original sender
    if not user_chat_id and reply.forward_from:
        user_chat_id = reply.forward_from.id

    if not user_chat_id:
        return False

    try:
        # P4: "Operator joined" notification — once per session
        try:
            from .session_manager import (
                get_or_create_session, save_message,
                is_operator_joined, mark_operator_joined,
            )
            session = await get_or_create_session(user_chat_id)
            session_id = session.get("session_id")

            if session_id:
                joined = await is_operator_joined(session_id)
                if not joined:
                    await bot.send_message(
                        user_chat_id,
                        "К вашему диалогу подключился оператор поддержки.",
                    )
                    await mark_operator_joined(session_id)
        except Exception as e:
            logger.warning(f"Failed to check/send operator joined: {e}")
            session_id = None

        reply_text = support_message.text or support_message.caption or ""
        text = (
            f"<b>Поддержка RevioMP:</b>\n\n"
            f"{reply_text}"
        )
        await bot.send_message(user_chat_id, text)

        # Save operator message to session DB (best effort)
        try:
            if session_id and reply_text:
                await save_message(session_id, "operator", reply_text)
        except Exception as e:
            logger.warning(f"Failed to save operator message to session DB: {e}")

        return True
    except Exception as e:
        logger.error(f"Failed to send reply to user {user_chat_id}: {e}")
        return False
