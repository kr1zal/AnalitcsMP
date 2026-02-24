"""
Inline keyboard builders for Telegram bot.
"""
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton


WEBAPP_URL = "https://reviomp.ru"


def main_keyboard() -> InlineKeyboardMarkup:
    """Main action buttons after summary."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="Дашборд", url=f"{WEBAPP_URL}/"),
            InlineKeyboardButton(text="Остатки", url=f"{WEBAPP_URL}/?scrollTo=stocks"),
            InlineKeyboardButton(text="Настройки", url=f"{WEBAPP_URL}/settings?tab=profile"),
        ],
    ])


def support_keyboard() -> InlineKeyboardMarkup:
    """Support FAQ categories."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Тарифы и оплата", callback_data="faq_billing")],
        [InlineKeyboardButton(text="Синхронизация данных", callback_data="faq_sync")],
        [InlineKeyboardButton(text="Ошибки и проблемы", callback_data="faq_errors")],
        [InlineKeyboardButton(text="Связаться с оператором", callback_data="support_operator")],
        [InlineKeyboardButton(text="Назад", callback_data="back_main")],
    ])


def settings_keyboard(
    daily_summary: bool = True,
    morning_time: str = "09:00",
    evening_enabled: bool = False,
    evening_time: str = "21:00",
    stock_alerts: bool = True,
) -> InlineKeyboardMarkup:
    """Notification settings keyboard."""
    morning_icon = "вкл" if daily_summary else "выкл"
    evening_icon = "вкл" if evening_enabled else "выкл"
    stock_icon = "вкл" if stock_alerts else "выкл"

    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=f"Утренняя сводка: {morning_icon} ({morning_time})",
                callback_data="toggle_morning",
            ),
        ],
        [
            InlineKeyboardButton(
                text=f"Вечерняя сводка: {evening_icon} ({evening_time})",
                callback_data="toggle_evening",
            ),
        ],
        [
            InlineKeyboardButton(
                text=f"Алерты остатков: {stock_icon}",
                callback_data="toggle_stock_alerts",
            ),
        ],
        [
            InlineKeyboardButton(text="Утро: раньше", callback_data="morning_earlier"),
            InlineKeyboardButton(text="Утро: позже", callback_data="morning_later"),
        ],
        [
            InlineKeyboardButton(text="Вечер: раньше", callback_data="evening_earlier"),
            InlineKeyboardButton(text="Вечер: позже", callback_data="evening_later"),
        ],
        [InlineKeyboardButton(text="Назад", callback_data="back_main")],
    ])


def welcome_keyboard() -> InlineKeyboardMarkup:
    """Welcome message buttons."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="Сводка", callback_data="cmd_summary"),
            InlineKeyboardButton(text="Настройки", callback_data="cmd_settings"),
        ],
        [
            InlineKeyboardButton(text="Поддержка", callback_data="cmd_support"),
            InlineKeyboardButton(text="Справка", callback_data="cmd_help"),
        ],
    ])


def operator_cancel_keyboard() -> InlineKeyboardMarkup:
    """Cancel operator contact."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Отмена", callback_data="cancel_operator")],
    ])


def after_ai_keyboard() -> InlineKeyboardMarkup:
    """Keyboard shown after AI auto-response: resolve or escalate."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="Вопрос решён",
                callback_data="session_resolved",
            ),
            InlineKeyboardButton(
                text="Связаться с оператором",
                callback_data="escalate_operator",
            ),
        ],
    ])


def csat_keyboard() -> InlineKeyboardMarkup:
    """CSAT rating after session resolved."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="Да, помогли",
                callback_data="csat_positive",
            ),
            InlineKeyboardButton(
                text="Нет, не помогли",
                callback_data="csat_negative",
            ),
        ],
    ])
