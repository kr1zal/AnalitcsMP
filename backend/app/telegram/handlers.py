"""
Telegram bot command and callback handlers.
Registered in Dispatcher via register_handlers().
"""
import logging
from html import escape as html_escape
from typing import Any, Optional

from aiogram import Dispatcher, Router, F
from aiogram.enums import ChatAction
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from ..db.supabase import get_supabase_client
from .keyboards import (
    main_keyboard,
    support_keyboard,
    settings_keyboard,
    welcome_keyboard,
    welcome_onboarding_keyboard,
    operator_cancel_keyboard,
    after_ai_keyboard,
    csat_keyboard,
)
from .support import FAQ_TEXTS, forward_to_support, reply_from_support
from .notifications import build_summary_message
from .ai_support import ai_answer, fetch_user_context, CONFIDENCE_THRESHOLD
from .session_manager import (
    get_or_create_session,
    save_message,
    build_ai_context,
    build_escalation_transcript,
    resolve_session,
    escalate_session,
    close_session,
    save_csat,
    get_last_resolved_session,
    summarize_conversation,
)
from . import get_bot, get_support_group_id

logger = logging.getLogger(__name__)

router = Router()


# ─── FSM States ───

class SupportState(StatesGroup):
    waiting_for_message = State()
    waiting_for_csat_feedback = State()


# ─── Helpers ───

def _get_user_link(chat_id: int) -> Optional[dict]:
    """Get telegram link row by chat_id."""
    supabase = get_supabase_client()
    result = (
        supabase.table("mp_telegram_links")
        .select("*")
        .eq("telegram_chat_id", chat_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def _adjust_time(current: str, direction: int) -> str:
    """Adjust HH:MM time by 1 hour."""
    h, m = current.split(":")
    new_h = (int(h) + direction) % 24
    return f"{new_h:02d}:{m}"


def _safe_user_display(user: Any) -> tuple[str, str]:
    """
    Extract and HTML-escape user display name and username.
    Prevents HTML injection via Telegram display names.
    Returns (escaped_name, escaped_username_with_at).
    """
    if user and hasattr(user, "full_name"):
        name = html_escape(user.full_name or "Неизвестный")
    else:
        name = "Неизвестный"

    if user and hasattr(user, "username") and user.username:
        username = f"@{html_escape(user.username)}"
    else:
        username = "нет username"

    return name, username


async def _handle_ai_support(
    message: Message,
    state: FSMContext,
    question: str,
    link: Optional[dict],
) -> None:
    """
    Common AI support flow used by both FSM handler and catch-all.
    1. Get/create session
    2. Save user message
    3. Fetch enriched user context (P2)
    4. Build context from DB history
    5. Send typing indicator (P1)
    6. AI answer with persistent history
    7. Save bot response or escalate
    """
    chat_id = message.chat.id
    user_id = link.get("user_id") if link else None

    # 1. Get or create persistent session
    session = await get_or_create_session(chat_id, user_id)
    session_id = session.get("session_id")

    # 2. Save user message to DB
    await save_message(session_id, "user", question)

    # 3. Fetch enriched user context (P2)
    ai_context: dict = {}
    if user_id:
        ai_context = await fetch_user_context(user_id)

    # P3: Extract first_name from Telegram message
    first_name: str | None = None
    if message.from_user and message.from_user.first_name:
        first_name = message.from_user.first_name

    # 4. Build context from DB history
    history = await build_ai_context(session_id)

    # 5. Send typing indicator (P1)
    try:
        await message.answer_chat_action(ChatAction.TYPING)
    except Exception:
        pass

    # 6. AI answer with persistent history + first_name (P3)
    answer, confidence = await ai_answer(
        question, ai_context, history=history, first_name=first_name,
    )

    if answer and confidence >= CONFIDENCE_THRESHOLD:
        # Save bot response to DB
        await save_message(session_id, "bot", answer, confidence)

        # Store session_id in FSM for callbacks
        await state.update_data(
            session_id=session_id,
            original_question=question,
            chat_id=chat_id,
        )

        # P4: Clean answer without template footer — buttons are enough
        await message.answer(
            answer,
            reply_markup=after_ai_keyboard(),
        )
        logger.info(
            f"AI support answered chat={chat_id} "
            f"confidence={confidence:.2f} session={session_id}"
        )
    else:
        # AI not confident or error — forward to human operator
        await escalate_session(session_id, "low_confidence")

        # P3: Send full transcript to support group
        group_id = get_support_group_id()
        bot = get_bot()
        if group_id and session_id:
            transcript = await build_escalation_transcript(session_id)
            name, username = _safe_user_display(message.from_user)
            user_id_line = (
                f"\nUser ID: <code>{link['user_id']}</code>" if link else ""
            )
            header = (
                f"<b>Заявка в поддержку</b> (AI не уверен)\n"
                f"Пользователь: {name} ({username}){user_id_line}\n"
                f"Chat ID: <code>{chat_id}</code>\n"
                f"{'=' * 30}\n"
            )
            try:
                await bot.send_message(group_id, header + "\n" + transcript)
            except Exception as e:
                logger.error(f"Failed to send transcript to support: {e}")
                # Fallback: forward original message
                await forward_to_support(bot, message, link)
        else:
            await forward_to_support(bot, message, link)

        await message.answer(
            "Передаю ваш вопрос оператору. Ответим в ближайшее время.",
            reply_markup=welcome_keyboard(),
        )


# ─── /start command ───

@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    """Handle /start command, including deep link for account binding."""
    args = message.text.split(maxsplit=1)
    deep_link_param = args[1] if len(args) > 1 else ""

    chat_id = message.chat.id
    username = message.from_user.username if message.from_user else None

    # Check if already linked
    existing = _get_user_link(chat_id)

    if deep_link_param.startswith("LINK_"):
        # Deep link binding
        token_str = deep_link_param[5:]  # Remove "LINK_" prefix
        await _handle_link(message, token_str, chat_id, username)
        return

    if existing:
        await message.answer(
            "<b>С возвращением!</b>\n\n"
            "Ваш аккаунт привязан. Выберите действие:",
            reply_markup=welcome_keyboard(),
        )
    else:
        await message.answer(
            "<b>Привет! Я бот RevioMP.</b>\n\n"
            "Буду присылать ежедневную сводку продаж "
            "с Wildberries и Ozon.\n\n"
            "Для начала привяжите аккаунт:\n"
            "1. Зайдите в <a href='https://reviomp.ru/settings?tab=profile'>настройки профиля</a>\n"
            "2. Нажмите «Подключить Telegram»\n"
            "3. Перейдите по ссылке\n\n"
            "После привязки начну присылать сводки!",
            reply_markup=welcome_keyboard(),
            disable_web_page_preview=True,
        )


async def _handle_link(
    message: Message,
    token_str: str,
    chat_id: int,
    username: Optional[str],
) -> None:
    """Process deep link token for account binding."""
    supabase = get_supabase_client()

    try:
        # Validate token
        result = (
            supabase.table("mp_telegram_link_tokens")
            .select("*")
            .eq("token", token_str)
            .eq("used", False)
            .limit(1)
            .execute()
        )

        if not result.data:
            await message.answer(
                "Ссылка недействительна или устарела.\n"
                "Создайте новую в <a href='https://reviomp.ru/settings?tab=profile'>настройках</a>.",
                disable_web_page_preview=True,
            )
            return

        token_row: Any = result.data[0]

        # Check expiry
        from datetime import datetime, timezone
        expires_at = str(token_row.get("expires_at", ""))
        if expires_at:
            try:
                exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if exp_dt < datetime.now(timezone.utc):
                    await message.answer(
                        "Ссылка устарела (5 минут). "
                        "Создайте новую в <a href='https://reviomp.ru/settings?tab=profile'>настройках</a>.",
                        disable_web_page_preview=True,
                    )
                    supabase.table("mp_telegram_link_tokens").update(
                        {"used": True}
                    ).eq("token", token_str).execute()
                    return
            except (ValueError, TypeError):
                pass

        user_id = token_row["user_id"]

        # Check if user already has a telegram link
        existing = (
            supabase.table("mp_telegram_links")
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            # Update existing link
            supabase.table("mp_telegram_links").update({
                "telegram_chat_id": chat_id,
                "telegram_username": username,
            }).eq("user_id", user_id).execute()
        else:
            # Create new link
            supabase.table("mp_telegram_links").insert({
                "user_id": user_id,
                "telegram_chat_id": chat_id,
                "telegram_username": username,
            }).execute()

        # Mark token as used
        supabase.table("mp_telegram_link_tokens").update(
            {"used": True}
        ).eq("token", token_str).execute()

        # P7: Welcome onboarding flow
        await message.answer(
            "Аккаунт успешно привязан! Вот что я умею:\n\n"
            "📊 Ежедневная сводка продаж (утро и вечер)\n"
            "🔔 Алерты при низких остатках\n"
            "💬 AI-помощник — просто напишите вопрос\n\n"
            "Настроить расписание сводок?",
            reply_markup=welcome_onboarding_keyboard(),
        )

    except Exception as e:
        logger.error(f"Link error for chat {chat_id}: {e}")
        await message.answer(
            "Ошибка привязки. Попробуйте ещё раз или обратитесь в /support"
        )


# ─── /summary command ───

@router.message(Command("summary"))
async def cmd_summary(message: Message) -> None:
    """Send instant summary."""
    link = _get_user_link(message.chat.id)
    if not link:
        await message.answer(
            "Аккаунт не привязан. Привяжите в "
            "<a href='https://reviomp.ru/settings?tab=profile'>настройках</a>.",
            disable_web_page_preview=True,
        )
        return

    loading = await message.answer("Собираю данные...")

    summary = await build_summary_message(link["user_id"])
    if summary:
        await loading.edit_text(summary, reply_markup=main_keyboard())
    else:
        await loading.edit_text("Не удалось получить данные. Попробуйте позже.")


# ─── /settings command ───

@router.message(Command("settings"))
async def cmd_settings(message: Message) -> None:
    """Show notification settings."""
    link = _get_user_link(message.chat.id)
    if not link:
        await message.answer(
            "Аккаунт не привязан. Привяжите в "
            "<a href='https://reviomp.ru/settings?tab=profile'>настройках</a>.",
            disable_web_page_preview=True,
        )
        return

    settings = link.get("settings") or {}
    await message.answer(
        "<b>Настройки уведомлений</b>\n\n"
        "Выберите, что настроить:",
        reply_markup=settings_keyboard(
            daily_summary=settings.get("daily_summary", True),
            morning_time=settings.get("morning_time", "09:00"),
            evening_enabled=settings.get("evening_enabled", False),
            evening_time=settings.get("evening_time", "21:00"),
            stock_alerts=settings.get("stock_alerts", True),
        ),
    )


# ─── /help command ───

@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    """Show help text."""
    await message.answer(
        "<b>Команды бота</b>\n\n"
        "/start — Привязать аккаунт\n"
        "/summary — Мгновенная сводка\n"
        "/settings — Настройки уведомлений\n"
        "/support — Поддержка и FAQ\n"
        "/help — Справка\n\n"
        "<b>Ежедневная сводка</b>\n"
        "Бот присылает сводку продаж по расписанию "
        "(настройки через /settings).\n\n"
        "<b>Привязка аккаунта</b>\n"
        "Зайдите в <a href='https://reviomp.ru/settings?tab=profile'>настройки профиля</a> "
        "на сайте и нажмите «Подключить Telegram».",
        disable_web_page_preview=True,
        reply_markup=welcome_keyboard(),
    )


# ─── /support command ───

@router.message(Command("support"))
async def cmd_support(message: Message) -> None:
    """Show support menu."""
    await message.answer(
        "<b>Поддержка RevioMP</b>\n\n"
        "Выберите категорию:",
        reply_markup=support_keyboard(),
    )


# ─── Callback handlers ───

@router.callback_query(F.data == "cmd_summary")
async def cb_summary(callback: CallbackQuery) -> None:
    """Summary button from welcome."""
    await callback.answer()
    link = _get_user_link(callback.message.chat.id)
    if not link:
        await callback.message.answer("Аккаунт не привязан.")
        return

    loading = await callback.message.answer("Собираю данные...")
    summary = await build_summary_message(link["user_id"])
    if summary:
        await loading.edit_text(summary, reply_markup=main_keyboard())
    else:
        await loading.edit_text("Не удалось получить данные.")


@router.callback_query(F.data == "cmd_settings")
async def cb_settings(callback: CallbackQuery) -> None:
    """Settings button."""
    await callback.answer()
    link = _get_user_link(callback.message.chat.id)
    if not link:
        await callback.message.answer("Аккаунт не привязан.")
        return

    settings = link.get("settings") or {}
    await callback.message.answer(
        "<b>Настройки уведомлений</b>",
        reply_markup=settings_keyboard(**{
            "daily_summary": settings.get("daily_summary", True),
            "morning_time": settings.get("morning_time", "09:00"),
            "evening_enabled": settings.get("evening_enabled", False),
            "evening_time": settings.get("evening_time", "21:00"),
            "stock_alerts": settings.get("stock_alerts", True),
        }),
    )


@router.callback_query(F.data == "cmd_support")
async def cb_support(callback: CallbackQuery) -> None:
    """Support button."""
    await callback.answer()
    await callback.message.answer(
        "<b>Поддержка RevioMP</b>\n\nВыберите категорию:",
        reply_markup=support_keyboard(),
    )


@router.callback_query(F.data == "cmd_help")
async def cb_help(callback: CallbackQuery) -> None:
    """Help button."""
    await callback.answer()
    await callback.message.answer(
        "<b>Команды бота</b>\n\n"
        "/start — Привязать аккаунт\n"
        "/summary — Мгновенная сводка\n"
        "/settings — Настройки уведомлений\n"
        "/support — Поддержка и FAQ\n"
        "/help — Справка",
    )


@router.callback_query(F.data == "back_main")
async def cb_back_main(callback: CallbackQuery, state: FSMContext) -> None:
    """Back to main menu."""
    await state.clear()
    await callback.answer()
    await callback.message.edit_text(
        "Выберите действие:",
        reply_markup=welcome_keyboard(),
    )


# ─── FAQ callbacks ───

@router.callback_query(F.data.in_(FAQ_TEXTS.keys()))
async def cb_faq(callback: CallbackQuery) -> None:
    """Show FAQ answer."""
    await callback.answer()
    text = FAQ_TEXTS.get(callback.data, "Раздел в разработке.")
    await callback.message.edit_text(
        text,
        reply_markup=support_keyboard(),
    )


# ─── Support operator callback ───

@router.callback_query(F.data == "support_operator")
async def cb_support_operator(callback: CallbackQuery, state: FSMContext) -> None:
    """Start operator contact flow."""
    await callback.answer()
    await state.set_state(SupportState.waiting_for_message)
    await callback.message.edit_text(
        "Опишите вашу проблему одним сообщением.\n"
        "Я передам его нашей команде поддержки.",
        reply_markup=operator_cancel_keyboard(),
    )


@router.callback_query(F.data == "cancel_operator")
async def cb_cancel_operator(callback: CallbackQuery, state: FSMContext) -> None:
    """Cancel operator contact."""
    await state.clear()
    await callback.answer()
    await callback.message.edit_text(
        "<b>Поддержка RevioMP</b>\n\nВыберите категорию:",
        reply_markup=support_keyboard(),
    )


@router.message(SupportState.waiting_for_message)
async def handle_support_message(message: Message, state: FSMContext) -> None:
    """
    AI-powered support: first try Claude Haiku, then escalate to operator.
    Flow: user question -> AI answer (if confident) -> user can escalate manually.
    """
    await state.clear()

    question = message.text or ""
    if not question.strip():
        await message.answer(
            "Пожалуйста, опишите вашу проблему текстом.",
            reply_markup=support_keyboard(),
        )
        return

    link = _get_user_link(message.chat.id)
    await _handle_ai_support(message, state, question, link)


# ─── Session resolved callback ───

@router.callback_query(F.data == "session_resolved")
async def cb_session_resolved(callback: CallbackQuery, state: FSMContext) -> None:
    """User clicked 'Вопрос решён' — resolve session and ask for CSAT."""
    await callback.answer()

    data = await state.get_data()
    session_id = data.get("session_id")

    # Fallback: find active session by chat_id (e.g., after idle reminder from cron)
    if not session_id:
        session = await get_or_create_session(callback.message.chat.id)
        session_id = session.get("session_id")
        if session_id:
            await state.update_data(session_id=session_id)

    if session_id:
        await resolve_session(session_id)

    await callback.message.edit_text(
        "Оцените качество поддержки:",
        reply_markup=csat_keyboard(),
    )


# ─── CSAT callbacks ───

@router.callback_query(F.data == "csat_positive")
async def cb_csat_positive(callback: CallbackQuery, state: FSMContext) -> None:
    """Positive CSAT — save rating, close session."""
    await callback.answer()

    data = await state.get_data()
    session_id = data.get("session_id")

    if not session_id:
        # Fallback: find last resolved session for this chat
        last = await get_last_resolved_session(callback.message.chat.id)
        if last:
            session_id = last["session_id"]

    if session_id:
        await save_csat(session_id, 5)
        await close_session(session_id)

    await state.clear()

    await callback.message.edit_text(
        "Спасибо за оценку! Если будут вопросы — пишите в любое время.",
        reply_markup=welcome_keyboard(),
    )


@router.callback_query(F.data == "csat_negative")
async def cb_csat_negative(callback: CallbackQuery, state: FSMContext) -> None:
    """Negative CSAT — save rating, escalate to operator with full transcript."""
    await callback.answer()

    data = await state.get_data()
    session_id = data.get("session_id")

    if not session_id:
        last = await get_last_resolved_session(callback.message.chat.id)
        if last:
            session_id = last["session_id"]

    if session_id:
        await save_csat(session_id, 1)
        await escalate_session(session_id, "negative_csat")

        # P3: Full transcript instead of just summary
        transcript = await build_escalation_transcript(session_id)
        group_id = get_support_group_id()
        if group_id:
            bot = get_bot()
            link = _get_user_link(callback.message.chat.id)
            name, username = _safe_user_display(callback.from_user)
            user_id_line = (
                f"\nUser ID: <code>{link['user_id']}</code>" if link else ""
            )

            header = (
                f"<b>Эскалация (отрицательная оценка)</b>\n"
                f"Пользователь: {name} ({username}){user_id_line}\n"
                f"Chat ID: <code>{callback.message.chat.id}</code>\n"
                f"{'=' * 30}\n"
            )
            if transcript:
                header += f"\n{transcript}"

            try:
                await bot.send_message(group_id, header)
            except Exception as e:
                logger.error(f"Failed to forward negative CSAT to support: {e}")

    # P5: Ask for feedback text on negative rating
    await state.update_data(session_id=session_id, csat_rating=1)
    await state.set_state(SupportState.waiting_for_csat_feedback)

    await callback.message.edit_text(
        "Передаём вопрос оператору. Ответим в ближайшее время.\n\n"
        "Что мы можем улучшить? Напишите пару слов — это поможет нам стать лучше.\n"
        "Или нажмите /start чтобы вернуться в меню.",
    )


# ─── CSAT partial callback (P5) ───

@router.callback_query(F.data == "csat_partial")
async def cb_csat_partial(callback: CallbackQuery, state: FSMContext) -> None:
    """Partial CSAT — rating 3, ask for feedback, then close."""
    await callback.answer()

    data = await state.get_data()
    session_id = data.get("session_id")

    if not session_id:
        last = await get_last_resolved_session(callback.message.chat.id)
        if last:
            session_id = last["session_id"]

    if session_id:
        await save_csat(session_id, 3)
        await close_session(session_id)

    # Ask for feedback
    await state.update_data(session_id=session_id, csat_rating=3)
    await state.set_state(SupportState.waiting_for_csat_feedback)

    await callback.message.edit_text(
        "Спасибо за оценку. Что мы можем улучшить?\n"
        "Напишите пару слов или нажмите /start чтобы вернуться в меню.",
    )


# ─── CSAT text feedback handler (P5) ───

@router.message(SupportState.waiting_for_csat_feedback)
async def handle_csat_feedback(message: Message, state: FSMContext) -> None:
    """Save text feedback from CSAT flow."""
    data = await state.get_data()
    session_id = data.get("session_id")
    rating = data.get("csat_rating", 3)
    await state.clear()

    feedback_text = (message.text or "").strip()
    if feedback_text and session_id:
        # Save feedback — update existing CSAT record
        try:
            supabase = get_supabase_client()
            supabase.table("tg_support_csat").update({
                "feedback": feedback_text,
            }).eq("session_id", session_id).execute()
            logger.info(f"CSAT feedback saved for session {session_id}: {feedback_text[:50]}")
        except Exception as e:
            logger.error(f"Failed to save CSAT feedback: {e}")

    await message.answer(
        "Спасибо за обратную связь! Если будут вопросы — пишите в любое время.",
        reply_markup=welcome_keyboard(),
    )


# ─── Escalate to operator callback ───

@router.callback_query(F.data == "escalate_operator")
async def cb_escalate_operator(callback: CallbackQuery, state: FSMContext) -> None:
    """Escalate to human operator after AI response didn't help."""
    await callback.answer()

    # Get stored data from FSM
    data = await state.get_data()
    original_question = data.get("original_question", "")
    session_id = data.get("session_id")
    await state.clear()

    # Fallback: find active session by chat_id
    if not session_id:
        session = await get_or_create_session(callback.message.chat.id)
        session_id = session.get("session_id")

    # Mark session as escalated
    if session_id:
        await escalate_session(session_id, "user_request")

    link = _get_user_link(callback.message.chat.id)
    bot = get_bot()

    group_id = get_support_group_id()
    if group_id:
        name, username = _safe_user_display(callback.from_user)
        user_id_line = (
            f"\nUser ID: <code>{link['user_id']}</code>" if link else ""
        )

        # P3: Full transcript instead of just original question
        transcript = ""
        if session_id:
            transcript = await build_escalation_transcript(session_id)

        header = (
            f"<b>Заявка в поддержку</b> (после AI-ответа)\n"
            f"Пользователь: {name} ({username}){user_id_line}\n"
            f"Chat ID: <code>{callback.message.chat.id}</code>\n"
            f"{'=' * 30}\n"
        )
        if transcript:
            header += f"\n{transcript}"
        elif original_question:
            header += f"\n{original_question}"

        try:
            await bot.send_message(group_id, header)
            await callback.message.edit_text(
                "Передаю ваш диалог оператору. Ответим в ближайшее время.",
                reply_markup=welcome_keyboard(),
            )
            return
        except Exception as e:
            logger.error(f"Failed to escalate to support: {e}")

    await callback.message.edit_text(
        "Не удалось связаться с оператором. "
        "Напишите на support@reviomp.ru",
        reply_markup=welcome_keyboard(),
    )


# ─── Settings toggle callbacks ───

@router.callback_query(F.data == "toggle_morning")
async def cb_toggle_morning(callback: CallbackQuery) -> None:
    await _toggle_setting(callback, "daily_summary")


@router.callback_query(F.data == "toggle_evening")
async def cb_toggle_evening(callback: CallbackQuery) -> None:
    await _toggle_setting(callback, "evening_enabled")


@router.callback_query(F.data == "toggle_stock_alerts")
async def cb_toggle_stock_alerts(callback: CallbackQuery) -> None:
    await _toggle_setting(callback, "stock_alerts")


@router.callback_query(F.data == "morning_earlier")
async def cb_morning_earlier(callback: CallbackQuery) -> None:
    await _adjust_setting_time(callback, "morning_time", -1)


@router.callback_query(F.data == "morning_later")
async def cb_morning_later(callback: CallbackQuery) -> None:
    await _adjust_setting_time(callback, "morning_time", 1)


@router.callback_query(F.data == "evening_earlier")
async def cb_evening_earlier(callback: CallbackQuery) -> None:
    await _adjust_setting_time(callback, "evening_time", -1)


@router.callback_query(F.data == "evening_later")
async def cb_evening_later(callback: CallbackQuery) -> None:
    await _adjust_setting_time(callback, "evening_time", 1)


async def _toggle_setting(callback: CallbackQuery, key: str) -> None:
    """Toggle a boolean setting."""
    await callback.answer()
    link = _get_user_link(callback.message.chat.id)
    if not link:
        return

    settings = link.get("settings") or {}
    defaults = {
        "daily_summary": True,
        "evening_enabled": False,
        "stock_alerts": True,
    }
    current = settings.get(key, defaults.get(key, True))
    settings[key] = not current

    supabase = get_supabase_client()
    supabase.table("mp_telegram_links").update(
        {"settings": settings}
    ).eq("telegram_chat_id", callback.message.chat.id).execute()

    await callback.message.edit_reply_markup(
        reply_markup=settings_keyboard(
            daily_summary=settings.get("daily_summary", True),
            morning_time=settings.get("morning_time", "09:00"),
            evening_enabled=settings.get("evening_enabled", False),
            evening_time=settings.get("evening_time", "21:00"),
            stock_alerts=settings.get("stock_alerts", True),
        ),
    )


async def _adjust_setting_time(callback: CallbackQuery, key: str, direction: int) -> None:
    """Adjust time setting by 1 hour."""
    await callback.answer()
    link = _get_user_link(callback.message.chat.id)
    if not link:
        return

    settings = link.get("settings") or {}
    defaults = {"morning_time": "09:00", "evening_time": "21:00"}
    current = settings.get(key, defaults.get(key, "09:00"))
    settings[key] = _adjust_time(current, direction)

    supabase = get_supabase_client()
    supabase.table("mp_telegram_links").update(
        {"settings": settings}
    ).eq("telegram_chat_id", callback.message.chat.id).execute()

    await callback.message.edit_reply_markup(
        reply_markup=settings_keyboard(
            daily_summary=settings.get("daily_summary", True),
            morning_time=settings.get("morning_time", "09:00"),
            evening_enabled=settings.get("evening_enabled", False),
            evening_time=settings.get("evening_time", "21:00"),
            stock_alerts=settings.get("stock_alerts", True),
        ),
    )


# ─── Catch-all: free text messages → AI support ───

@router.message(F.text, F.chat.type == "private")
async def handle_free_text(message: Message, state: FSMContext) -> None:
    """
    Catch-all for text messages not matched by commands or FSM.
    Routes through AI support directly — no need to navigate menus.
    Uses persistent session for conversation continuity.
    Filter: private chats only — group replies handled by support_group_router.
    """

    question = message.text or ""
    if not question.strip():
        return

    link = _get_user_link(message.chat.id)
    await _handle_ai_support(message, state, question, link)


# ─── Support group message handler ───

support_group_router = Router()


@support_group_router.message(F.reply_to_message)
async def handle_support_reply(message: Message) -> None:
    """Handle replies in support group -> forward to user."""
    group_id = get_support_group_id()
    if message.chat.id != group_id:
        return

    bot = get_bot()
    sent = await reply_from_support(bot, message)
    if sent:
        await message.reply("Ответ отправлен пользователю.")


# ─── Register all handlers ───

def register_handlers(dp: Dispatcher) -> None:
    """Register all handlers with dispatcher."""
    dp.include_router(router)
    dp.include_router(support_group_router)
