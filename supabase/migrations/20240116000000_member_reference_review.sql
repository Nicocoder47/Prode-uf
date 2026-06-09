-- Padrón de referencia por DNI + revisión de usuarios en panel admin

-- 1. Tabla member_reference
CREATE TABLE IF NOT EXISTS public.member_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dni text NOT NULL,
  last_name text,
  first_name text,
  full_name text,
  source text NOT NULL DEFAULT 'excel_import',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_reference_dni_unique
  ON public.member_reference (public.normalize_dni(dni));

-- 2. Columnas de revisión en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_review_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_review_status_check
  CHECK (review_status IN ('pending', 'verified', 'review_required', 'manually_approved', 'rejected'));

-- Normalizar nombre para comparación
CREATE OR REPLACE FUNCTION public.normalize_person_name(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(
    regexp_replace(
      trim(
        translate(
          coalesce(raw, ''),
          'áéíóúÁÉÍÓÚñÑ',
          'aeiouAEIOUnN'
        )
      ),
      '[,\s]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.build_reference_full_name(p_last_name text, p_first_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.normalize_person_name(
    trim(coalesce(p_last_name, '')) || ', ' || trim(coalesce(p_first_name, ''))
  );
$$;

-- Aplicar estado de revisión según padrón DNI
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

-- Integrar en sync_user_profile
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
  v_role text := 'member';
  v_member jsonb;
  v_was_complete boolean;
  v_review jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  v_dni := public.normalize_dni(p_dni);
  v_legajo := public.normalize_legajo(p_legajo);

  v_member := public.validate_member_legajo(v_legajo, v_dni);
  IF NOT (v_member->>'ok')::boolean THEN
    RAISE EXCEPTION '%', coalesce(v_member->>'code', 'legajo_not_authorized');
  END IF;

  IF public.is_valid_universal_admin_code(p_admin_code) THEN
    v_role := 'admin';
  END IF;

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
  VALUES (v_uid, v_email, trim(p_full_name), v_dni, v_legajo, v_role, true, 0, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    dni = EXCLUDED.dni,
    legajo = EXCLUDED.legajo,
    role = CASE
      WHEN public.is_valid_universal_admin_code(p_admin_code) THEN 'admin'
      ELSE public.profiles.role
    END,
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
    'ok', true, 'role', v_role, 'dni', v_dni, 'legajo', v_legajo,
    'email', v_email, 'full_name', trim(p_full_name),
    'review', v_review
  );
END;
$$;

-- Backfill revisión para perfiles existentes con DNI
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE dni IS NOT NULL AND public.normalize_dni(dni) <> '' LOOP
    PERFORM public.apply_profile_dni_review(r.id);
  END LOOP;
END $$;

-- admin_approve_user
CREATE OR REPLACE FUNCTION public.admin_approve_user(p_user_id uuid, p_reason text)
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

  UPDATE public.profiles SET
    review_status = 'manually_approved',
    review_reason = nullif(trim(coalesce(p_reason, '')), ''),
    reviewed_by = v_actor,
    reviewed_at = now(),
    is_active = true,
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'user_manually_approved', 'Usuario aprobado manualmente',
    coalesce(nullif(trim(p_reason), ''), 'Aprobado por admin'),
    jsonb_build_object('user_id', p_user_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- admin_reject_user
CREATE OR REPLACE FUNCTION public.admin_reject_user(p_user_id uuid, p_reason text)
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

  UPDATE public.profiles SET
    review_status = 'rejected',
    review_reason = nullif(trim(coalesce(p_reason, '')), ''),
    reviewed_by = v_actor,
    reviewed_at = now(),
    is_active = false,
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'user_rejected', 'Usuario rechazado',
    coalesce(nullif(trim(p_reason), ''), 'Rechazado por admin'),
    jsonb_build_object('user_id', p_user_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- admin_soft_delete_user (actualizar con reviewed)
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

  UPDATE public.profiles SET
    is_active = false,
    deleted_at = now(),
    deleted_reason = nullif(trim(coalesce(p_reason, '')), ''),
    reviewed_by = v_actor,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, 'user_deleted', 'Usuario eliminado lógicamente',
    coalesce(nullif(trim(p_reason), ''), 'Sin motivo'),
    jsonb_build_object('legajo', v_target.legajo, 'email', v_target.email)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- admin_get_users con padrón
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
        p.dni,
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
        coalesce((SELECT lb.points FROM public.leaderboard lb WHERE lb.user_id = p.id AND lb.period = 'overall' LIMIT 1), 0) AS total_points
      FROM public.profiles p
      LEFT JOIN public.member_reference mr ON public.normalize_dni(mr.dni) = public.normalize_dni(p.dni)
    ) u
  );
END;
$$;

-- admin_get_dashboard con stats de revisión
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
        WHERE lb.period = 'overall'
        ORDER BY lb.rank ASC LIMIT 10
      ) t
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
        SELECT p.id, p.legajo, p.full_name, p.dni, p.email, p.created_at, p.review_reason,
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

-- RLS member_reference: solo admin
ALTER TABLE public.member_reference ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_reference_admin ON public.member_reference;
CREATE POLICY member_reference_admin ON public.member_reference
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- RLS profiles: usuario no puede cambiar review_*
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
    AND deleted_at IS NOT DISTINCT FROM (SELECT p.deleted_at FROM public.profiles p WHERE p.id = auth.uid())
    AND review_status = (SELECT p.review_status FROM public.profiles p WHERE p.id = auth.uid())
    AND review_reason IS NOT DISTINCT FROM (SELECT p.review_reason FROM public.profiles p WHERE p.id = auth.uid())
    AND reviewed_by IS NOT DISTINCT FROM (SELECT p.reviewed_by FROM public.profiles p WHERE p.id = auth.uid())
    AND reviewed_at IS NOT DISTINCT FROM (SELECT p.reviewed_at FROM public.profiles p WHERE p.id = auth.uid())
  );

GRANT EXECUTE ON FUNCTION public.apply_profile_dni_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_user(uuid, text) TO authenticated;
