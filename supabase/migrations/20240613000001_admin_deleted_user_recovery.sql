-- Recuperación de usuarios eliminados por error (audit log + restore)

-- ---------------------------------------------------------------------------
-- 1. Guardar snapshot antes de borrar
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
  v_snapshot jsonb;
BEGIN
  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  v_email := v_target.email;
  v_snapshot := to_jsonb(v_target);

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
    jsonb_build_object(
      'freed_slot', true,
      'profile_snapshot', v_snapshot
    )
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
-- 2. Listar eliminaciones recientes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_deleted_users(p_limit int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.deleted_at DESC), '[]'::jsonb)
    FROM (
      SELECT
        a.id AS audit_id,
        a.deleted_user_id,
        a.deleted_email,
        a.reason,
        a.created_at AS deleted_at,
        a.affected_tables,
        coalesce(a.metadata->'profile_snapshot', 'null'::jsonb) AS profile_snapshot,
        (a.metadata ? 'profile_snapshot') AS has_snapshot,
        a.metadata->>'restored_at' AS restored_at,
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.deleted_user_id) AS profile_exists
      FROM public.admin_audit_log a
      WHERE a.action = 'user_hard_delete'
        AND a.deleted_user_id IS NOT NULL
      ORDER BY a.created_at DESC
      LIMIT greatest(1, least(coalesce(p_limit, 30), 100))
    ) x
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Restaurar usuario eliminado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_restore_deleted_user(
  p_audit_id uuid,
  p_full_name text DEFAULT NULL,
  p_dni text DEFAULT NULL,
  p_legajo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_audit public.admin_audit_log%ROWTYPE;
  v_snapshot jsonb;
  v_user_id uuid;
  v_email text;
  v_full_name text;
  v_dni text;
  v_legajo text;
  v_role text;
  v_review_status text;
  v_review_reason text;
  v_instance_id uuid;
  v_meta jsonb;
  v_padron public.member_reference%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_audit_id IS NULL THEN RAISE EXCEPTION 'audit_id_required'; END IF;

  SELECT * INTO v_audit
  FROM public.admin_audit_log
  WHERE id = p_audit_id AND action = 'user_hard_delete';

  IF NOT FOUND THEN RAISE EXCEPTION 'audit_not_found'; END IF;
  IF coalesce(v_audit.metadata->>'restored_at', '') <> '' THEN RAISE EXCEPTION 'already_restored'; END IF;

  v_user_id := v_audit.deleted_user_id;
  v_email := lower(trim(coalesce(v_audit.deleted_email, '')));
  IF v_user_id IS NULL OR v_email = '' THEN RAISE EXCEPTION 'invalid_audit_record'; END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_user_id) THEN
    RAISE EXCEPTION 'profile_already_exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.email) = v_email) THEN
    RAISE EXCEPTION 'email_already_in_use';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'auth_email_already_in_use';
  END IF;

  v_snapshot := v_audit.metadata->'profile_snapshot';
  IF v_snapshot IS NULL OR v_snapshot = 'null'::jsonb THEN
    v_snapshot := '{}'::jsonb;
  END IF;

  v_full_name := nullif(trim(coalesce(p_full_name, v_snapshot->>'full_name', '')), '');
  v_dni := nullif(public.normalize_dni(coalesce(p_dni, v_snapshot->>'dni', '')), '');
  v_legajo := nullif(public.normalize_legajo(coalesce(p_legajo, v_snapshot->>'legajo', '')), '');
  v_role := coalesce(nullif(v_snapshot->>'role', ''), 'member');
  v_review_status := coalesce(nullif(v_snapshot->>'review_status', ''), 'review_required');
  v_review_reason := coalesce(nullif(v_snapshot->>'review_reason', ''), 'Recuperado por admin');

  IF v_full_name IS NULL AND v_legajo IS NOT NULL THEN
    SELECT * INTO v_padron
    FROM public.member_reference mr
    WHERE public.normalize_legajo(mr.legajo) = v_legajo
    LIMIT 1;
    IF FOUND THEN
      v_full_name := coalesce(v_padron.full_name, trim(coalesce(v_padron.first_name, '') || ' ' || coalesce(v_padron.last_name, '')));
      v_dni := coalesce(v_dni, nullif(public.normalize_dni(v_padron.dni), ''));
    END IF;
  END IF;

  IF v_full_name IS NULL THEN
    v_full_name := split_part(v_email, '@', 1);
  END IF;

  SELECT coalesce(
    (SELECT instance_id FROM auth.users LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) INTO v_instance_id;

  v_meta := jsonb_build_object(
    'full_name', v_full_name,
    'dni', v_dni,
    'legajo', v_legajo
  );

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    is_super_admin
  ) VALUES (
    v_instance_id,
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    v_meta,
    coalesce((v_snapshot->>'created_at')::timestamptz, now()),
    now(),
    '',
    false
  );

  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    now(),
    now(),
    now()
  );

  INSERT INTO public.profiles (
    id, email, full_name, dni, legajo, role,
    is_active, deleted_at, deleted_reason,
    review_status, review_reason, reviewed_at,
    must_change_password, is_blocked,
    created_at, updated_at, last_login_at
  ) VALUES (
    v_user_id,
    v_email,
    v_full_name,
    v_dni,
    v_legajo,
    CASE WHEN v_role = 'admin' THEN 'member' ELSE v_role END,
    true,
    NULL,
    NULL,
    v_review_status,
    v_review_reason,
    NULL,
    true,
    false,
    coalesce((v_snapshot->>'created_at')::timestamptz, now()),
    now(),
    NULLIF(v_snapshot->>'last_login_at', '')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    dni = EXCLUDED.dni,
    legajo = EXCLUDED.legajo,
    role = EXCLUDED.role,
    is_active = true,
    deleted_at = NULL,
    deleted_reason = NULL,
    review_status = EXCLUDED.review_status,
    review_reason = EXCLUDED.review_reason,
    must_change_password = true,
    is_blocked = false,
    updated_at = now();

  UPDATE public.admin_audit_log
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'restored_at', now(),
    'restored_by', v_actor,
    'restored_profile', jsonb_build_object(
      'id', v_user_id,
      'email', v_email,
      'full_name', v_full_name,
      'dni', v_dni,
      'legajo', v_legajo
    )
  )
  WHERE id = p_audit_id;

  PERFORM public.insert_activity_log(
    v_user_id, v_actor, 'user_manually_approved',
    'Usuario recuperado tras eliminación',
    'Restaurado desde audit log',
    jsonb_build_object('audit_id', p_audit_id, 'email', v_email)
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', v_email,
    'full_name', v_full_name,
    'must_change_password', true,
    'note', 'Predicciones y puntaje previos no se recuperan. El usuario debe restablecer contraseña.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_deleted_users(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_deleted_user(uuid, text, text, text) TO authenticated;
