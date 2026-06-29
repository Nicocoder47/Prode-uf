-- Registro de intentos de login y panel admin de problemas de acceso

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  success boolean NOT NULL DEFAULT false,
  error_code text,
  error_message text,
  attempt_type text NOT NULL DEFAULT 'login',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT login_attempts_type_check CHECK (attempt_type IN ('login', 'register'))
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at
  ON public.login_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
  ON public.login_attempts (lower(trim(email)), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_failures_recent
  ON public.login_attempts (created_at DESC)
  WHERE success = false;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS login_attempts_admin_read ON public.login_attempts;
CREATE POLICY login_attempts_admin_read ON public.login_attempts
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- log_login_attempt — callable desde login sin sesión (con throttle básico)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_login_attempt(
  p_email text,
  p_success boolean,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_attempt_type text DEFAULT 'login'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
  v_recent int;
  v_type text := lower(trim(coalesce(p_attempt_type, 'login')));
BEGIN
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true);
  END IF;

  IF v_type NOT IN ('login', 'register') THEN
    v_type := 'login';
  END IF;

  SELECT count(*)::int INTO v_recent
  FROM public.login_attempts la
  WHERE lower(trim(la.email)) = v_email
    AND la.created_at >= now() - interval '1 minute';

  IF v_recent >= 15 THEN
    RETURN jsonb_build_object('ok', true, 'throttled', true);
  END IF;

  SELECT p.id INTO v_user_id
  FROM public.profiles p
  WHERE lower(trim(p.email)) = v_email
    AND p.deleted_at IS NULL
  LIMIT 1;

  INSERT INTO public.login_attempts (
    email, user_id, success, error_code, error_message, attempt_type
  ) VALUES (
    v_email,
    v_user_id,
    coalesce(p_success, false),
    NULLIF(trim(coalesce(p_error_code, '')), ''),
    NULLIF(left(trim(coalesce(p_error_message, '')), 500), ''),
    v_type
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_login_attempt(text, boolean, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_get_login_issues — usuarios en riesgo + intentos fallidos recientes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_login_issues()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_never_logged int;
  v_wrong_password int;
  v_inactive int;
  v_blocked int;
  v_must_change int;
  v_failed_24h int;
  v_failed_7d int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*)::int INTO v_never_logged
  FROM public.profiles p
  WHERE p.deleted_at IS NULL AND p.role <> 'admin' AND p.last_login_at IS NULL;

  SELECT count(*)::int INTO v_wrong_password
  FROM public.profiles p
  WHERE p.deleted_at IS NULL AND p.role <> 'admin'
    AND p.last_login_at IS NULL
    AND p.password_changed_at IS NOT NULL;

  SELECT count(*)::int INTO v_inactive
  FROM public.profiles p
  WHERE p.deleted_at IS NULL AND p.role <> 'admin' AND p.is_active = false;

  SELECT count(*)::int INTO v_blocked
  FROM public.profiles p
  WHERE p.deleted_at IS NULL AND p.role <> 'admin' AND coalesce(p.is_blocked, false) = true;

  SELECT count(*)::int INTO v_must_change
  FROM public.profiles p
  WHERE p.deleted_at IS NULL AND p.role <> 'admin' AND coalesce(p.must_change_password, false) = true;

  SELECT count(*)::int INTO v_failed_24h
  FROM public.login_attempts la
  WHERE la.success = false AND la.created_at >= now() - interval '24 hours';

  SELECT count(*)::int INTO v_failed_7d
  FROM public.login_attempts la
  WHERE la.success = false AND la.created_at >= now() - interval '7 days';

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'never_logged_in', v_never_logged,
      'likely_wrong_password', v_wrong_password,
      'inactive_accounts', v_inactive,
      'blocked_accounts', v_blocked,
      'must_change_password', v_must_change,
      'failed_attempts_24h', v_failed_24h,
      'failed_attempts_7d', v_failed_7d,
      'generated_at', now()
    ),
    'at_risk_users', (
      SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.priority, x.full_name), '[]'::jsonb)
      FROM (
        SELECT
          p.id,
          p.full_name,
          p.email,
          public.mask_dni(p.dni) AS dni_masked,
          p.legajo,
          p.last_login_at,
          p.password_changed_at,
          p.must_change_password,
          p.is_active,
          coalesce(p.is_blocked, false) AS is_blocked,
          (SELECT count(*)::int FROM public.predictions pr WHERE pr.user_id = p.id) AS predictions_count,
          (
            SELECT la.error_message
            FROM public.login_attempts la
            WHERE lower(trim(la.email)) = lower(trim(p.email))
              AND la.success = false
            ORDER BY la.created_at DESC
            LIMIT 1
          ) AS last_error_message,
          (
            SELECT la.created_at
            FROM public.login_attempts la
            WHERE lower(trim(la.email)) = lower(trim(p.email))
              AND la.success = false
            ORDER BY la.created_at DESC
            LIMIT 1
          ) AS last_failed_at,
          (
            SELECT count(*)::int
            FROM public.login_attempts la
            WHERE lower(trim(la.email)) = lower(trim(p.email))
              AND la.success = false
              AND la.created_at >= now() - interval '7 days'
          ) AS failed_attempts_7d,
          array_remove(array[
            CASE WHEN p.last_login_at IS NULL THEN 'sin_login' END,
            CASE WHEN p.password_changed_at IS NOT NULL AND p.last_login_at IS NULL THEN 'clave_cambiada' END,
            CASE WHEN p.is_active = false THEN 'cuenta_inactiva' END,
            CASE WHEN coalesce(p.is_blocked, false) THEN 'bloqueado' END,
            CASE WHEN coalesce(p.must_change_password, false) THEN 'debe_cambiar_clave' END
          ], NULL) AS issue_tags,
          CASE
            WHEN p.is_active = false THEN 0
            WHEN coalesce(p.is_blocked, false) THEN 1
            WHEN EXISTS (
              SELECT 1 FROM public.login_attempts la
              WHERE lower(trim(la.email)) = lower(trim(p.email))
                AND la.success = false
                AND la.created_at >= now() - interval '24 hours'
            ) THEN 2
            WHEN p.password_changed_at IS NOT NULL AND p.last_login_at IS NULL THEN 3
            WHEN p.last_login_at IS NULL THEN 4
            ELSE 5
          END AS priority
        FROM public.profiles p
        WHERE p.deleted_at IS NULL
          AND p.role <> 'admin'
          AND (
            p.last_login_at IS NULL
            OR p.is_active = false
            OR coalesce(p.is_blocked, false)
            OR coalesce(p.must_change_password, false)
            OR EXISTS (
              SELECT 1 FROM public.login_attempts la
              WHERE lower(trim(la.email)) = lower(trim(p.email))
                AND la.success = false
                AND la.created_at >= now() - interval '7 days'
            )
          )
      ) x
      WHERE cardinality(x.issue_tags) > 0
         OR x.failed_attempts_7d > 0
    ),
    'recent_failures', (
      SELECT coalesce(jsonb_agg(row_to_json(f) ORDER BY f.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          la.id,
          la.email,
          la.user_id,
          la.error_code,
          la.error_message,
          la.attempt_type,
          la.created_at,
          p.full_name,
          public.mask_dni(p.dni) AS dni_masked,
          p.legajo
        FROM public.login_attempts la
        LEFT JOIN public.profiles p ON p.id = la.user_id
        WHERE la.success = false
        ORDER BY la.created_at DESC
        LIMIT 150
      ) f
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_login_issues() TO authenticated;
