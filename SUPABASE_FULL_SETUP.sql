-- =====================================================
-- SGC Legal AI - ПОЛНАЯ НАСТРОЙКА БАЗЫ ДАННЫХ
-- Выполните этот скрипт в Supabase SQL Editor
-- если база данных была сброшена или данные пропали
-- =====================================================

-- =====================================================
-- ЧАСТЬ 1: БАЗОВЫЕ ТАБЛИЦЫ (из schema.sql)
-- =====================================================

-- 1. Invite codes table
CREATE TABLE IF NOT EXISTS invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    uses_remaining INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_code_id UUID REFERENCES invite_codes(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Saved responses table
CREATE TABLE IF NOT EXISTS saved_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ЧАСТЬ 2: МИГРАЦИИ (из SUPABASE_MIGRATION.sql)
-- =====================================================

-- 6. Добавить колонку description в invite_codes (если не существует)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'invite_codes' AND column_name = 'description') THEN
        ALTER TABLE invite_codes ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column to invite_codes';
    END IF;
END $$;

-- 7. Добавить колонку last_used_at в invite_codes (если не существует)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'invite_codes' AND column_name = 'last_used_at') THEN
        ALTER TABLE invite_codes ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added last_used_at column to invite_codes';
    END IF;
END $$;

-- 8. Создать таблицу usage_stats для статистики использования
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

-- =====================================================
-- ЧАСТЬ 3: ИНДЕКСЫ
-- =====================================================

-- Базовые индексы
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_responses_user_id ON saved_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

-- Индексы для usage_stats
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_id ON usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_created_at ON usage_stats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_stats_model ON usage_stats(model);
CREATE INDEX IF NOT EXISTS idx_usage_stats_request_type ON usage_stats(request_type);

-- =====================================================
-- ЧАСТЬ 4: RLS ПОЛИТИКИ
-- =====================================================

-- Включить RLS для всех таблиц
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- Удалить старые политики (если существуют)
DROP POLICY IF EXISTS "Service role full access" ON invite_codes;
DROP POLICY IF EXISTS "Service role full access" ON users;
DROP POLICY IF EXISTS "Service role full access" ON sessions;
DROP POLICY IF EXISTS "Service role full access" ON chat_messages;
DROP POLICY IF EXISTS "Service role full access" ON saved_responses;
DROP POLICY IF EXISTS "Service role full access for usage_stats" ON usage_stats;

-- Создать политики для service role
CREATE POLICY "Service role full access" ON invite_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON saved_responses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access for usage_stats" ON usage_stats FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- ЧАСТЬ 5: ПРОВЕРКА
-- =====================================================

SELECT 'Настройка завершена!' as status;

-- Проверить что все таблицы созданы
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as columns_count
FROM information_schema.tables tables
WHERE table_schema = 'public'
AND table_name IN ('invite_codes', 'users', 'sessions', 'chat_messages', 'saved_responses', 'usage_stats')
ORDER BY table_name;

-- Проверить структуру invite_codes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'invite_codes'
ORDER BY ordinal_position;
