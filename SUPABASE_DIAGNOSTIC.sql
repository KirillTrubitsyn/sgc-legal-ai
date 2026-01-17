-- =====================================================
-- SGC Legal AI - Диагностический скрипт
-- Выполните этот скрипт в Supabase SQL Editor
-- для диагностики проблем с данными
-- =====================================================

-- 1. Проверка существования таблиц
SELECT '=== ПРОВЕРКА ТАБЛИЦ ===' as info;

SELECT table_name,
       CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('invite_codes', 'users', 'sessions', 'chat_messages', 'saved_responses', 'usage_stats')
ORDER BY table_name;

-- 2. Проверка структуры invite_codes
SELECT '=== СТРУКТУРА invite_codes ===' as info;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invite_codes'
ORDER BY ordinal_position;

-- 3. Проверка наличия колонок description и last_used_at
SELECT '=== ПРОВЕРКА НОВЫХ КОЛОНОК ===' as info;

SELECT
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'description'
    ) THEN 'description EXISTS' ELSE 'description MISSING' END as description_status,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invite_codes' AND column_name = 'last_used_at'
    ) THEN 'last_used_at EXISTS' ELSE 'last_used_at MISSING' END as last_used_at_status,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'usage_stats'
    ) THEN 'usage_stats EXISTS' ELSE 'usage_stats MISSING' END as usage_stats_status;

-- 4. Подсчет записей в каждой таблице
SELECT '=== КОЛИЧЕСТВО ЗАПИСЕЙ ===' as info;

SELECT 'invite_codes' as table_name, COUNT(*) as count FROM invite_codes
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL
SELECT 'saved_responses', COUNT(*) FROM saved_responses;

-- 5. Проверка RLS политик
SELECT '=== RLS ПОЛИТИКИ ===' as info;

SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. Показать последние invite_codes (если есть)
SELECT '=== ПОСЛЕДНИЕ INVITE_CODES (если есть) ===' as info;

SELECT id, code, name, uses_remaining, created_at
FROM invite_codes
ORDER BY created_at DESC
LIMIT 5;

-- 7. Проверка usage_stats (если существует)
SELECT '=== ПРОВЕРКА usage_stats ===' as info;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'usage_stats'
    ) THEN
        RAISE NOTICE 'usage_stats table exists';
    ELSE
        RAISE NOTICE 'usage_stats table DOES NOT EXIST - run SUPABASE_MIGRATION.sql';
    END IF;
END $$;

-- 8. Итоговая диагностика
SELECT '=== ИТОГОВАЯ ДИАГНОСТИКА ===' as info;

SELECT
    CASE
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invite_codes')
        THEN 'CRITICAL: Таблица invite_codes не существует. Выполните database/schema.sql'
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invite_codes' AND column_name = 'description')
        THEN 'WARNING: Колонка description отсутствует. Выполните SUPABASE_MIGRATION.sql'
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_stats')
        THEN 'WARNING: Таблица usage_stats не существует. Выполните SUPABASE_MIGRATION.sql'
        WHEN (SELECT COUNT(*) FROM invite_codes) = 0
        THEN 'WARNING: Таблица invite_codes пуста. Данные были удалены или не созданы.'
        ELSE 'OK: Структура базы данных в порядке'
    END as diagnosis;
