-- Código universal de ingreso admin (0047) — validación server-side

CREATE OR REPLACE FUNCTION public.normalize_access_code(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(coalesce(raw, ''), '\D', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.is_valid_universal_admin_code(p_code text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.normalize_access_code(p_code) = '0047';
$$;

-- Perfil admin tras login universal (solo service role / edge function)
CREATE OR REPLACE FUNCTION public.sync_user_profile_admin(
  p_user_id uuid,
  p_full_name text,
  p_domain_plate text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plate text;
  v_email text;
  v_conflict uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  v_plate := public.normalize_domain_plate(p_domain_plate);

  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF trim(coalesce(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'full_name_required';
  END IF;

  IF v_plate = '' THEN
    RAISE EXCEPTION 'domain_plate_required';
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_domain_plate(domain_plate) = v_plate
    AND id <> p_user_id
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'domain_plate_taken';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, domain_plate, role, is_active, token_balance, created_at, updated_at)
  VALUES (p_user_id, v_email, trim(p_full_name), v_plate, 'admin', true, 0, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    domain_plate = EXCLUDED.domain_plate,
    role = 'admin',
    is_active = true,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'role', 'admin',
    'domain_plate', v_plate,
    'email', v_email,
    'full_name', trim(p_full_name)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_profile_admin(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_user_profile_admin(uuid, text, text, text) TO service_role;

-- sync_user_profile: opcionalmente promover si el código es válido (authenticated)
CREATE OR REPLACE FUNCTION public.sync_user_profile(
  p_full_name text,
  p_domain_plate text,
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
  v_plate text;
  v_email text;
  v_conflict uuid;
  v_role text := 'member';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  v_plate := public.normalize_domain_plate(p_domain_plate);

  IF public.is_valid_universal_admin_code(p_admin_code) THEN
    v_role := 'admin';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF trim(coalesce(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'full_name_required';
  END IF;

  IF v_plate = '' THEN
    RAISE EXCEPTION 'domain_plate_required';
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_domain_plate(domain_plate) = v_plate
    AND id <> v_uid
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'domain_plate_taken';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, domain_plate, role, is_active, token_balance, created_at, updated_at)
  VALUES (v_uid, v_email, trim(p_full_name), v_plate, v_role, true, 0, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    domain_plate = EXCLUDED.domain_plate,
    role = CASE
      WHEN public.is_valid_universal_admin_code(p_admin_code) THEN 'admin'
      ELSE public.profiles.role
    END,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_role,
    'domain_plate', v_plate,
    'email', v_email,
    'full_name', trim(p_full_name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_user_profile(text, text, text, text) TO authenticated;
