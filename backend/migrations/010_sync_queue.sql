-- Migration 010: Sync Queue for Phase 4
-- Adds mp_sync_queue table for auto-sync scheduling and manual sync daily limits
-- Adds trigger column to mp_sync_log to distinguish auto/manual/admin/system syncs
-- Run in Supabase SQL Editor

-- 1. New table: mp_sync_queue (one row per user)
CREATE TABLE IF NOT EXISTS mp_sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Scheduling
    next_sync_at TIMESTAMPTZ NOT NULL,
    priority INTEGER NOT NULL DEFAULT 2,  -- 0=business, 1=pro, 2=free (lower = higher priority)

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,

    -- Manual sync daily counter (resets at midnight MSK)
    manual_syncs_today INTEGER NOT NULL DEFAULT 0,
    manual_syncs_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Moscow')::date,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT mp_sync_queue_user_unique UNIQUE (user_id)
);

-- Indexes for queue processing: ORDER BY priority ASC, next_sync_at ASC
CREATE INDEX IF NOT EXISTS idx_mp_sync_queue_schedule ON mp_sync_queue(priority, next_sync_at);
CREATE INDEX IF NOT EXISTS idx_mp_sync_queue_status ON mp_sync_queue(status);

-- RLS: users can only read their own queue row (backend uses service_role for writes)
ALTER TABLE mp_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own sync_queue"
    ON mp_sync_queue FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Add trigger column to mp_sync_log
ALTER TABLE mp_sync_log ADD COLUMN IF NOT EXISTS trigger TEXT DEFAULT 'manual';

-- Add check constraint (separate statement for IF NOT EXISTS compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mp_sync_log_trigger_check'
    ) THEN
        ALTER TABLE mp_sync_log ADD CONSTRAINT mp_sync_log_trigger_check
            CHECK (trigger IN ('auto', 'manual', 'admin', 'system'));
    END IF;
END $$;

-- 3. Seed queue row for existing admin user
INSERT INTO mp_sync_queue (user_id, next_sync_at, priority, status)
VALUES (
    '17e80396-86e1-4ec8-8cb2-f727462bf20c',
    (now() AT TIME ZONE 'UTC'),  -- immediate first sync
    0,  -- business priority
    'pending'
)
ON CONFLICT (user_id) DO NOTHING;
