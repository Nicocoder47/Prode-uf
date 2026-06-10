-- =============================================================================
-- ProdeMundial 2026 — Admin V3 + Beta 300 Security (SQL consolidado producción)
-- =============================================================================
-- Consolida (en orden lógico):
--   20240123000000_beta_capacity_snapshots.sql
--   20240124000000_beta_300_device_reports.sql
--   20240125000000_admin_v3_beta_300_security.sql
--   20240125000001_save_prediction_password_guard.sql
--
-- Ejecutar UNA sola vez en Supabase Dashboard → SQL Editor (rol postgres).
-- Idempotente. Sin DROP TABLE / TRUNCATE / DELETE masivo.
-- =============================================================================

BEGIN;

-- =============================================================================
-- A) TABLAS
-- =============================================================================

-- A.1 system_capacity_snapshots (230)
CREATE TABLE IF NOT EXISTS public.system_capacity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  total_users int NOT NULL DEFAULT 0,
  new_users_today int NOT NULL DEFAULT 0,
  new_users_7d int NOT NULL DEFAULT 0,
  new_users_30d int NOT NULL DEFAULT 0,
  active_users_today int NOT NULL DEFAULT 0,
  active_users_7d int NOT NULL DEFAULT 0,
  total_predictions int NOT NULL DEFAULT 0,
  predictions_today int NOT NULL DEFAULT 0,
  predictions_7d int NOT NULL DEFAULT 0,
  users_with_predictions int NOT NULL DEFAULT 0,
  estimated_concurrent_peak int NOT NULL DEFAULT 0,
  capacity_status text NOT NULL DEFAULT 'green',
  migration_recommendation text NOT NULL DEFAULT 'stay_free',
  notes text,
  raw_payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_capacity_snapshots_created_at
  ON public.system_capacity_snapshots (created_at DESC);

ALTER TABLE public.system_capacity_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_capacity_snapshots_admin ON public.system_capacity_snapshots;
CREATE POLICY system_capacity_snapshots_admin ON public.system_capacity_snapshots
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- A.2 device_reports (240 / 250)
CREATE TABLE IF NOT EXISTS public.device_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  device_type text NOT NULL CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  browser text,
  os text,
  viewport_width int,
  viewport_height int,
  user_agent text,
  route text,
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'error', 'performance')),
  error_message text,
  performance_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_reports_created_at ON public.device_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_reports_device_type ON public.device_reports (device_type);
CREATE INDEX IF NOT EXISTS idx_device_reports_event_type ON public.device_reports (event_type);
CREATE INDEX IF NOT EXISTS idx_device_reports_route ON public.device_reports (route);
CREATE INDEX IF NOT EXISTS idx_device_reports_user_id ON public.device_reports (user_id);

ALTER TABLE public.device_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_reports_insert ON public.device_reports;
CREATE POLICY device_reports_insert ON public.device_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS device_reports_admin_select ON public.device_reports;
CREATE POLICY device_reports_admin_select ON public.device_reports
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- A.3 admin_settings (250)
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_settings_admin ON public.admin_settings;
CREATE POLICY admin_settings_admin ON public.admin_settings
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.admin_settings (key, value)
VALUES ('registration_open', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- B) COLUMNAS profiles (idempotente)
-- Nota: deleted_reason ya existe desde migración 150 (equivale a deletion_reason del spec)
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS block_reason text;

-- Usuarios existentes: no forzar cambio de contraseña retroactivo
UPDATE public.profiles
SET must_change_password = false,
    password_changed_at = coalesce(password_changed_at, created_at, now())
WHERE password_changed_at IS NULL
  AND created_at < now() - interval '1 minute';

-- =============================================================================
-- E) HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_registration_open()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT (value->>'enabled')::boolean FROM public.admin_settings WHERE key = 'registration_open'),
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.count_active_admins(p_exclude uuid DEFAULT NULL)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.profiles
  WHERE role = 'admin'
    AND deleted_at IS NULL
    AND is_active = true
    AND (p_exclude IS NULL OR id <> p_exclude);
$$;

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.profiles SET
    must_change_password = false,
    password_changed_at = now(),
    updated_at = now()
  WHERE id = v_uid;

  PERFORM public.insert_activity_log(
    v_uid, v_uid, 'user_login',
    'Contraseña actualizada',
    'Usuario completó cambio obligatorio de contraseña',
    jsonb_build_object('password_changed', true)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- =============================================================================
-- validate_registration — lógica migr. 200 (anti-enumeración) + cierre invitaciones
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_registration(
  p_email text,
  p_dni text,
  p_legajo text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dni text;
  v_legajo text;
  v_email text;
  v_conflict uuid;
  v_is_anon boolean;
BEGIN
  IF NOT public.is_registration_open() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'registration_closed',
      'message', 'Las invitaciones están cerradas temporalmente. Contactá al administrador.'
    );
  END IF;

  v_is_anon := auth.uid() IS NULL;
  v_email := lower(trim(coalesce(p_email, '')));
  v_dni := public.normalize_dni(p_dni);
  v_legajo := public.normalize_legajo(p_legajo);

  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_email');
  END IF;

  IF v_dni = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'dni_required');
  END IF;

  IF length(v_dni) < 7 OR length(v_dni) > 8 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_dni');
  END IF;

  IF v_legajo = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'legajo_required');
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_dni(dni) = v_dni
    AND lower(trim(email)) <> v_email
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    IF v_is_anon THEN
      RETURN jsonb_build_object('ok', false, 'code', 'registration_conflict');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'dni_taken');
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_legajo(legajo) = v_legajo
    AND lower(trim(email)) <> v_email
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    IF v_is_anon THEN
      RETURN jsonb_build_object('ok', false, 'code', 'registration_conflict');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'legajo_taken');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- =============================================================================
-- F) RPC ADMIN
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_registration_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object('enabled', public.is_registration_open());
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_registration_status(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.admin_settings (key, value, updated_by, updated_at)
  VALUES ('registration_open', jsonb_build_object('enabled', p_enabled), v_actor, now())
  ON CONFLICT (key) DO UPDATE SET
    value = jsonb_build_object('enabled', p_enabled),
    updated_by = v_actor,
    updated_at = now();

  PERFORM public.insert_activity_log(
    NULL, v_actor,
    CASE WHEN p_enabled THEN 'user_registered' ELSE 'user_blocked' END,
    CASE WHEN p_enabled THEN 'Invitaciones abiertas' ELSE 'Invitaciones cerradas' END,
    NULL,
    jsonb_build_object('registration_open', p_enabled)
  );

  RETURN jsonb_build_object('ok', true, 'enabled', p_enabled);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_soft_delete_user(p_user_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  IF p_user_id = v_actor THEN RAISE EXCEPTION 'cannot_delete_self'; END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  IF v_target.role = 'admin' AND public.count_active_admins(p_user_id) < 1 THEN
    RAISE EXCEPTION 'cannot_delete_last_admin';
  END IF;

  UPDATE public.profiles SET
    is_active = false,
    is_blocked = true,
    deleted_at = now(),
    deleted_by = v_actor,
    deleted_reason = nullif(trim(coalesce(p_reason, '')), ''),
    blocked_at = now(),
    blocked_by = v_actor,
    block_reason = coalesce(nullif(trim(p_reason), ''), 'Desactivado por admin'),
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'user_deleted',
    'Usuario desactivado',
    coalesce(nullif(trim(p_reason), ''), 'Sin motivo'),
    jsonb_build_object('legajo', v_target.legajo, 'soft_delete', true)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_block_user(p_user_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user_id = v_actor THEN RAISE EXCEPTION 'cannot_block_self'; END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  IF v_target.role = 'admin' AND public.count_active_admins(p_user_id) < 1 THEN
    RAISE EXCEPTION 'cannot_block_last_admin';
  END IF;

  UPDATE public.profiles SET
    is_active = false,
    is_blocked = true,
    blocked_at = now(),
    blocked_by = v_actor,
    block_reason = nullif(trim(coalesce(p_reason, '')), ''),
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'user_blocked',
    'Usuario bloqueado',
    p_reason,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unblock_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.profiles SET
    is_active = true,
    is_blocked = false,
    blocked_at = NULL,
    blocked_by = NULL,
    block_reason = NULL,
    updated_at = now()
  WHERE id = p_user_id AND deleted_at IS NULL;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'user_unblocked',
    'Usuario desbloqueado',
    NULL,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_force_password_change(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;

  UPDATE public.profiles
  SET must_change_password = true, updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'admin_role_changed',
    'Cambio de contraseña forzado',
    NULL,
    jsonb_build_object('must_change_password', true)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old_role text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF p_user_id = v_actor AND p_role <> 'admin' THEN RAISE EXCEPTION 'cannot_demote_self'; END IF;

  SELECT role INTO v_old_role FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  IF v_old_role = 'admin' AND p_role <> 'admin' AND public.count_active_admins(p_user_id) < 1 THEN
    RAISE EXCEPTION 'cannot_remove_last_admin';
  END IF;

  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = p_user_id;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'admin_role_changed',
    'Rol actualizado',
    v_old_role || ' → ' || p_role,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_role)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(p_user_id uuid, p_new_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_set_user_role(p_user_id, p_new_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_notification_active(p_notification_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.notifications
  SET is_active = p_active, updated_at = now()
  WHERE id = p_notification_id;

  PERFORM public.insert_activity_log(
    NULL, v_actor, 'notification_created',
    CASE WHEN p_active THEN 'Notificación reactivada' ELSE 'Notificación desactivada' END,
    p_notification_id::text,
    jsonb_build_object('notification_id', p_notification_id, 'is_active', p_active)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(row_to_json(u) ORDER BY
      CASE WHEN u.review_status = 'review_required' THEN 0 ELSE 1 END,
      u.created_at DESC
    ), '[]'::jsonb)
    FROM (
      SELECT
        p.id,
        p.legajo,
        p.full_name,
        public.mask_dni(p.dni) AS dni_masked,
        p.email,
        p.role,
        p.is_active,
        p.deleted_at,
        p.deleted_reason,
        p.created_at,
        p.last_login_at,
        p.review_status,
        p.review_reason,
        p.reviewed_at,
        coalesce(p.must_change_password, false) AS must_change_password,
        p.password_changed_at,
        coalesce(p.is_blocked, false) AS is_blocked,
        p.block_reason,
        (EXISTS (
          SELECT 1 FROM public.activity_logs al
          WHERE al.user_id = p.id AND al.created_at >= now() - interval '7 days'
        )) AS active_last_7d,
        mr.last_name AS reference_last_name,
        mr.first_name AS reference_first_name,
        mr.full_name AS reference_full_name,
        (SELECT count(*)::int FROM public.predictions pr WHERE pr.user_id = p.id) AS predictions_count,
        (SELECT count(*)::int FROM public.predictions pr WHERE pr.user_id = p.id AND pr.status = 'scored' AND pr.points >= 5) AS exact_predictions,
        (SELECT count(*)::int FROM public.predictions pr WHERE pr.user_id = p.id AND pr.status = 'scored' AND pr.points > 0) AS hit_predictions,
        coalesce((SELECT lb.points FROM public.leaderboard lb WHERE lb.user_id = p.id AND lb.period = 'global' LIMIT 1), 0) AS total_points
      FROM public.profiles p
      LEFT JOIN public.member_reference mr ON public.normalize_dni(mr.dni) = public.normalize_dni(p.dni)
    ) u
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_beta_capacity()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registered int;
  v_new_today int;
  v_new_7d int;
  v_new_30d int;
  v_active_24h int;
  v_active_7d int;
  v_total_preds int;
  v_pred_24h int;
  v_pred_7d int;
  v_users_with_pred int;
  v_sync_errors int;
  v_last_sync jsonb;
  v_estimated int;
  v_capacity_pct numeric;
  v_status text;
  v_recommendation text;
  v_migration_needed boolean;
  v_reasons jsonb := '[]'::jsonb;
  v_device_health jsonb;
  v_reports_24h int;
  v_errors_24h int;
  v_error_rate numeric;
  v_read_p95 numeric;
  v_save_p95 numeric;
  v_auth_429 int;
  v_reg_open boolean;
  v_must_change int;
  v_blocked int;
  v_deactivated int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_reg_open := public.is_registration_open();

  SELECT count(*) INTO v_registered FROM public.profiles WHERE deleted_at IS NULL;
  SELECT count(*) INTO v_new_today FROM public.profiles WHERE deleted_at IS NULL AND created_at >= date_trunc('day', now());
  SELECT count(*) INTO v_new_7d FROM public.profiles WHERE deleted_at IS NULL AND created_at >= now() - interval '7 days';
  SELECT count(*) INTO v_new_30d FROM public.profiles WHERE deleted_at IS NULL AND created_at >= now() - interval '30 days';
  SELECT count(DISTINCT user_id) INTO v_active_24h FROM public.activity_logs WHERE user_id IS NOT NULL AND created_at >= now() - interval '24 hours';
  SELECT count(DISTINCT user_id) INTO v_active_7d FROM public.activity_logs WHERE user_id IS NOT NULL AND created_at >= now() - interval '7 days';
  SELECT count(*) INTO v_total_preds FROM public.predictions;
  SELECT count(*) INTO v_pred_24h FROM public.predictions WHERE created_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_pred_7d FROM public.predictions WHERE created_at >= now() - interval '7 days';
  SELECT count(DISTINCT user_id) INTO v_users_with_pred FROM public.predictions;
  SELECT count(*) INTO v_sync_errors FROM public.data_sync_logs WHERE status IN ('failed', 'error') AND started_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_must_change FROM public.profiles WHERE deleted_at IS NULL AND must_change_password = true;
  SELECT count(*) INTO v_blocked FROM public.profiles WHERE deleted_at IS NULL AND is_blocked = true;
  SELECT count(*) INTO v_deactivated FROM public.profiles WHERE deleted_at IS NOT NULL;

  SELECT to_jsonb(s) INTO v_last_sync FROM (
    SELECT id, provider, sync_type, status, error_message, started_at, finished_at
    FROM public.data_sync_logs ORDER BY started_at DESC LIMIT 1
  ) s;

  v_estimated := greatest(
    round(v_active_24h * 0.4)::int,
    round(v_active_7d * 0.35)::int,
    round(v_registered * 0.12)::int,
    5
  );
  v_capacity_pct := least(100, round((v_registered::numeric / 300) * 1000) / 10);

  IF v_registered > 300 THEN
    v_status := 'exceeded';
    v_recommendation := 'Excede beta 300. No permitir nuevos registros.';
    v_migration_needed := true;
    v_reasons := v_reasons || jsonb_build_array('Usuarios superan límite 300');
  ELSIF v_registered >= 280 THEN
    v_status := 'red';
    v_recommendation := 'Crítico: cerrar invitaciones y preparar migración.';
    v_migration_needed := true;
    v_reasons := v_reasons || jsonb_build_array('Zona crítica ≥ 280 usuarios');
  ELSIF v_registered >= 220 THEN
    v_status := 'yellow';
    v_recommendation := 'Atención: acercándose al límite de beta 300.';
    v_migration_needed := false;
    v_reasons := v_reasons || jsonb_build_array('≥ 220 usuarios registrados');
  ELSE
    v_status := 'green';
    v_recommendation := 'Beta saludable. Puede seguir gratis.';
    v_migration_needed := false;
    v_reasons := v_reasons || jsonb_build_array('Capacidad dentro de beta 300');
  END IF;

  IF NOT v_reg_open THEN
    v_reasons := v_reasons || jsonb_build_array('Invitaciones cerradas manualmente');
  END IF;

  IF v_estimated >= 120 THEN
    v_reasons := v_reasons || jsonb_build_array('Concurrentes estimados ≥ 120');
    IF v_status = 'green' THEN v_status := 'yellow'; END IF;
  ELSIF v_estimated >= 80 AND v_status = 'green' THEN
    v_reasons := v_reasons || jsonb_build_array('Concurrentes estimados ≥ 80');
  END IF;

  IF v_sync_errors > 0 THEN
    v_reasons := v_reasons || jsonb_build_array('Errores sync en 24h: ' || v_sync_errors);
    IF v_status = 'green' THEN v_status := 'yellow'; END IF;
  END IF;

  SELECT count(*) INTO v_reports_24h FROM public.device_reports WHERE created_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_errors_24h FROM public.device_reports WHERE event_type = 'error' AND created_at >= now() - interval '24 hours';
  v_error_rate := CASE WHEN v_reports_24h > 0
    THEN round((v_errors_24h::numeric / v_reports_24h) * 1000) / 10 ELSE 0 END;

  SELECT count(*) INTO v_auth_429 FROM public.device_reports
  WHERE event_type = 'error' AND created_at >= now() - interval '24 hours'
    AND (error_message ILIKE '%429%' OR error_message ILIKE '%rate limit%');

  IF v_auth_429 > 0 THEN
    v_reasons := v_reasons || jsonb_build_array('Errores Auth 429: ' || v_auth_429);
    IF v_status IN ('green', 'yellow') THEN v_status := 'red'; END IF;
    v_migration_needed := true;
    v_recommendation := 'Errores de autenticación. Revisar límites y preparar migración.';
  END IF;

  SELECT (raw_payload->'load_reports'->'read_api'->>'p95')::numeric INTO v_read_p95
  FROM public.system_capacity_snapshots ORDER BY created_at DESC LIMIT 1;
  SELECT (raw_payload->'load_reports'->'save_prediction'->>'p95')::numeric INTO v_save_p95
  FROM public.system_capacity_snapshots ORDER BY created_at DESC LIMIT 1;

  v_device_health := jsonb_build_object(
    'reports_24h', v_reports_24h,
    'errors_24h', v_errors_24h,
    'error_rate', v_error_rate,
    'errors_by_device', (
      SELECT coalesce(jsonb_object_agg(device_type, cnt), '{}'::jsonb)
      FROM (
        SELECT device_type, count(*)::int AS cnt
        FROM public.device_reports
        WHERE event_type = 'error' AND created_at >= now() - interval '24 hours'
        GROUP BY device_type
      ) d
    ),
    'errors_by_browser', (
      SELECT coalesce(jsonb_object_agg(browser, cnt), '{}'::jsonb)
      FROM (
        SELECT coalesce(browser, 'unknown') AS browser, count(*)::int AS cnt
        FROM public.device_reports
        WHERE event_type = 'error' AND created_at >= now() - interval '24 hours'
        GROUP BY browser
      ) b
    ),
    'slow_routes', (
      SELECT coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
      FROM (
        SELECT route, round(avg(performance_ms))::int AS avg_ms
        FROM public.device_reports
        WHERE event_type = 'performance'
          AND performance_ms IS NOT NULL
          AND created_at >= now() - interval '24 hours'
        GROUP BY route
        ORDER BY avg(performance_ms) DESC
        LIMIT 5
      ) s
    ),
    'top_error_routes', (
      SELECT coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
      FROM (
        SELECT route, count(*)::int AS count
        FROM public.device_reports
        WHERE event_type = 'error' AND created_at >= now() - interval '24 hours'
        GROUP BY route
        ORDER BY count(*) DESC
        LIMIT 5
      ) s
    ),
    'mobile_error_share_pct', (
      SELECT CASE WHEN v_errors_24h > 0 THEN
        round((
          (SELECT count(*)::numeric FROM public.device_reports
           WHERE event_type = 'error' AND device_type = 'mobile'
             AND created_at >= now() - interval '24 hours') / v_errors_24h
        ) * 1000) / 10
      ELSE 0 END
    )
  );

  RETURN jsonb_build_object(
    'registered_users', v_registered,
    'new_users_today', v_new_today,
    'new_users_7d', v_new_7d,
    'new_users_30d', v_new_30d,
    'active_users_24h', v_active_24h,
    'active_users_7d', v_active_7d,
    'total_predictions', v_total_preds,
    'predictions_24h', v_pred_24h,
    'predictions_7d', v_pred_7d,
    'users_with_predictions', v_users_with_pred,
    'users_played_pct', CASE WHEN v_registered > 0
      THEN round((v_users_with_pred::numeric / v_registered) * 100, 1) ELSE 0 END,
    'estimated_concurrent_users', v_estimated,
    'capacity_percent', v_capacity_pct,
    'status', v_status,
    'recommendation', v_recommendation,
    'technical_action', CASE
      WHEN v_status IN ('exceeded', 'red') OR v_migration_needed THEN 'cerrar_invitaciones'
      WHEN v_status = 'yellow' THEN 'monitorear'
      ELSE 'seguir_gratis'
    END,
    'registration_open', v_reg_open,
    'migration_needed', v_migration_needed,
    'reasons', v_reasons,
    'recent_sync_errors_24h', v_sync_errors,
    'auth_errors_429_24h', v_auth_429,
    'read_p95_ms', v_read_p95,
    'save_p95_ms', v_save_p95,
    'users_must_change_password', v_must_change,
    'users_blocked', v_blocked,
    'users_deactivated', v_deactivated,
    'device_health', v_device_health,
    'last_sync', v_last_sync,
    'latest_snapshots', (
      SELECT coalesce(jsonb_agg(row_to_json(s) ORDER BY s.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, created_at, total_users, active_users_7d, total_predictions,
               estimated_concurrent_peak, capacity_status, migration_recommendation, notes
        FROM public.system_capacity_snapshots
        ORDER BY created_at DESC LIMIT 10
      ) s
    ),
    'total_users', v_registered,
    'active_users_today', v_active_24h,
    'predictions_today', v_pred_24h
  );
END;
$$;

-- =============================================================================
-- G) save_prediction — patch 250001 sobre base migr. 200 (solo guards nuevos)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_prediction(
  p_match_id uuid,
  p_score_home integer,
  p_score_away integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pred public.predictions%ROWTYPE;
  v_match public.matches%ROWTYPE;
  v_winner text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'match_id_required';
  END IF;

  IF p_score_home IS NULL OR p_score_away IS NULL THEN
    RAISE EXCEPTION 'invalid_scores';
  END IF;

  IF p_score_home < 0 OR p_score_away < 0 OR p_score_home > 99 OR p_score_away > 99 THEN
    RAISE EXCEPTION 'invalid_scores';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND coalesce(p.must_change_password, false) = true
  ) THEN
    RAISE EXCEPTION 'password_change_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.is_active = true
      AND p.deleted_at IS NULL
      AND coalesce(p.is_blocked, false) = false
  ) THEN
    RAISE EXCEPTION 'account_inactive';
  END IF;

  SELECT *
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.status <> 'scheduled' OR COALESCE(v_match.is_locked, false) = true THEN
    RAISE EXCEPTION 'predictions_closed';
  END IF;

  IF v_match.kick_off IS NULL OR v_match.kick_off <= now() THEN
    RAISE EXCEPTION 'predictions_closed';
  END IF;

  SELECT *
  INTO v_pred
  FROM public.predictions
  WHERE user_id = v_uid
    AND match_id = p_match_id;

  IF FOUND AND v_pred.status <> 'pending' THEN
    RAISE EXCEPTION 'prediction_locked';
  END IF;

  v_winner := public.match_result_from_scores(p_score_home, p_score_away);

  IF FOUND THEN
    UPDATE public.predictions
    SET
      predicted_winner = v_winner,
      predicted_score_home = p_score_home,
      predicted_score_away = p_score_away,
      predicted_first_scorer = NULL,
      predicted_mvp = NULL,
      status = 'pending',
      points = 0,
      scored_at = NULL,
      updated_at = now()
    WHERE user_id = v_uid
      AND match_id = p_match_id
      AND status = 'pending'
    RETURNING * INTO v_pred;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'prediction_locked';
    END IF;
  ELSE
    BEGIN
      INSERT INTO public.predictions (
        user_id, match_id, predicted_winner, predicted_score_home, predicted_score_away,
        predicted_first_scorer, predicted_mvp, status, points, updated_at
      )
      VALUES (
        v_uid, p_match_id, v_winner, p_score_home, p_score_away,
        NULL, NULL, 'pending', 0, now()
      )
      RETURNING * INTO v_pred;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT * INTO v_pred FROM public.predictions
        WHERE user_id = v_uid AND match_id = p_match_id FOR UPDATE;

        IF NOT FOUND OR v_pred.status <> 'pending' THEN
          RAISE EXCEPTION 'prediction_locked';
        END IF;

        UPDATE public.predictions
        SET
          predicted_winner = v_winner,
          predicted_score_home = p_score_home,
          predicted_score_away = p_score_away,
          predicted_first_scorer = NULL,
          predicted_mvp = NULL,
          status = 'pending',
          points = 0,
          scored_at = NULL,
          updated_at = now()
        WHERE user_id = v_uid AND match_id = p_match_id AND status = 'pending'
        RETURNING * INTO v_pred;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'prediction_locked';
        END IF;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'prediction', jsonb_build_object(
      'id', v_pred.id,
      'user_id', v_pred.user_id,
      'match_id', v_pred.match_id,
      'predicted_winner', v_pred.predicted_winner,
      'predicted_score_home', v_pred.predicted_score_home,
      'predicted_score_away', v_pred.predicted_score_away,
      'status', v_pred.status,
      'points', v_pred.points,
      'created_at', v_pred.created_at,
      'updated_at', v_pred.updated_at
    )
  );
END;
$$;

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.validate_registration(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_registration_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_registration_status(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_block_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unblock_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_password_change(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_notification_active(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_beta_capacity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_prediction(uuid, integer, integer) TO authenticated;

COMMIT;
