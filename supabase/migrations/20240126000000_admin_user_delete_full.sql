-- Admin: eliminación total segura de usuarios, reset predicciones/puntaje, cleanup test users

-- ---------------------------------------------------------------------------
-- 1. Helper: detectar emails de prueba
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_test_user_email(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    lower(coalesce(trim(p_email), '')) ~ '@loadtest\.prodemundial\.test$'
    OR lower(coalesce(trim(p_email), '')) ~ '@prodemundial\.test$'
    OR lower(coalesce(trim(p_email), '')) ~ '^(e2e-|score-audit-|score-bulk-|loadtest-)'
    OR lower(coalesce(trim(p_email), '')) ~ '(^|[^a-z])(test|demo|fake|loadtest)([^a-z]|@|$)'
$$;

-- ---------------------------------------------------------------------------
-- 2. Tabla de auditoría admin (acciones destructivas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  deleted_user_id uuid,
  deleted_email text,
  reason text,
  affected_tables jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_deleted_user ON public.admin_audit_log (deleted_user_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_log_admin_select ON public.admin_audit_log;
CREATE POLICY admin_audit_log_admin_select ON public.admin_audit_log
  FOR SELECT USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Recalcular ranks globales del leaderboard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_recalculate_leaderboard_ranks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ranked AS (
    SELECT
      user_id,
      ROW_NUMBER() OVER (ORDER BY points DESC, updated_at ASC) AS new_rank
    FROM public.leaderboard
    WHERE period = 'global'
  )
  UPDATE public.leaderboard lb
  SET rank = r.new_rank
  FROM ranked r
  WHERE lb.user_id = r.user_id
    AND lb.period = 'global';
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reset predicciones de un usuario
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_user_predictions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_deleted int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  DELETE FROM public.predictions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'admin_role_changed',
    'Predicciones reseteadas',
    format('%s predicciones eliminadas', v_deleted),
    jsonb_build_object('action', 'reset_predictions', 'deleted', v_deleted)
  );

  RETURN jsonb_build_object('ok', true, 'predictions_deleted', v_deleted);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Reset puntaje / leaderboard de un usuario
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_user_score(p_user_id uuid)
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  UPDATE public.predictions
  SET points = 0, status = 'pending', scored_at = NULL, updated_at = now()
  WHERE user_id = p_user_id AND status = 'scored';

  DELETE FROM public.leaderboard WHERE user_id = p_user_id AND period = 'global';

  PERFORM public.admin_recalculate_leaderboard_ranks();

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'admin_role_changed',
    'Puntaje reseteado',
    'Leaderboard y puntos de predicciones reiniciados',
    jsonb_build_object('action', 'reset_score')
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Eliminación total interna (sin checks de confirmación)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_user_full_internal(
  p_user_id uuid,
  p_reason text,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_affected jsonb := '{}'::jsonb;
  v_cnt int;
  v_email text;
BEGIN
  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  v_email := v_target.email;

  IF v_target.role = 'admin' AND public.count_active_admins(p_user_id) < 1 THEN
    RAISE EXCEPTION 'cannot_delete_last_admin';
  END IF;

  SELECT count(*) INTO v_cnt FROM public.predictions WHERE user_id = p_user_id;
  v_affected := v_affected || jsonb_build_object('predictions', v_cnt);
  DELETE FROM public.predictions WHERE user_id = p_user_id;

  SELECT count(*) INTO v_cnt FROM public.special_predictions WHERE user_id = p_user_id;
  v_affected := v_affected || jsonb_build_object('special_predictions', v_cnt);
  DELETE FROM public.special_predictions WHERE user_id = p_user_id;

  SELECT count(*) INTO v_cnt FROM public.leaderboard WHERE user_id = p_user_id;
  v_affected := v_affected || jsonb_build_object('leaderboard', v_cnt);
  DELETE FROM public.leaderboard WHERE user_id = p_user_id;

  SELECT count(*) INTO v_cnt FROM public.token_transactions WHERE user_id = p_user_id;
  v_affected := v_affected || jsonb_build_object('token_transactions', v_cnt);
  DELETE FROM public.token_transactions WHERE user_id = p_user_id;

  SELECT count(*) INTO v_cnt FROM public.payments WHERE user_id = p_user_id;
  v_affected := v_affected || jsonb_build_object('payments', v_cnt);
  DELETE FROM public.payments WHERE user_id = p_user_id;

  SELECT count(*) INTO v_cnt FROM public.notification_reads WHERE user_id = p_user_id;
  v_affected := v_affected || jsonb_build_object('notification_reads', v_cnt);
  DELETE FROM public.notification_reads WHERE user_id = p_user_id;

  SELECT count(*) INTO v_cnt FROM public.user_support_tickets WHERE user_id = p_user_id;
  v_affected := v_affected || jsonb_build_object('user_support_tickets', v_cnt);
  DELETE FROM public.user_support_tickets WHERE user_id = p_user_id;

  SELECT count(*) INTO v_cnt FROM public.user_roles WHERE profile_id = p_user_id;
  v_affected := v_affected || jsonb_build_object('user_roles', v_cnt);
  DELETE FROM public.user_roles WHERE profile_id = p_user_id;

  SELECT count(*) INTO v_cnt FROM public.device_reports WHERE user_id = p_user_id;
  v_affected := v_affected || jsonb_build_object('device_reports', v_cnt);
  DELETE FROM public.device_reports WHERE user_id = p_user_id;

  SELECT count(*) INTO v_cnt FROM public.activity_logs WHERE user_id = p_user_id;
  v_affected := v_affected || jsonb_build_object('activity_logs_user', v_cnt);
  DELETE FROM public.activity_logs WHERE user_id = p_user_id;

  UPDATE public.invitations SET used_by = NULL WHERE used_by = p_user_id;
  UPDATE public.invitations SET issued_by = NULL WHERE issued_by = p_user_id;
  UPDATE public.notifications SET target_user_id = NULL WHERE target_user_id = p_user_id;
  UPDATE public.notifications SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE public.profiles SET deleted_by = NULL WHERE deleted_by = p_user_id;
  UPDATE public.profiles SET blocked_by = NULL WHERE blocked_by = p_user_id;
  UPDATE public.profiles SET reviewed_by = NULL WHERE reviewed_by = p_user_id;

  DELETE FROM public.profiles WHERE id = p_user_id;
  v_affected := v_affected || jsonb_build_object('profiles', 1);

  DELETE FROM auth.users WHERE id = p_user_id;
  v_affected := v_affected || jsonb_build_object('auth_users', 1);

  PERFORM public.admin_recalculate_leaderboard_ranks();

  INSERT INTO public.admin_audit_log (
    admin_id, action, deleted_user_id, deleted_email, reason, affected_tables, metadata
  ) VALUES (
    p_admin_id,
    'user_hard_delete',
    p_user_id,
    v_email,
    nullif(trim(coalesce(p_reason, '')), ''),
    v_affected,
    jsonb_build_object('freed_slot', true)
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_user_id', p_user_id,
    'deleted_email', v_email,
    'affected_tables', v_affected,
    'freed_slot', true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. admin_delete_user_full — eliminación definitiva con confirmación
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_user_full(
  p_user_id uuid,
  p_reason text,
  p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target public.profiles%ROWTYPE;
  v_is_test boolean;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  v_is_test := public.is_test_user_email(v_target.email);

  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'cannot_delete_self_use_special_flow';
  END IF;

  IF v_target.role = 'admin' THEN
    RAISE EXCEPTION 'cannot_hard_delete_admin';
  END IF;

  IF NOT v_is_test THEN
    IF nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'reason_required';
    END IF;
    IF upper(trim(coalesce(p_confirmation, ''))) <> 'ELIMINAR' THEN
      RAISE EXCEPTION 'confirmation_required';
    END IF;
  ELSE
    IF upper(trim(coalesce(p_confirmation, ''))) NOT IN ('ELIMINAR', 'ELIMINAR_TEST') THEN
      RAISE EXCEPTION 'confirmation_required_test';
    END IF;
  END IF;

  v_result := public.admin_delete_user_full_internal(
    p_user_id,
    coalesce(nullif(trim(p_reason), ''), 'Usuario de prueba eliminado'),
    v_actor
  );

  PERFORM public.insert_activity_log(
    NULL, v_actor, 'user_deleted',
    'Usuario eliminado definitivamente',
    coalesce(nullif(trim(p_reason), ''), 'Sin motivo'),
    jsonb_build_object(
      'deleted_user_id', p_user_id,
      'deleted_email', v_target.email,
      'is_test_user', v_is_test,
      'hard_delete', true
    )
  );

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. admin_delete_test_user — atajo para usuarios de prueba
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_test_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  IF NOT public.is_test_user_email(v_target.email) THEN
    RAISE EXCEPTION 'not_test_user';
  END IF;

  IF v_target.role = 'admin' THEN
    RAISE EXCEPTION 'cannot_delete_admin';
  END IF;

  RETURN public.admin_delete_user_full(
    p_user_id,
    'Eliminación usuario de prueba',
    'ELIMINAR_TEST'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. admin_cleanup_test_users — limpieza masiva
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_cleanup_test_users(p_confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_user record;
  v_deleted jsonb := '[]'::jsonb;
  v_count int := 0;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF upper(trim(coalesce(p_confirmation, ''))) <> 'LIMPIAR_TEST' THEN
    RAISE EXCEPTION 'confirmation_required';
  END IF;

  FOR v_user IN
    SELECT p.id, p.email
    FROM public.profiles p
    WHERE public.is_test_user_email(p.email)
      AND p.role <> 'admin'
      AND p.deleted_at IS NULL
  LOOP
    v_result := public.admin_delete_user_full_internal(
      v_user.id,
      'Limpieza masiva usuarios de prueba',
      v_actor
    );
    v_deleted := v_deleted || jsonb_build_array(v_result);
    v_count := v_count + 1;
  END LOOP;

  PERFORM public.insert_activity_log(
    NULL, v_actor, 'user_deleted',
    'Limpieza masiva usuarios de prueba',
    format('%s usuarios eliminados', v_count),
    jsonb_build_object('bulk_test_cleanup', true, 'count', v_count)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_count', v_count,
    'deleted_users', v_deleted
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. admin_count_test_users — preview antes de limpiar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_count_test_users()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN (
    SELECT jsonb_build_object(
      'count', count(*)::int,
      'users', coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'email', p.email, 'full_name', p.full_name) ORDER BY p.created_at DESC), '[]'::jsonb)
    )
    FROM public.profiles p
    WHERE public.is_test_user_email(p.email)
      AND p.role <> 'admin'
      AND p.deleted_at IS NULL
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. admin_get_beta_overview — KPIs simples para dashboard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_beta_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registered int;
  v_max int := 300;
  v_new_today int;
  v_without_pred int;
  v_with_pred int;
  v_blocked int;
  v_test int;
  v_reg_open boolean;
  v_last_score timestamptz;
  v_last_scored_match jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_reg_open := public.is_registration_open();

  SELECT count(*) INTO v_registered FROM public.profiles WHERE deleted_at IS NULL;
  SELECT count(*) INTO v_new_today FROM public.profiles WHERE deleted_at IS NULL AND created_at >= date_trunc('day', now());
  SELECT count(*) INTO v_blocked FROM public.profiles WHERE deleted_at IS NULL AND (is_blocked = true OR is_active = false);
  SELECT count(*) INTO v_test FROM public.profiles WHERE deleted_at IS NULL AND public.is_test_user_email(email);
  SELECT count(*) INTO v_with_pred FROM (SELECT DISTINCT user_id FROM public.predictions) s;
  v_without_pred := greatest(0, v_registered - v_with_pred);

  SELECT max(created_at) INTO v_last_score
  FROM public.activity_logs
  WHERE type = 'score_calculated';

  SELECT to_jsonb(m) INTO v_last_scored_match
  FROM (
    SELECT id, score_home, score_away, scored_at, kick_off
    FROM public.matches
    WHERE scored_at IS NOT NULL
    ORDER BY scored_at DESC
    LIMIT 1
  ) m;

  RETURN jsonb_build_object(
    'max_users', v_max,
    'registered_users', v_registered,
    'available_slots', greatest(0, v_max - v_registered),
    'capacity_percent', round((v_registered::numeric / v_max) * 1000) / 10,
    'new_users_today', v_new_today,
    'users_without_predictions', v_without_pred,
    'users_with_predictions', v_with_pred,
    'users_blocked', v_blocked,
    'test_users_detected', v_test,
    'registration_open', v_reg_open,
    'last_score_calculated_at', v_last_score,
    'last_scored_match', v_last_scored_match
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 12. admin_get_users — agregar is_test_user
-- ---------------------------------------------------------------------------
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
        p.id, p.legajo, p.full_name,
        public.mask_dni(p.dni) AS dni_masked,
        p.email, p.role, p.is_active, p.deleted_at, p.deleted_reason,
        p.created_at, p.last_login_at,
        p.review_status, p.review_reason, p.reviewed_at,
        coalesce(p.must_change_password, false) AS must_change_password,
        p.password_changed_at,
        coalesce(p.is_blocked, false) AS is_blocked,
        p.block_reason,
        public.is_test_user_email(p.email) AS is_test_user,
        (p.last_login_at IS NULL) AS never_logged_in,
        (p.created_at >= date_trunc('day', now())) AS registered_today,
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

-- ---------------------------------------------------------------------------
-- 13. Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_reset_user_predictions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_full(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_test_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_test_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_count_test_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_beta_overview() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_delete_user_full_internal(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_recalculate_leaderboard_ranks() FROM PUBLIC;
