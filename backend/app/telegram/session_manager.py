"""
Support session manager — persistent conversation storage in Supabase.
Handles session lifecycle: create -> active -> resolved/escalated -> closed.

All tg_support_* table access goes through this module.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import anthropic

from ..config import get_settings
from ..db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

# Session is considered stale after this many hours of inactivity
_SESSION_STALE_HOURS = 2

# Idle reminder threshold (minutes)
_IDLE_MINUTES = 30

# Auto-close resolved sessions after this many hours
_AUTO_CLOSE_HOURS = 2


async def get_or_create_session(
    chat_id: int,
    user_id: Optional[str] = None,
) -> dict:
    """
    Find active/resolved session for chat_id or create a new one.

    - Looks for status IN ('active', 'resolved') — resolved can be reopened
    - If resolved and last_message_at > _SESSION_STALE_HOURS ago, create new session
    - Returns dict with session_id, status, message_count
    """
    try:
        supabase = get_supabase_client()

        result = (
            supabase.table("tg_support_sessions")
            .select("session_id, status, message_count, last_message_at")
            .eq("chat_id", chat_id)
            .in_("status", ["active", "resolved"])
            .order("last_message_at", desc=True)
            .limit(1)
            .execute()
        )

        if result.data:
            session = result.data[0]
            # Check if resolved session is stale
            if session["status"] == "resolved":
                last_msg = session.get("last_message_at", "")
                if last_msg:
                    try:
                        last_dt = datetime.fromisoformat(
                            last_msg.replace("Z", "+00:00")
                        )
                        cutoff = datetime.now(timezone.utc) - timedelta(
                            hours=_SESSION_STALE_HOURS
                        )
                        if last_dt < cutoff:
                            # Stale resolved session — close it and create new
                            await close_session(session["session_id"])
                            return await _create_session(chat_id, user_id)
                    except (ValueError, TypeError):
                        pass

                # Reopen resolved session
                supabase.table("tg_support_sessions").update({
                    "status": "active",
                    "resolved_at": None,
                }).eq("session_id", session["session_id"]).execute()
                session["status"] = "active"

            return session

        # No active session found — create new
        return await _create_session(chat_id, user_id)

    except Exception as e:
        logger.error(f"get_or_create_session error for chat {chat_id}: {e}")
        # Return a fallback dict so callers can still proceed (graceful degradation)
        return {"session_id": None, "status": "active", "message_count": 0}


async def _create_session(
    chat_id: int,
    user_id: Optional[str] = None,
) -> dict:
    """Create a new support session."""
    supabase = get_supabase_client()
    row = {
        "chat_id": chat_id,
        "status": "active",
    }
    if user_id:
        row["user_id"] = user_id

    result = (
        supabase.table("tg_support_sessions")
        .insert(row)
        .execute()
    )

    if result.data:
        session = result.data[0]
        logger.info(f"Created support session {session['session_id']} for chat {chat_id}")
        return {
            "session_id": session["session_id"],
            "status": session["status"],
            "message_count": session.get("message_count", 0),
        }

    return {"session_id": None, "status": "active", "message_count": 0}


async def save_message(
    session_id: Optional[str],
    role: str,
    content: str,
    confidence: Optional[float] = None,
) -> None:
    """
    Save a message to tg_support_messages.
    Update session last_message_at and message_count.
    """
    if not session_id:
        return

    try:
        supabase = get_supabase_client()

        msg_row: dict = {
            "session_id": session_id,
            "role": role,
            "content": content,
        }
        if confidence is not None:
            msg_row["confidence"] = confidence

        supabase.table("tg_support_messages").insert(msg_row).execute()

        # Update session stats
        # Fetch current message_count to increment
        session_result = (
            supabase.table("tg_support_sessions")
            .select("message_count, ai_confidence_avg")
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        )

        updates: dict = {
            "last_message_at": datetime.now(timezone.utc).isoformat(),
        }

        if session_result.data:
            current = session_result.data[0]
            new_count = (current.get("message_count") or 0) + 1
            updates["message_count"] = new_count

            # Update rolling average AI confidence
            if confidence is not None and role == "bot":
                old_avg = current.get("ai_confidence_avg") or 0.0
                bot_count = max(1, new_count // 2)  # approximate bot message count
                updates["ai_confidence_avg"] = round(
                    old_avg + (confidence - old_avg) / bot_count, 3
                )

        supabase.table("tg_support_sessions").update(
            updates
        ).eq("session_id", session_id).execute()

    except Exception as e:
        logger.error(f"save_message error session={session_id}: {e}")


async def get_session_messages(
    session_id: str,
    limit: int = 20,
) -> list[dict]:
    """Get message history for a session, sorted by created_at ASC."""
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("tg_support_messages")
            .select("role, content, confidence, created_at")
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error(f"get_session_messages error session={session_id}: {e}")
        return []


async def build_ai_context(session_id: Optional[str]) -> list[dict]:
    """
    Build messages list for Claude API from session history.

    - If <= 10 messages: all messages in full
    - If > 10: use cached summary + last 10 messages
    - Format: [{"role": "user"/"assistant", "content": "..."}]
    """
    if not session_id:
        return []

    try:
        messages = await get_session_messages(session_id, limit=50)
        if not messages:
            return []

        # Check if we need summarization
        if len(messages) > 10:
            summary = await _get_or_create_summary(session_id, messages)
            # Use summary as context prefix + last 10 messages
            recent = messages[-10:]
            ai_messages = []
            if summary:
                ai_messages.append({
                    "role": "user",
                    "content": f"[Краткое содержание предыдущего разговора: {summary}]",
                })
                ai_messages.append({
                    "role": "assistant",
                    "content": "Понял, продолжаю с учётом предыдущего контекста.",
                })
            ai_messages.extend(_format_messages(recent))
            return ai_messages

        return _format_messages(messages)

    except Exception as e:
        logger.error(f"build_ai_context error session={session_id}: {e}")
        return []


def _format_messages(messages: list[dict]) -> list[dict]:
    """Convert DB messages to Claude API format."""
    formatted = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if not content:
            continue

        # Map DB roles to Claude API roles
        if role == "user":
            api_role = "user"
        else:
            # bot and operator both map to assistant
            api_role = "assistant"

        # Merge consecutive same-role messages
        if formatted and formatted[-1]["role"] == api_role:
            formatted[-1]["content"] += f"\n{content}"
        else:
            formatted.append({"role": api_role, "content": content})

    return formatted


async def _get_or_create_summary(
    session_id: str,
    messages: list[dict],
) -> Optional[str]:
    """Get cached summary or generate one."""
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("tg_support_sessions")
            .select("conversation_summary")
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        )

        if result.data:
            existing = result.data[0].get("conversation_summary")
            if existing:
                return existing

        # Generate summary
        return await summarize_conversation(session_id, messages)

    except Exception as e:
        logger.error(f"_get_or_create_summary error: {e}")
        return None


async def summarize_conversation(
    session_id: str,
    messages: Optional[list[dict]] = None,
) -> Optional[str]:
    """
    Generate conversation summary via Claude Haiku.
    Cache the result in tg_support_sessions.conversation_summary.
    """
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None

    try:
        if not messages:
            messages = await get_session_messages(session_id, limit=50)

        if not messages:
            return None

        # Build conversation text for summarization
        conv_text = "\n".join(
            f"{'Пользователь' if m['role'] == 'user' else 'Бот'}: {m['content']}"
            for m in messages
        )

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=(
                "Сделай краткое резюме диалога поддержки в 2-3 предложениях. "
                "Укажи тему обращения и текущий статус вопроса. "
                "Ответ на русском языке."
            ),
            messages=[{"role": "user", "content": conv_text}],
            timeout=10.0,
        )

        summary = response.content[0].text.strip()

        # Cache in DB
        supabase = get_supabase_client()
        supabase.table("tg_support_sessions").update({
            "conversation_summary": summary,
        }).eq("session_id", session_id).execute()

        logger.info(f"Generated summary for session {session_id}")
        return summary

    except Exception as e:
        logger.error(f"summarize_conversation error: {e}")
        return None


async def resolve_session(session_id: Optional[str]) -> None:
    """Mark session as resolved. Set resolved_at timestamp."""
    if not session_id:
        return
    try:
        supabase = get_supabase_client()
        supabase.table("tg_support_sessions").update({
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        }).eq("session_id", session_id).execute()
        logger.info(f"Session {session_id} resolved")
    except Exception as e:
        logger.error(f"resolve_session error: {e}")


async def escalate_session(
    session_id: Optional[str],
    reason: str = "",
) -> None:
    """Mark session as escalated. Set escalation_reason."""
    if not session_id:
        return
    try:
        supabase = get_supabase_client()
        supabase.table("tg_support_sessions").update({
            "status": "escalated",
            "escalation_reason": reason,
        }).eq("session_id", session_id).execute()
        logger.info(f"Session {session_id} escalated: {reason}")
    except Exception as e:
        logger.error(f"escalate_session error: {e}")


async def close_session(session_id: Optional[str]) -> None:
    """Close session. Set closed_at timestamp."""
    if not session_id:
        return
    try:
        supabase = get_supabase_client()
        supabase.table("tg_support_sessions").update({
            "status": "closed",
            "closed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("session_id", session_id).execute()
        logger.info(f"Session {session_id} closed")
    except Exception as e:
        logger.error(f"close_session error: {e}")


async def save_csat(
    session_id: Optional[str],
    rating: int,
    feedback: Optional[str] = None,
) -> None:
    """Save CSAT rating for a session."""
    if not session_id:
        return
    try:
        supabase = get_supabase_client()
        row: dict = {
            "session_id": session_id,
            "rating": rating,
        }
        if feedback:
            row["feedback"] = feedback
        supabase.table("tg_support_csat").insert(row).execute()
        logger.info(f"CSAT saved for session {session_id}: rating={rating}")
    except Exception as e:
        logger.error(f"save_csat error: {e}")


async def get_last_resolved_session(chat_id: int) -> Optional[dict]:
    """Find the most recent resolved/escalated session for a chat."""
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("tg_support_sessions")
            .select("session_id, status")
            .eq("chat_id", chat_id)
            .in_("status", ["resolved", "escalated"])
            .order("resolved_at", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"get_last_resolved_session error: {e}")
        return None


async def check_idle_sessions() -> list[dict]:
    """
    Find sessions where last_message_at > _IDLE_MINUTES ago and status = 'active'.
    For cron — send idle reminder.
    """
    try:
        supabase = get_supabase_client()
        cutoff = (
            datetime.now(timezone.utc) - timedelta(minutes=_IDLE_MINUTES)
        ).isoformat()

        result = (
            supabase.table("tg_support_sessions")
            .select("session_id, chat_id, last_message_at")
            .eq("status", "active")
            .lt("last_message_at", cutoff)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error(f"check_idle_sessions error: {e}")
        return []


async def auto_close_resolved() -> int:
    """
    Close sessions where status='resolved' and resolved_at > _AUTO_CLOSE_HOURS ago.
    Returns count of closed sessions.
    """
    try:
        supabase = get_supabase_client()
        cutoff = (
            datetime.now(timezone.utc) - timedelta(hours=_AUTO_CLOSE_HOURS)
        ).isoformat()

        result = (
            supabase.table("tg_support_sessions")
            .select("session_id")
            .eq("status", "resolved")
            .lt("resolved_at", cutoff)
            .execute()
        )

        sessions = result.data or []
        if not sessions:
            return 0

        now_iso = datetime.now(timezone.utc).isoformat()
        for s in sessions:
            supabase.table("tg_support_sessions").update({
                "status": "closed",
                "closed_at": now_iso,
            }).eq("session_id", s["session_id"]).execute()

        logger.info(f"Auto-closed {len(sessions)} resolved sessions")
        return len(sessions)
    except Exception as e:
        logger.error(f"auto_close_resolved error: {e}")
        return 0
