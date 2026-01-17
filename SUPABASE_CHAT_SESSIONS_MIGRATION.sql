-- ============================================
-- SGC Legal AI - Chat Sessions Migration
-- Добавление истории чатов с привязкой к инвайт-коду
-- ============================================

-- 1. Создаём таблицу chat_sessions для хранения сессий чатов
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invite_code_id UUID REFERENCES invite_codes(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Новый чат',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Добавляем поле chat_session_id в существующую таблицу chat_messages
-- Это поле nullable, чтобы не ломать существующие данные
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE;

-- 3. Создаём индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_chat_sessions_invite_code_id ON chat_sessions(invite_code_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_session_id ON chat_messages(chat_session_id);

-- 4. Включаем RLS для chat_sessions
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Политика для service role (полный доступ)
DROP POLICY IF EXISTS "Service role full access to chat_sessions" ON chat_sessions;
CREATE POLICY "Service role full access to chat_sessions"
ON chat_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_chat_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Триггер для автоматического обновления updated_at при изменении chat_sessions
DROP TRIGGER IF EXISTS trigger_update_chat_session_updated_at ON chat_sessions;
CREATE TRIGGER trigger_update_chat_session_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_session_updated_at();

-- 8. Триггер для обновления updated_at сессии при добавлении сообщения
CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.chat_session_id IS NOT NULL THEN
        UPDATE chat_sessions
        SET updated_at = NOW()
        WHERE id = NEW.chat_session_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_session_on_message ON chat_messages;
CREATE TRIGGER trigger_update_session_on_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_on_message();

-- ============================================
-- Готово! Теперь таблица chat_sessions создана
-- и chat_messages связана с ней через chat_session_id
-- ============================================
