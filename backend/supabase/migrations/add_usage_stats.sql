-- Migration: Add usage_stats table for tracking API usage
-- Similar to -333- project implementation

-- Create usage_stats table
CREATE TABLE IF NOT EXISTS usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL DEFAULT 'Аноним',
    invite_code TEXT,
    model TEXT NOT NULL,
    request_type TEXT NOT NULL DEFAULT 'query',
    response_time_ms INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_id ON usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_created_at ON usage_stats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_stats_model ON usage_stats(model);
CREATE INDEX IF NOT EXISTS idx_usage_stats_request_type ON usage_stats(request_type);

-- Enable RLS
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access for usage_stats" ON usage_stats
    FOR ALL USING (true) WITH CHECK (true);

-- Add last_used_at to invite_codes if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'invite_codes' AND column_name = 'last_used_at') THEN
        ALTER TABLE invite_codes ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
