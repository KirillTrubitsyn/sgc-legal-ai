-- =====================================================
-- SGC Legal AI - Migration Script
-- Выполните этот скрипт в Supabase SQL Editor
-- =====================================================

-- 1. Добавить колонку description в invite_codes (если не существует)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'invite_codes' AND column_name = 'description') THEN
        ALTER TABLE invite_codes ADD COLUMN description TEXT;
    END IF;
END $$;

-- 2. Добавить колонку last_used_at в invite_codes (если не существует)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'invite_codes' AND column_name = 'last_used_at') THEN
        ALTER TABLE invite_codes ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 3. Создать таблицу usage_stats для статистики использования
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

-- 4. Создать индексы для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_id ON usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_created_at ON usage_stats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_stats_model ON usage_stats(model);
CREATE INDEX IF NOT EXISTS idx_usage_stats_request_type ON usage_stats(request_type);

-- 5. Включить RLS для usage_stats
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- 6. Политика доступа для service role
DROP POLICY IF EXISTS "Service role full access for usage_stats" ON usage_stats;
CREATE POLICY "Service role full access for usage_stats" ON usage_stats
    FOR ALL USING (true) WITH CHECK (true);

-- 7. Проверка что всё создано
SELECT 'Миграция выполнена успешно!' as status;

-- Проверить структуру таблиц:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invite_codes';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usage_stats';
