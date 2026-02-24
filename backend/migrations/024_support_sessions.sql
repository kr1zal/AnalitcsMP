-- Migration 024: Support sessions, messages, and CSAT
-- Persistent conversation storage for Telegram bot AI support.
-- Session lifecycle: active -> resolved/escalated -> closed

-- ─── Support sessions ───
CREATE TABLE IF NOT EXISTS tg_support_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'resolved', 'escalated', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    conversation_summary TEXT,
    escalation_reason VARCHAR(100),
    message_count INT DEFAULT 0,
    ai_confidence_avg FLOAT DEFAULT 0.0
);

-- ─── Support messages ───
CREATE TABLE IF NOT EXISTS tg_support_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES tg_support_sessions(session_id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'bot', 'operator')),
    content TEXT NOT NULL,
    confidence FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CSAT ratings ───
CREATE TABLE IF NOT EXISTS tg_support_csat (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES tg_support_sessions(session_id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ───
CREATE INDEX idx_sessions_chat_status ON tg_support_sessions(chat_id, status);
CREATE INDEX idx_sessions_last_message ON tg_support_sessions(last_message_at);
CREATE INDEX idx_sessions_status ON tg_support_sessions(status);
CREATE INDEX idx_messages_session ON tg_support_messages(session_id, created_at);

-- ─── RLS ───
ALTER TABLE tg_support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tg_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tg_support_csat ENABLE ROW LEVEL SECURITY;

-- Service role full access (bot operates via service_role_key)
CREATE POLICY "service_role_sessions" ON tg_support_sessions FOR ALL
    TO service_role USING (true);
CREATE POLICY "service_role_messages" ON tg_support_messages FOR ALL
    TO service_role USING (true);
CREATE POLICY "service_role_csat" ON tg_support_csat FOR ALL
    TO service_role USING (true);
