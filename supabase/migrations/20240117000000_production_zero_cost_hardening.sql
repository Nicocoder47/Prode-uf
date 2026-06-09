-- Producción $0: quitar whitelist legajo, cerrar escalada admin 0047, unificar leaderboard.period = global

-- 1. Desactivar código admin universal en producción
CREATE OR REPLACE FUNCTION public.is_valid_universal_admin_code(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false;
$$;

-- 2. validate_registration: solo formato + unicidad (sin allowed_members)
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
BEGIN
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
    RETURN jsonb_build_object('ok', false, 'code', 'dni_taken');
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_legajo(legajo) = v_legajo
    AND lower(trim(email)) <> v_email
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'legajo_taken');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. sync_user_profile: sin allowed_members ni p_admin_code
CREATE OR REPLACE FUNCTION public.sync_user_profile(
  p_full_name text,
  p_dni text,
  p_legajo text,
  p_email text,
  p_admin_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_dni text;
  v_legajo text;
  v_email text;
  v_conflict uuid;
  v_was_complete boolean;
  v_review jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  v_dni := public.normalize_dni(p_dni);
  v_legajo := public.normalize_legajo(p_legajo);

  IF v_email = '' THEN RAISE EXCEPTION 'email_required'; END IF;
  IF trim(coalesce(p_full_name, '')) = '' THEN RAISE EXCEPTION 'full_name_required'; END IF;
  IF v_dni = '' THEN RAISE EXCEPTION 'dni_required'; END IF;
  IF v_legajo = '' THEN RAISE EXCEPTION 'legajo_required'; END IF;

  SELECT (dni IS NOT NULL AND dni <> '' AND legajo IS NOT NULL AND legajo <> '')
  INTO v_was_complete
  FROM public.profiles WHERE id = v_uid;

  SELECT id INTO v_conflict FROM public.profiles
  WHERE public.normalize_dni(dni) = v_dni AND id <> v_uid AND deleted_at IS NULL LIMIT 1;
  IF v_conflict IS NOT NULL THEN RAISE EXCEPTION 'dni_taken'; END IF;

  SELECT id INTO v_conflict FROM public.profiles
  WHERE public.normalize_legajo(legajo) = v_legajo AND id <> v_uid AND deleted_at IS NULL LIMIT 1;
  IF v_conflict IS NOT NULL THEN RAISE EXCEPTION 'legajo_taken'; END IF;

  INSERT INTO public.profiles (id, email, full_name, dni, legajo, role, is_active, token_balance, created_at, updated_at)
  VALUES (v_uid, v_email, trim(p_full_name), v_dni, v_legajo, 'member', true, 0, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    dni = EXCLUDED.dni,
    legajo = EXCLUDED.legajo,
    updated_at = now();

  IF NOT coalesce(v_was_complete, false) THEN
    PERFORM public.insert_activity_log(
      v_uid, v_uid, 'user_registered', 'Registro de usuario',
      trim(p_full_name),
      jsonb_build_object('legajo', v_legajo, 'email', v_email)
    );
  END IF;

  v_review := public.apply_profile_dni_review(v_uid);

  RETURN jsonb_build_object(
    'ok', true, 'role', 'member', 'dni', v_dni, 'legajo', v_legajo,
    'email', v_email, 'full_name', trim(p_full_name),
    'review', v_review
  );
END;
$$;

-- 4. apply_profile_dni_review: solo self, admin o service role
CREATE OR REPLACE FUNCTION public.apply_profile_dni_review(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_ref public.member_reference%ROWTYPE;
  v_dni text;
  v_status text;
  v_reason text;
  v_match text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  v_dni := public.normalize_dni(v_profile.dni);
  IF v_dni = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'dni_missing');
  END IF;

  IF v_profile.review_status IN ('manually_approved', 'rejected') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'review_status', v_profile.review_status,
      'skipped', true
    );
  END IF;

  SELECT * INTO v_ref
  FROM public.member_reference
  WHERE public.normalize_dni(dni) = v_dni
  LIMIT 1;

  IF FOUND THEN
    v_status := 'verified';
    v_reason := 'DNI encontrado en padrón de referencia';
    IF public.normalize_person_name(v_profile.full_name) = public.normalize_person_name(v_ref.full_name)
       OR public.normalize_person_name(v_profile.full_name) = public.build_reference_full_name(v_ref.last_name, v_ref.first_name) THEN
      v_match := 'match';
    ELSE
      v_match := 'name_mismatch';
      v_reason := v_reason || ' · nombre declarado distinto al padrón';
    END IF;
  ELSE
    v_status := 'review_required';
    v_reason := 'DNI no encontrado en padrón de referencia';
    v_match := 'not_in_padron';
  END IF;

  UPDATE public.profiles SET
    review_status = v_status,
    review_reason = v_reason,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'review_status', v_status,
    'review_reason', v_reason,
    'match', v_match
  );
END;
$$;

-- 5. Unificar leaderboard period → global
UPDATE public.leaderboard SET period = 'global' WHERE period = 'overall';

-- 6. admin_set_user_role: log correcto
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
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
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF p_user_id = v_actor AND p_role <> 'admin' THEN RAISE EXCEPTION 'cannot_demote_self'; END IF;

  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = p_user_id;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'admin_role_changed',
    'Rol actualizado a ' || p_role,
    NULL,
    jsonb_build_object('role', p_role)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. admin_get_users enriquecido (period global, sin DNI crudo)
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
        mr.last_name AS reference_last_name,
        mr.first_name AS reference_first_name,
        mr.full_name AS reference_full_name,
        CASE
          WHEN mr.id IS NULL THEN 'No en padrón'
          WHEN public.normalize_person_name(p.full_name) = public.normalize_person_name(mr.full_name)
            OR public.normalize_person_name(p.full_name) = public.build_reference_full_name(mr.last_name, mr.first_name)
            THEN 'Coincide'
          ELSE 'Nombre distinto'
        END AS match_label,
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

-- 8. admin_get_dashboard ampliado
CREATE OR REPLACE FUNCTION public.admin_get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users', (SELECT count(*) FROM public.profiles WHERE is_active = true AND deleted_at IS NULL),
    'blocked_users', (SELECT count(*) FROM public.profiles WHERE is_active = false AND deleted_at IS NULL),
    'deleted_users', (SELECT count(*) FROM public.profiles WHERE deleted_at IS NOT NULL),
    'users_verified', (SELECT count(*) FROM public.profiles WHERE review_status = 'verified'),
    'users_review_required', (SELECT count(*) FROM public.profiles WHERE review_status = 'review_required'),
    'users_manually_approved', (SELECT count(*) FROM public.profiles WHERE review_status = 'manually_approved'),
    'users_rejected', (SELECT count(*) FROM public.profiles WHERE review_status = 'rejected'),
    'total_predictions', (SELECT count(*) FROM public.predictions),
    'users_without_predictions', (
      SELECT count(*) FROM public.profiles p
      WHERE p.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.predictions pr WHERE pr.user_id = p.id)
    ),
    'today_logins', (
      SELECT count(*) FROM public.activity_logs
      WHERE type = 'user_login' AND created_at >= date_trunc('day', now())
    ),
    'today_registrations', (
      SELECT count(*) FROM public.activity_logs
      WHERE type = 'user_registered' AND created_at >= date_trunc('day', now())
    ),
    'scheduled_matches', (SELECT count(*) FROM public.matches WHERE status = 'scheduled'),
    'live_matches', (SELECT count(*) FROM public.matches WHERE status = 'live'),
    'finished_matches', (SELECT count(*) FROM public.matches WHERE status = 'finished'),
    'last_sync', (
      SELECT to_jsonb(s) FROM (
        SELECT id, provider, sync_type, status, records_upserted, error_message, started_at, finished_at
        FROM public.data_sync_logs ORDER BY started_at DESC LIMIT 1
      ) s
    ),
    'top_10_ranking', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT lb.rank, lb.points, lb.wins, lb.draws, lb.losses,
               p.id AS user_id, p.full_name, p.legajo, p.email
        FROM public.leaderboard lb
        JOIN public.profiles p ON p.id = lb.user_id
        WHERE lb.period = 'global'
        ORDER BY lb.rank ASC NULLS LAST, lb.points DESC LIMIT 10
      ) t
    ),
    'upcoming_matches', (
      SELECT coalesce(jsonb_agg(row_to_json(m)), '[]'::jsonb) FROM (
        SELECT id, kick_off, status, home_team_id, away_team_id, phase, group_label
        FROM public.matches
        WHERE status = 'scheduled' AND kick_off >= now()
        ORDER BY kick_off ASC LIMIT 8
      ) m
    ),
    'latest_activity_logs', (
      SELECT coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb) FROM (
        SELECT al.id, al.type, al.title, al.description, al.metadata, al.created_at,
               al.user_id, p.full_name, p.legajo
        FROM public.activity_logs al
        LEFT JOIN public.profiles p ON p.id = al.user_id
        ORDER BY al.created_at DESC LIMIT 20
      ) a
    ),
    'admin_cards', (
      SELECT coalesce(jsonb_agg(row_to_json(c) ORDER BY c.order_index), '[]'::jsonb)
      FROM public.admin_cards c WHERE c.is_active = true
    ),
    'latest_registrations', (
      SELECT coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) FROM (
        SELECT p.id, p.full_name, p.legajo, p.email, p.created_at
        FROM public.profiles p ORDER BY p.created_at DESC LIMIT 10
      ) r
    ),
    'latest_logins', (
      SELECT coalesce(jsonb_agg(row_to_json(l)), '[]'::jsonb) FROM (
        SELECT p.id, p.full_name, p.legajo, p.email, p.last_login_at
        FROM public.profiles p
        WHERE p.last_login_at IS NOT NULL
        ORDER BY p.last_login_at DESC LIMIT 10
      ) l
    ),
    'review_required_users', (
      SELECT coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) FROM (
        SELECT p.id, p.legajo, p.full_name, public.mask_dni(p.dni) AS dni, p.email, p.created_at, p.review_reason,
               mr.full_name AS reference_full_name
        FROM public.profiles p
        LEFT JOIN public.member_reference mr ON public.normalize_dni(mr.dni) = public.normalize_dni(p.dni)
        WHERE p.review_status = 'review_required'
        ORDER BY p.created_at DESC LIMIT 50
      ) r
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 9. Detalle de usuario para panel admin
CREATE OR REPLACE FUNCTION public.admin_get_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user jsonb;
  v_padron jsonb;
  v_predictions jsonb;
  v_activity jsonb;
  v_notifications jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;

  SELECT to_jsonb(u) INTO v_user FROM (
    SELECT
      p.id, p.legajo, p.full_name, public.mask_dni(p.dni) AS dni_masked, p.email, p.role,
      p.is_active, p.deleted_at, p.deleted_reason, p.created_at, p.last_login_at,
      p.review_status, p.review_reason, p.reviewed_at,
      (SELECT count(*)::int FROM public.predictions pr WHERE pr.user_id = p.id) AS predictions_count,
      (SELECT count(*)::int FROM public.predictions pr WHERE pr.user_id = p.id AND pr.status = 'scored' AND pr.points >= 5) AS exact_predictions,
      (SELECT count(*)::int FROM public.predictions pr WHERE pr.user_id = p.id AND pr.status = 'scored' AND pr.points > 0) AS hit_predictions,
      coalesce((SELECT lb.points FROM public.leaderboard lb WHERE lb.user_id = p.id AND lb.period = 'global' LIMIT 1), 0) AS total_points
    FROM public.profiles p WHERE p.id = p_user_id
  ) u;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  SELECT to_jsonb(mr) INTO v_padron FROM public.member_reference mr
  JOIN public.profiles p ON public.normalize_dni(mr.dni) = public.normalize_dni(p.dni)
  WHERE p.id = p_user_id
  LIMIT 1;

  SELECT coalesce(jsonb_agg(row_to_json(pr) ORDER BY pr.created_at DESC), '[]'::jsonb) INTO v_predictions
  FROM (
    SELECT
      pred.id,
      pred.match_id,
      pred.predicted_score_home,
      pred.predicted_score_away,
      pred.points,
      pred.status,
      pred.created_at,
      pred.updated_at,
      m.kick_off,
      m.status AS match_status,
      m.score_home AS result_home,
      m.score_away AS result_away,
      ht.name AS home_team,
      at.name AS away_team
    FROM public.predictions pred
    JOIN public.matches m ON m.id = pred.match_id
    LEFT JOIN public.teams ht ON ht.id = m.home_team_id
    LEFT JOIN public.teams at ON at.id = m.away_team_id
    WHERE pred.user_id = p_user_id
    ORDER BY pred.created_at DESC
    LIMIT 100
  ) pr;

  SELECT coalesce(jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::jsonb) INTO v_activity
  FROM (
    SELECT al.id, al.type, al.title, al.description, al.metadata, al.created_at, al.actor_id
    FROM public.activity_logs al
    WHERE al.user_id = p_user_id OR al.actor_id = p_user_id
    ORDER BY al.created_at DESC
    LIMIT 50
  ) a;

  SELECT coalesce(jsonb_agg(row_to_json(n) ORDER BY n.created_at DESC), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT nt.id, nt.title, nt.message, nt.created_at, nt.expires_at,
           EXISTS (SELECT 1 FROM public.notification_reads nr WHERE nr.notification_id = nt.id AND nr.user_id = p_user_id) AS is_read
    FROM public.notifications nt
    WHERE nt.target_type = 'all'
       OR (nt.target_type = 'user' AND nt.target_user_id = p_user_id)
       OR (nt.target_type = 'role' AND nt.target_role = (SELECT role FROM public.profiles WHERE id = p_user_id))
    ORDER BY nt.created_at DESC
    LIMIT 30
  ) n;

  RETURN jsonb_build_object(
    'user', v_user,
    'padron', v_padron,
    'predictions', v_predictions,
    'activity', v_activity,
    'notifications', v_notifications
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_detail(uuid) TO authenticated;

-- 10. Log de scoring al marcar partido puntuado
CREATE OR REPLACE FUNCTION public.log_match_scored_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.scored_at IS NOT NULL AND (OLD.scored_at IS NULL OR OLD.scored_at IS DISTINCT FROM NEW.scored_at) THEN
    PERFORM public.insert_activity_log(
      NULL, NULL, 'score_calculated',
      'Puntaje calculado para partido',
      NEW.id::text,
      jsonb_build_object('match_id', NEW.id, 'score_home', NEW.score_home, 'score_away', NEW.score_away)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_match_scored ON public.matches;
CREATE TRIGGER trg_log_match_scored
  AFTER UPDATE OF scored_at ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.log_match_scored_activity();
