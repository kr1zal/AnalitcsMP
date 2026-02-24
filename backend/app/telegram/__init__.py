"""
Telegram bot module for Analytics Dashboard.
Uses aiogram 3 with webhook mode through FastAPI.

Bot: @RevioMPBot
Webhook: https://reviomp.ru/api/telegram/webhook
"""
import logging
from typing import Optional

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from ..config import get_settings

logger = logging.getLogger(__name__)

# Singleton instances
_bot: Optional[Bot] = None
_dp: Optional[Dispatcher] = None


def get_bot() -> Bot:
    """Get or create Bot singleton."""
    global _bot
    if _bot is None:
        settings = get_settings()
        token = settings.telegram_bot_token
        if not token:
            raise RuntimeError("TELEGRAM_BOT_TOKEN not set")
        _bot = Bot(
            token=token,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML),
        )
    return _bot


def get_dispatcher() -> Dispatcher:
    """Get or create Dispatcher singleton with all handlers registered."""
    global _dp
    if _dp is None:
        _dp = Dispatcher()
        # Register handlers
        from .handlers import register_handlers
        register_handlers(_dp)
    return _dp


def get_webhook_secret() -> str:
    """Get webhook secret for URL verification."""
    return get_settings().telegram_webhook_secret


def get_support_group_id() -> int:
    """Get support group chat ID."""
    return int(get_settings().telegram_support_group_id)
