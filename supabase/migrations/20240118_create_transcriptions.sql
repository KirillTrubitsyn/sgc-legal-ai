-- Create transcriptions table for audio transcription storage
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_code_id UUID NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    duration_seconds REAL DEFAULT 0,
    filename VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries by invite_code_id
CREATE INDEX IF NOT EXISTS idx_transcriptions_invite_code_id ON transcriptions(invite_code_id);

-- Create index for ordering by created_at
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated access (via service role key)
-- This allows the backend to access all transcriptions
CREATE POLICY "Service role can access all transcriptions"
ON transcriptions
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON transcriptions TO authenticated;
GRANT ALL ON transcriptions TO service_role;

COMMENT ON TABLE transcriptions IS 'Stores audio transcription records for each invite code';
COMMENT ON COLUMN transcriptions.invite_code_id IS 'Reference to the invite code owner';
COMMENT ON COLUMN transcriptions.title IS 'User-editable title for the transcription';
COMMENT ON COLUMN transcriptions.text IS 'Full transcription text';
COMMENT ON COLUMN transcriptions.word_count IS 'Word count for display';
COMMENT ON COLUMN transcriptions.duration_seconds IS 'Original audio duration';
COMMENT ON COLUMN transcriptions.filename IS 'Original filename for reference';
