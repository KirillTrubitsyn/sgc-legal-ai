-- Run this in Supabase SQL Editor to add saved_responses table

-- Create saved_responses table
CREATE TABLE IF NOT EXISTS saved_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_responses_user_id ON saved_responses(user_id);

-- Enable RLS
ALTER TABLE saved_responses ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (drop first if exists)
DROP POLICY IF EXISTS "Service role full access" ON saved_responses;
CREATE POLICY "Service role full access" ON saved_responses FOR ALL USING (true) WITH CHECK (true);
