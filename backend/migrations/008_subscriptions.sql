-- 008: Subscription tiers for users
-- One row per user. Admin manages plan changes manually.
-- New users default to 'free' (auto-created by backend on first access).

CREATE TABLE IF NOT EXISTS mp_user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- Plan: 'free', 'pro', 'business'
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),

    -- Status: 'active', 'cancelled', 'expired' (for future payment integration)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),

    -- Dates (for future payment integration)
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,  -- NULL = no expiry (free plan or manual admin)

    -- Audit
    changed_by TEXT,  -- email of admin who changed the plan

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mp_user_subscriptions_user ON mp_user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_user_subscriptions_plan ON mp_user_subscriptions(plan);

-- RLS
ALTER TABLE mp_user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
CREATE POLICY "Users can select own subscription"
    ON mp_user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for regular users.
-- Only backend (service_role_key) can modify subscriptions.

-- Set admin to business plan
INSERT INTO mp_user_subscriptions (user_id, plan, status, changed_by)
VALUES ('17e80396-86e1-4ec8-8cb2-f727462bf20c', 'business', 'active', 'migration')
ON CONFLICT (user_id) DO UPDATE SET plan = 'business', status = 'active', updated_at = now();
