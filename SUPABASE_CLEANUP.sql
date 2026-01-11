-- =====================================================
-- SGC Legal AI - Cleanup Script
-- Скрипт для ревизии и очистки ненужных таблиц
-- =====================================================

-- 1. Посмотреть ВСЕ таблицы в базе данных
SELECT
    table_name,
    pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =====================================================
-- ИСПОЛЬЗУЕМЫЕ ТАБЛИЦЫ (НЕ УДАЛЯТЬ):
-- - invite_codes (инвайт-коды)
-- - users (пользователи)
-- - sessions (сессии)
-- - chat_messages (история чата)
-- - saved_responses (сохранённые ответы)
-- - usage_stats (статистика - новая)
-- =====================================================

-- 2. Проверить количество записей в каждой таблице
-- (чтобы понять какие таблицы пустые/неиспользуемые)
DO $$
DECLARE
    r RECORD;
    cnt INTEGER;
BEGIN
    RAISE NOTICE '=== Количество записей в таблицах ===';
    FOR r IN SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('SELECT count(*) FROM %I', r.table_name) INTO cnt;
        RAISE NOTICE '%: % записей', r.table_name, cnt;
    END LOOP;
END $$;

-- =====================================================
-- ПОТЕНЦИАЛЬНО НЕНУЖНЫЕ ТАБЛИЦЫ (могут быть от старой конфигурации):
--
-- Если вы видите какие-либо из этих таблиц, их можно удалить:
-- - final_answers
-- - peer_review_records
-- - verified_cases
-- - extracted_case_records
-- - model_response_log
-- - session_prompts
-- - user_session_tokens
-- =====================================================

-- 3. Скрипты для удаления ненужных таблиц
-- ВНИМАНИЕ: Раскомментируйте только те, которые хотите удалить!
-- ОБЯЗАТЕЛЬНО сделайте бэкап перед удалением!

-- DROP TABLE IF EXISTS final_answers CASCADE;
-- DROP TABLE IF EXISTS peer_review_records CASCADE;
-- DROP TABLE IF EXISTS verified_cases CASCADE;
-- DROP TABLE IF EXISTS extracted_case_records CASCADE;
-- DROP TABLE IF EXISTS model_response_log CASCADE;
-- DROP TABLE IF EXISTS session_prompts CASCADE;
-- DROP TABLE IF EXISTS user_session_tokens CASCADE;

-- 4. После очистки - проверить оставшиеся таблицы
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
-- ORDER BY table_name;

-- =====================================================
-- ВАЖНО: Убедитесь что следующие таблицы ОСТАЮТСЯ:
-- ✓ invite_codes
-- ✓ users
-- ✓ sessions
-- ✓ chat_messages
-- ✓ saved_responses
-- ✓ usage_stats
-- =====================================================
