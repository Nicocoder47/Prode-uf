-- Panel admin Supabase-only: allowed_members, activity_logs, notifications, admin_cards, RPCs y RLS

-- Renombrar tabla legacy de notificaciones (no usada en frontend)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'payload'
  ) THEN
    ALTER TABLE public.notifications RENAME TO legacy_notifications;
  END IF;
END $$;

DROP POLICY IF EXISTS notifications_owner_select ON public.legacy_notifications;
DROP POLICY IF EXISTS notifications_admin ON public.legacy_notifications;

-- Columnas extra en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_reason text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 1. allowed_members
CREATE TABLE IF NOT EXISTS public.allowed_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legajo text NOT NULL,
  dni text,
  full_name text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT allowed_members_status_check CHECK (status IN ('active', 'inactive', 'blocked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_allowed_members_legajo_unique
  ON public.allowed_members (public.normalize_legajo(legajo));

-- 2. activity_logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON public.activity_logs (type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs (user_id);

-- 3. notifications (nueva estructura)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  target_type text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_role text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_target_type_check CHECK (target_type IN ('all', 'user', 'role'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_active ON public.notifications (is_active, created_at DESC);

-- 4. notification_reads
CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

-- 5. admin_cards
CREATE TABLE IF NOT EXISTS public.admin_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  value text,
  subtitle text,
  description text,
  icon text,
  status text NOT NULL DEFAULT 'neutral',
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_cards_status_check CHECK (status IN ('neutral', 'success', 'warning', 'danger'))
);

INSERT INTO public.admin_cards (key, title, value, subtitle, status, order_index)
VALUES
  ('total_participants', 'Participantes', '—', 'Jugadores activos', 'neutral', 1),
  ('prize_pool', 'Premio', '—', 'Pozo acumulado', 'success', 2),
  ('next_match_deadline', 'Próximo cierre', '—', 'Deadline predicciones', 'warning', 3),
  ('tournament_status', 'Torneo', 'En curso', 'Estado del mundial', 'neutral', 4),
  ('important_message', 'Aviso', '—', 'Mensaje importante', 'neutral', 5),
  ('sync_status', 'Sync', '—', 'Última sincronización', 'neutral', 6)
ON CONFLICT (key) DO NOTHING;

-- Helper: enmascarar DNI
CREATE OR REPLACE FUNCTION public.mask_dni(p_dni text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_dni, '') = '' THEN '—'
    WHEN length(p_dni) <= 4 THEN repeat('*', length(p_dni))
    ELSE repeat('*', greatest(length(p_dni) - 4, 0)) || right(p_dni, 4)
  END;
$$;

-- Helper: insertar activity log
CREATE OR REPLACE FUNCTION public.insert_activity_log(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.activity_logs (user_id, actor_id, type, title, description, metadata)
  VALUES (p_user_id, p_actor_id, p_type, p_title, p_description, coalesce(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 1. is_admin (actualizar)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

-- 2. validate_member_legajo
CREATE OR REPLACE FUNCTION public.validate_member_legajo(p_legajo text, p_dni text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_legajo text;
  v_dni text;
  v_row public.allowed_members%ROWTYPE;
BEGIN
  v_legajo := public.normalize_legajo(p_legajo);
  v_dni := public.normalize_dni(p_dni);

  IF v_legajo = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'legajo_required');
  END IF;

  SELECT * INTO v_row
  FROM public.allowed_members
  WHERE public.normalize_legajo(legajo) = v_legajo
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'legajo_not_authorized');
  END IF;

  IF v_row.status = 'blocked' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'legajo_blocked');
  END IF;

  IF v_row.status = 'inactive' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'legajo_inactive');
  END IF;

  IF v_row.dni IS NOT NULL AND public.normalize_dni(v_row.dni) <> '' AND v_dni <> '' THEN
    IF public.normalize_dni(v_row.dni) <> v_dni THEN
      RETURN jsonb_build_object('ok', false, 'code', 'dni_mismatch');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'full_name', v_row.full_name);
END;
$$;

-- Actualizar validate_registration con allowed_members
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
  v_member jsonb;
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

  v_member := public.validate_member_legajo(v_legajo, v_dni);
  IF NOT (v_member->>'ok')::boolean THEN
    RETURN v_member;
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

-- 11. log_user_login
CREATE OR REPLACE FUNCTION public.log_user_login()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_profile.deleted_at IS NOT NULL OR v_profile.is_active = false THEN
    RAISE EXCEPTION 'account_disabled';
  END IF;

  UPDATE public.profiles SET last_login_at = now(), updated_at = now() WHERE id = v_uid;

  PERFORM public.insert_activity_log(
    v_uid, v_uid, 'user_login', 'Inicio de sesión',
    coalesce(v_profile.full_name, v_profile.email),
    jsonb_build_object('legajo', v_profile.legajo, 'email', v_profile.email)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Actualizar sync_user_profile: log user_registered en primer alta completa
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

  RETURN jsonb_build_object(
    'ok', true, 'role', v_role, 'dni', v_dni, 'legajo', v_legajo,
    'email', v_email, 'full_name', trim(p_full_name)
  );
END;
$$;

-- Trigger predicciones → activity_logs
CREATE OR REPLACE FUNCTION public.log_prediction_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.insert_activity_log(
      NEW.user_id, NEW.user_id, 'prediction_created', 'Predicción creada',
      'Partido ' || NEW.match_id::text,
      jsonb_build_object('match_id', NEW.match_id, 'prediction_id', NEW.id)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.insert_activity_log(
      NEW.user_id, NEW.user_id, 'prediction_updated', 'Predicción actualizada',
      'Partido ' || NEW.match_id::text,
      jsonb_build_object('match_id', NEW.match_id, 'prediction_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_prediction_activity ON public.predictions;
CREATE TRIGGER trg_log_prediction_activity
  AFTER INSERT OR UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.log_prediction_activity();

-- 3. admin_get_dashboard
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users', (SELECT count(*) FROM public.profiles WHERE is_active = true AND deleted_at IS NULL),
    'blocked_users', (SELECT count(*) FROM public.profiles WHERE is_active = false AND deleted_at IS NULL),
    'deleted_users', (SELECT count(*) FROM public.profiles WHERE deleted_at IS NOT NULL),
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
        ORDER BY lb.rank ASC
        LIMIT 10
      ) t
    ),
    'latest_activity_logs', (
      SELECT coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb) FROM (
        SELECT al.id, al.type, al.title, al.description, al.metadata, al.created_at,
               al.user_id, p.full_name, p.legajo
        FROM public.activity_logs al
        LEFT JOIN public.profiles p ON p.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 20
      ) a
    ),
    'admin_cards', (
      SELECT coalesce(jsonb_agg(row_to_json(c) ORDER BY c.order_index), '[]'::jsonb)
      FROM public.admin_cards c
      WHERE c.is_active = true
    ),
    'latest_registrations', (
      SELECT coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) FROM (
        SELECT p.id, p.full_name, p.legajo, p.email, p.created_at
        FROM public.profiles p
        ORDER BY p.created_at DESC LIMIT 10
      ) r
    ),
    'latest_logins', (
      SELECT coalesce(jsonb_agg(row_to_json(l)), '[]'::jsonb) FROM (
        SELECT p.id, p.full_name, p.legajo, p.email, p.last_login_at
        FROM public.profiles p
        WHERE p.last_login_at IS NOT NULL
        ORDER BY p.last_login_at DESC LIMIT 10
      ) l
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 4. admin_get_users
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
    SELECT coalesce(jsonb_agg(row_to_json(u) ORDER BY u.created_at DESC), '[]'::jsonb)
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
        (SELECT count(*)::int FROM public.predictions pr WHERE pr.user_id = p.id) AS predictions_count,
        coalesce((SELECT lb.points FROM public.leaderboard lb WHERE lb.user_id = p.id AND lb.period = 'overall' LIMIT 1), 0) AS total_points
      FROM public.profiles p
    ) u
  );
END;
$$;

-- 5. admin_soft_delete_user
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

-- 6. admin_set_user_active
CREATE OR REPLACE FUNCTION public.admin_set_user_active(p_user_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target public.profiles%ROWTYPE;
  v_type text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  UPDATE public.profiles SET
    is_active = p_active,
    deleted_at = CASE WHEN p_active THEN NULL ELSE deleted_at END,
    updated_at = now()
  WHERE id = p_user_id;

  v_type := CASE WHEN p_active THEN 'user_unblocked' ELSE 'user_blocked' END;

  PERFORM public.insert_activity_log(
    p_user_id, v_actor, v_type,
    CASE WHEN p_active THEN 'Usuario desbloqueado' ELSE 'Usuario bloqueado' END,
    v_target.full_name,
    jsonb_build_object('legajo', v_target.legajo)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- admin_set_user_role (promover/quitar admin)
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
    p_user_id, v_actor, 'admin_card_updated',
    'Rol actualizado a ' || p_role,
    NULL,
    jsonb_build_object('role', p_role)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. admin_create_notification
CREATE OR REPLACE FUNCTION public.admin_create_notification(
  p_title text,
  p_message text,
  p_target_type text,
  p_target_user_id uuid DEFAULT NULL,
  p_target_role text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF trim(coalesce(p_title, '')) = '' THEN RAISE EXCEPTION 'title_required'; END IF;
  IF trim(coalesce(p_message, '')) = '' THEN RAISE EXCEPTION 'message_required'; END IF;
  IF p_target_type NOT IN ('all', 'user', 'role') THEN RAISE EXCEPTION 'invalid_target_type'; END IF;

  INSERT INTO public.notifications (title, message, target_type, target_user_id, target_role, created_by, expires_at)
  VALUES (trim(p_title), trim(p_message), p_target_type, p_target_user_id, p_target_role, v_actor, p_expires_at)
  RETURNING id INTO v_id;

  PERFORM public.insert_activity_log(
    p_target_user_id, v_actor, 'notification_created', 'Notificación creada',
    trim(p_title),
    jsonb_build_object('notification_id', v_id, 'target_type', p_target_type)
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- 8. get_my_notifications
CREATE OR REPLACE FUNCTION public.get_my_notifications()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

  RETURN (
    SELECT coalesce(jsonb_agg(row_to_json(n) ORDER BY n.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT
        nt.id, nt.title, nt.message, nt.target_type, nt.created_at, nt.expires_at,
        EXISTS (
          SELECT 1 FROM public.notification_reads nr
          WHERE nr.notification_id = nt.id AND nr.user_id = v_uid
        ) AS is_read
      FROM public.notifications nt
      WHERE nt.is_active = true
        AND (nt.expires_at IS NULL OR nt.expires_at > now())
        AND (
          nt.target_type = 'all'
          OR (nt.target_type = 'user' AND nt.target_user_id = v_uid)
          OR (nt.target_type = 'role' AND nt.target_role = v_role)
        )
    ) n
  );
END;
$$;

-- 9. mark_notification_read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_notification_id IS NULL THEN RAISE EXCEPTION 'notification_id_required'; END IF;

  INSERT INTO public.notification_reads (notification_id, user_id)
  VALUES (p_notification_id, v_uid)
  ON CONFLICT (notification_id, user_id) DO UPDATE SET read_at = now();

  PERFORM public.insert_activity_log(
    v_uid, v_uid, 'notification_read', 'Notificación leída', NULL,
    jsonb_build_object('notification_id', p_notification_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 10. admin_update_card
CREATE OR REPLACE FUNCTION public.admin_update_card(
  p_key text,
  p_title text,
  p_value text DEFAULT NULL,
  p_subtitle text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_icon text DEFAULT NULL,
  p_status text DEFAULT 'neutral',
  p_order_index integer DEFAULT 0,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF trim(coalesce(p_key, '')) = '' THEN RAISE EXCEPTION 'key_required'; END IF;
  IF trim(coalesce(p_title, '')) = '' THEN RAISE EXCEPTION 'title_required'; END IF;

  INSERT INTO public.admin_cards (key, title, value, subtitle, description, icon, status, order_index, is_active, updated_by)
  VALUES (
    trim(p_key), trim(p_title), p_value, p_subtitle, p_description, p_icon,
    coalesce(nullif(p_status, ''), 'neutral'), coalesce(p_order_index, 0),
    coalesce(p_is_active, true), v_actor
  )
  ON CONFLICT (key) DO UPDATE SET
    title = EXCLUDED.title,
    value = EXCLUDED.value,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    status = EXCLUDED.status,
    order_index = EXCLUDED.order_index,
    is_active = EXCLUDED.is_active,
    updated_by = v_actor,
    updated_at = now()
  RETURNING id INTO v_id;

  PERFORM public.insert_activity_log(
    NULL, v_actor, 'admin_card_updated', 'Card actualizada', trim(p_key),
    jsonb_build_object('card_key', trim(p_key), 'card_id', v_id)
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- admin_get_activity_logs con filtros
CREATE OR REPLACE FUNCTION public.admin_get_activity_logs(
  p_type text DEFAULT NULL,
  p_legajo text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_legajo text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_legajo := public.normalize_legajo(coalesce(p_legajo, ''));

  RETURN (
    SELECT coalesce(jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT al.id, al.type, al.title, al.description, al.metadata, al.created_at,
             al.user_id, al.actor_id,
             pu.full_name AS user_name, pu.legajo AS user_legajo,
             pa.full_name AS actor_name
      FROM public.activity_logs al
      LEFT JOIN public.profiles pu ON pu.id = al.user_id
      LEFT JOIN public.profiles pa ON pa.id = al.actor_id
      WHERE (p_type IS NULL OR al.type = p_type)
        AND (v_legajo = '' OR public.normalize_legajo(coalesce(pu.legajo, '')) = v_legajo)
        AND (p_from IS NULL OR al.created_at >= p_from)
        AND (p_to IS NULL OR al.created_at <= p_to)
      ORDER BY al.created_at DESC
      LIMIT greatest(1, least(coalesce(p_limit, 100), 500))
    ) a
  );
END;
$$;

-- admin_get_notifications
CREATE OR REPLACE FUNCTION public.admin_get_notifications()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(row_to_json(n) ORDER BY n.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT nt.*,
        cb.full_name AS creator_name,
        tu.full_name AS target_user_name,
        (SELECT count(*)::int FROM public.notification_reads nr WHERE nr.notification_id = nt.id) AS read_count
      FROM public.notifications nt
      LEFT JOIN public.profiles cb ON cb.id = nt.created_by
      LEFT JOIN public.profiles tu ON tu.id = nt.target_user_id
    ) n
  );
END;
$$;

-- Cards públicas activas
CREATE OR REPLACE FUNCTION public.get_active_admin_cards()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row_to_json(c) ORDER BY c.order_index), '[]'::jsonb)
  FROM public.admin_cards c
  WHERE c.is_active = true;
$$;

-- RLS: allowed_members
ALTER TABLE public.allowed_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allowed_members_admin ON public.allowed_members;
CREATE POLICY allowed_members_admin ON public.allowed_members
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- RLS: activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_logs_admin ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_self ON public.activity_logs;
CREATE POLICY activity_logs_admin ON public.activity_logs
  FOR SELECT USING (public.is_admin());
CREATE POLICY activity_logs_self ON public.activity_logs
  FOR SELECT USING (auth.uid() = user_id);

-- RLS: notifications (nueva)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_admin ON public.notifications;
CREATE POLICY notifications_admin ON public.notifications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- RLS: notification_reads
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_reads_self ON public.notification_reads;
DROP POLICY IF EXISTS notification_reads_admin ON public.notification_reads;
CREATE POLICY notification_reads_self ON public.notification_reads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY notification_reads_admin ON public.notification_reads
  FOR SELECT USING (public.is_admin());

-- RLS: admin_cards
ALTER TABLE public.admin_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_cards_public_read ON public.admin_cards;
DROP POLICY IF EXISTS admin_cards_admin ON public.admin_cards;
CREATE POLICY admin_cards_public_read ON public.admin_cards
  FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY admin_cards_admin ON public.admin_cards
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- RLS profiles: impedir que usuario cambie campos sensibles
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
    AND deleted_at IS NOT DISTINCT FROM (SELECT p.deleted_at FROM public.profiles p WHERE p.id = auth.uid())
  );

-- RLS predictions: bloquear usuarios inactivos/eliminados
DROP POLICY IF EXISTS predictions_insert ON public.predictions;
DROP POLICY IF EXISTS predictions_owner_update ON public.predictions;
CREATE POLICY predictions_insert ON public.predictions
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true AND p.deleted_at IS NULL
      )
    )
  );
CREATE POLICY predictions_owner_update ON public.predictions
  FOR UPDATE USING (
    public.is_admin()
    OR (
      auth.uid() = user_id AND status = 'pending'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true AND p.deleted_at IS NULL
      )
    )
  );

-- Grants RPC
GRANT EXECUTE ON FUNCTION public.validate_member_legajo(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_user_login() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_active(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_notification(text, text, text, uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_card(text, text, text, text, text, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_activity_logs(text, text, timestamptz, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_admin_cards() TO authenticated, anon;

-- Legajo maestro inicial (si no existe)
INSERT INTO public.allowed_members (legajo, dni, full_name, status)
SELECT 'MAESTRO', '47000001', 'Admin Maestro', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.allowed_members WHERE public.normalize_legajo(legajo) = 'MAESTRO'
);
