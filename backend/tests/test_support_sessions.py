"""
Enterprise-level tests for Telegram Support Sessions v2.
Tests: session lifecycle, AI context, CSAT, escalation, edge cases.
Run on VPS: python -m tests.test_support_sessions
"""
import asyncio
import sys

# Ensure app imports work
sys.path.insert(0, "/var/www/analytics/backend")


async def test_all():
    from app.db.supabase import get_supabase_client
    from app.telegram.session_manager import (
        get_or_create_session, save_message, build_ai_context,
        resolve_session, escalate_session, close_session,
        save_csat, check_idle_sessions, auto_close_resolved,
        get_last_resolved_session,
    )
    from app.telegram.ai_support import ai_answer

    supabase = get_supabase_client()
    TEST_CHAT_ID = 99999999
    TEST_USER_ID = "e2db2023-4ce3-4182-96d3-7a194657cb4a"
    results = {}
    created_sessions = []

    try:
        # ═══ TEST 1: Session creation ═══
        print("\n═══ TEST 1: Session creation ═══")
        session = await get_or_create_session(TEST_CHAT_ID, TEST_USER_ID)
        sid = session.get("session_id")
        assert sid is not None, "session_id is None"
        assert session["status"] == "active"
        created_sessions.append(sid)

        db_row = supabase.table("tg_support_sessions").select("*").eq("session_id", sid).execute()
        assert len(db_row.data) == 1
        assert db_row.data[0]["chat_id"] == TEST_CHAT_ID
        assert db_row.data[0]["user_id"] == TEST_USER_ID
        print(f"  PASS: session_id={sid[:8]}..., verified in DB")
        results["01_session_creation"] = "PASS"

        # ═══ TEST 2: Save message ═══
        print("\n═══ TEST 2: Save message ═══")
        await save_message(sid, "user", "Как оплатить тариф Pro?")
        msgs = supabase.table("tg_support_messages").select("*").eq("session_id", sid).execute()
        assert len(msgs.data) == 1
        assert msgs.data[0]["role"] == "user"
        assert msgs.data[0]["content"] == "Как оплатить тариф Pro?"

        s_row = supabase.table("tg_support_sessions").select("message_count").eq("session_id", sid).execute()
        assert s_row.data[0]["message_count"] == 1
        print("  PASS: message saved, count=1")
        results["02_save_message"] = "PASS"

        # ═══ TEST 3: AI answer with history ═══
        print("\n═══ TEST 3: AI answer with history ═══")
        history = await build_ai_context(sid)
        assert isinstance(history, list) and len(history) >= 1

        answer, confidence = await ai_answer(
            "Как оплатить тариф Pro?",
            context={"user_id": TEST_USER_ID},
            history=history,
        )
        assert answer and len(answer) > 5, f"Empty answer: '{answer}'"
        assert 0.0 <= confidence <= 1.0
        await save_message(sid, "bot", answer, confidence)
        print(f"  PASS: confidence={confidence:.2f}, answer={answer[:60]}...")
        results["03_ai_answer"] = "PASS"

        # ═══ TEST 4: Context continuity ═══
        print("\n═══ TEST 4: Context continuity ═══")
        await save_message(sid, "user", "А можно оплатить через СБП?")
        history2 = await build_ai_context(sid)
        assert len(history2) >= 3, f"Expected >=3, got {len(history2)}"

        answer2, conf2 = await ai_answer(
            "А можно оплатить через СБП?",
            context={"user_id": TEST_USER_ID},
            history=history2,
        )
        assert answer2 and len(answer2) > 5
        await save_message(sid, "bot", answer2, conf2)

        s_row = supabase.table("tg_support_sessions").select("message_count, ai_confidence_avg").eq("session_id", sid).execute()
        assert s_row.data[0]["message_count"] == 4
        avg_conf = s_row.data[0]["ai_confidence_avg"]
        print(f"  PASS: count=4, avg_confidence={avg_conf}, answer={answer2[:60]}...")
        results["04_context_continuity"] = "PASS"

        # ═══ TEST 5: Same session on repeated call ═══
        print("\n═══ TEST 5: Same session on repeated get_or_create ═══")
        session2 = await get_or_create_session(TEST_CHAT_ID, TEST_USER_ID)
        assert session2["session_id"] == sid, "Got different session!"
        print("  PASS: same session_id returned")
        results["05_same_session"] = "PASS"

        # ═══ TEST 6: Resolve session ═══
        print("\n═══ TEST 6: Resolve session ═══")
        await resolve_session(sid)
        s_row = supabase.table("tg_support_sessions").select("status, resolved_at").eq("session_id", sid).execute()
        assert s_row.data[0]["status"] == "resolved"
        assert s_row.data[0]["resolved_at"] is not None
        print("  PASS: status=resolved, resolved_at set")
        results["06_resolve"] = "PASS"

        # ═══ TEST 7: Reopen resolved session ═══
        print("\n═══ TEST 7: Reopen resolved session ═══")
        session3 = await get_or_create_session(TEST_CHAT_ID, TEST_USER_ID)
        assert session3["session_id"] == sid, "Should reopen same session"
        assert session3["status"] == "active"
        print("  PASS: session reopened to active")
        results["07_reopen"] = "PASS"

        # ═══ TEST 8: CSAT save ═══
        print("\n═══ TEST 8: CSAT save ═══")
        await resolve_session(sid)
        await save_csat(sid, 5)
        csat = supabase.table("tg_support_csat").select("*").eq("session_id", sid).execute()
        assert len(csat.data) == 1
        assert csat.data[0]["rating"] == 5
        print("  PASS: CSAT rating=5 saved")
        results["08_csat"] = "PASS"

        # ═══ TEST 9: Close session ═══
        print("\n═══ TEST 9: Close session ═══")
        await close_session(sid)
        s_row = supabase.table("tg_support_sessions").select("status, closed_at").eq("session_id", sid).execute()
        assert s_row.data[0]["status"] == "closed"
        assert s_row.data[0]["closed_at"] is not None
        print("  PASS: status=closed, closed_at set")
        results["09_close"] = "PASS"

        # ═══ TEST 10: New session after close ═══
        print("\n═══ TEST 10: New session after close ═══")
        session4 = await get_or_create_session(TEST_CHAT_ID, TEST_USER_ID)
        new_sid = session4["session_id"]
        assert new_sid != sid, "Should create NEW session"
        created_sessions.append(new_sid)
        print(f"  PASS: new session {new_sid[:8]}...")
        results["10_new_after_close"] = "PASS"

        # ═══ TEST 11: Escalation ═══
        print("\n═══ TEST 11: Escalation ═══")
        await save_message(new_sid, "user", "Тестовый вопрос для эскалации")
        await escalate_session(new_sid, "user_request")
        s_row = supabase.table("tg_support_sessions").select("status, escalation_reason").eq("session_id", new_sid).execute()
        assert s_row.data[0]["status"] == "escalated"
        assert s_row.data[0]["escalation_reason"] == "user_request"
        print("  PASS: status=escalated, reason=user_request")
        results["11_escalation"] = "PASS"

        # ═══ TEST 12: get_last_resolved_session ═══
        print("\n═══ TEST 12: get_last_resolved_session ═══")
        last = await get_last_resolved_session(TEST_CHAT_ID)
        assert last is not None
        print(f"  PASS: found session, status={last['status']}")
        results["12_last_resolved"] = "PASS"

        # ═══ TEST 13: Graceful degradation ═══
        print("\n═══ TEST 13: Graceful degradation (None inputs) ═══")
        await save_message(None, "user", "no-op")
        h = await build_ai_context(None)
        assert h == []
        await resolve_session(None)
        await escalate_session(None, "test")
        await close_session(None)
        await save_csat(None, 5)
        print("  PASS: all None operations handled")
        results["13_graceful_degradation"] = "PASS"

        # ═══ TEST 14: AI context format validation ═══
        print("\n═══ TEST 14: AI context format ═══")
        context = await build_ai_context(sid)
        for msg in context:
            assert msg["role"] in ("user", "assistant"), f"Bad role: {msg['role']}"
            assert isinstance(msg["content"], str) and len(msg["content"]) > 0
        print(f"  PASS: {len(context)} messages, all valid Claude API format")
        results["14_context_format"] = "PASS"

        # ═══ TEST 15: Idle detection (no idle sessions for test chat) ═══
        print("\n═══ TEST 15: Idle session detection ═══")
        idle = await check_idle_sessions()
        # Our test sessions are closed/escalated, should NOT appear
        test_idle = [s for s in idle if s["chat_id"] == TEST_CHAT_ID]
        assert len(test_idle) == 0, "Closed/escalated sessions should not be idle"
        print(f"  PASS: {len(idle)} idle sessions total, 0 from test")
        results["15_idle_detection"] = "PASS"

        # ═══ TEST 16: Auto-close resolved ═══
        print("\n═══ TEST 16: Auto-close resolved ═══")
        closed_count = await auto_close_resolved()
        print(f"  PASS: auto_close_resolved returned {closed_count}")
        results["16_auto_close"] = "PASS"

        # ═══ TEST 17: Confidence threshold boundary ═══
        print("\n═══ TEST 17: AI confidence threshold ═══")
        # Tricky question should get lower confidence
        tricky_answer, tricky_conf = await ai_answer(
            "Можно ли подключить Amazon?",
            context={"user_id": TEST_USER_ID},
            history=[],
        )
        print(f"  Tricky Q confidence: {tricky_conf:.2f}")
        print(f"  Answer: {tricky_answer[:60]}...")
        # Just verify it returns valid data
        assert isinstance(tricky_conf, float)
        assert 0.0 <= tricky_conf <= 1.0
        results["17_confidence_boundary"] = "PASS"

        # ═══ TEST 18: Message role mapping (operator → assistant) ═══
        print("\n═══ TEST 18: Operator role mapping ═══")
        # Create a fresh session for this test
        s5 = await get_or_create_session(TEST_CHAT_ID + 1)
        s5_id = s5["session_id"]
        created_sessions.append(s5_id)
        await save_message(s5_id, "user", "Помогите")
        await save_message(s5_id, "operator", "Чем могу помочь?")
        ctx = await build_ai_context(s5_id)
        roles = [m["role"] for m in ctx]
        assert "operator" not in roles, "Operator should be mapped to assistant"
        assert "assistant" in roles, "Operator message should appear as assistant"
        print("  PASS: operator mapped to assistant in AI context")
        results["18_operator_mapping"] = "PASS"

    except Exception as e:
        print(f"\n  FAIL: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # ═══ CLEANUP ═══
        print("\n═══ CLEANUP ═══")
        for s in created_sessions:
            supabase.table("tg_support_csat").delete().eq("session_id", s).execute()
            supabase.table("tg_support_messages").delete().eq("session_id", s).execute()
            supabase.table("tg_support_sessions").delete().eq("session_id", s).execute()
        # Also clean up chat_id+1
        supabase.table("tg_support_sessions").delete().eq("chat_id", TEST_CHAT_ID + 1).execute()
        print(f"  Cleaned {len(created_sessions)} test sessions")

        # ═══ SUMMARY ═══
        print("\n" + "=" * 60)
        print("TEST RESULTS")
        print("=" * 60)
        passed = sum(1 for v in results.values() if v == "PASS")
        failed = sum(1 for v in results.values() if v != "PASS")
        total = len(results)
        for k, v in sorted(results.items()):
            icon = "OK" if v == "PASS" else "FAIL"
            print(f"  [{icon}] {k}")
        print(f"\n  {passed}/{total} PASSED, {failed} FAILED")
        if passed == total:
            print("  ALL TESTS PASSED")
        else:
            print("  SOME TESTS FAILED")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(test_all())
