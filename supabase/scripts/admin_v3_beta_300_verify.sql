-- =============================================================================
-- Verificación post-aplicación — Admin V3 Beta 300
-- Ejecutar DESPUÉS de admin_v3_beta_300_consolidated.sql
-- =============================================================================

-- 1. Tablas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('admin_settings', 'device_reports', 'system_capacity_snapshots')
ORDER BY table_name;

-- 2. Columnas profiles
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
    'must_change_password', 'password_changed_at',
    'deleted_at', 'deleted_by', 'deleted_reason',
    'is_blocked', 'blocked_at', 'blocked_by', 'block_reason'
  )
ORDER BY column_name;

-- 3. Índices device_reports
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'device_reports'
ORDER BY indexname;

-- 4. RLS device_reports
SELECT polname, polcmd, polroles::regrole[]
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'device_reports';

-- 5. RPC existen
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'admin_get_beta_capacity',
    'admin_get_registration_status',
    'admin_set_registration_status',
    'admin_soft_delete_user',
    'admin_block_user',
    'admin_unblock_user',
    'admin_force_password_change',
    'admin_update_user_role',
    'admin_set_user_role',
    'complete_password_change',
    'is_registration_open',
    'save_prediction',
    'validate_registration'
  )
ORDER BY p.proname;

-- 6. Grants authenticated
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND grantee = 'authenticated'
  AND routine_name IN (
    'admin_get_beta_capacity',
    'admin_set_registration_status',
    'admin_force_password_change',
    'admin_soft_delete_user',
    'save_prediction',
    'complete_password_change'
  )
ORDER BY routine_name;

-- 7. registration_open default
SELECT key, value FROM public.admin_settings WHERE key = 'registration_open';

-- 8. Smoke test (ejecutar como admin autenticado vía API o impersonación)
-- SELECT public.admin_get_registration_status();
-- SELECT public.admin_get_beta_capacity();

-- 9. Conteos seguridad
SELECT
  count(*) FILTER (WHERE deleted_at IS NULL) AS usuarios_activos,
  count(*) FILTER (WHERE must_change_password = true AND deleted_at IS NULL) AS deben_cambiar_password,
  count(*) FILTER (WHERE is_blocked = true AND deleted_at IS NULL) AS bloqueados,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS desactivados,
  count(*) FILTER (WHERE role = 'admin' AND deleted_at IS NULL AND is_active = true) AS admins_activos
FROM public.profiles;
