-- Perfil corporativo: DNI + legajo (reemplaza dominio/patente en el login)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dni text,
  ADD COLUMN IF NOT EXISTS legajo text;

CREATE OR REPLACE FUNCTION public.normalize_dni(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(trim(coalesce(raw, '')), '\D', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.normalize_legajo(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(regexp_replace(trim(coalesce(raw, '')), '[\s\-]+', '', 'g'));
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_dni_unique
  ON public.profiles (public.normalize_dni(dni))
  WHERE dni IS NOT NULL AND public.normalize_dni(dni) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_legajo_unique
  ON public.profiles (public.normalize_legajo(legajo))
  WHERE legajo IS NOT NULL AND public.normalize_legajo(legajo) <> '';

CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, dni, legajo, domain_plate, role, created_at, updated_at)
  VALUES (
    NEW.id,
    lower(trim(COALESCE(NEW.email, ''))),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(NEW.email, ''), '@', 1), 'Jugador'),
    NULLIF(public.normalize_dni(NEW.raw_user_meta_data->>'dni'), ''),
    NULLIF(public.normalize_legajo(NEW.raw_user_meta_data->>'legajo'), ''),
    NULLIF(public.normalize_domain_plate(NEW.raw_user_meta_data->>'domain_plate'), ''),
    'member',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    dni = COALESCE(EXCLUDED.dni, public.profiles.dni),
    legajo = COALESCE(EXCLUDED.legajo, public.profiles.legajo),
    updated_at = now();

  RETURN NEW;
END;
$$;

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
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'dni_taken');
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_legajo(legajo) = v_legajo
    AND lower(trim(email)) <> v_email
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'legajo_taken');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  v_dni := public.normalize_dni(p_dni);
  v_legajo := public.normalize_legajo(p_legajo);

  IF public.is_valid_universal_admin_code(p_admin_code) THEN
    v_role := 'admin';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF trim(coalesce(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'full_name_required';
  END IF;

  IF v_dni = '' THEN
    RAISE EXCEPTION 'dni_required';
  END IF;

  IF v_legajo = '' THEN
    RAISE EXCEPTION 'legajo_required';
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_dni(dni) = v_dni AND id <> v_uid
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'dni_taken';
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_legajo(legajo) = v_legajo AND id <> v_uid
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'legajo_taken';
  END IF;

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

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_role,
    'dni', v_dni,
    'legajo', v_legajo,
    'email', v_email,
    'full_name', trim(p_full_name)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_user_profile_admin(
  p_user_id uuid,
  p_full_name text,
  p_dni text,
  p_legajo text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dni text;
  v_legajo text;
  v_email text;
  v_conflict uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  v_dni := public.normalize_dni(p_dni);
  v_legajo := public.normalize_legajo(p_legajo);

  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF trim(coalesce(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'full_name_required';
  END IF;

  IF v_dni = '' THEN
    RAISE EXCEPTION 'dni_required';
  END IF;

  IF v_legajo = '' THEN
    RAISE EXCEPTION 'legajo_required';
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_dni(dni) = v_dni AND id <> p_user_id
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'dni_taken';
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_legajo(legajo) = v_legajo AND id <> p_user_id
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'legajo_taken';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, dni, legajo, role, is_active, token_balance, created_at, updated_at)
  VALUES (p_user_id, v_email, trim(p_full_name), v_dni, v_legajo, 'admin', true, 0, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    dni = EXCLUDED.dni,
    legajo = EXCLUDED.legajo,
    role = 'admin',
    is_active = true,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'role', 'admin',
    'dni', v_dni,
    'legajo', v_legajo,
    'email', v_email,
    'full_name', trim(p_full_name)
  );
END;
$$;

-- Sobrecarga legacy (domain_plate) → redirige si alguien llama la firma vieja
DROP FUNCTION IF EXISTS public.validate_registration(text, text);
DROP FUNCTION IF EXISTS public.sync_user_profile(text, text, text);
DROP FUNCTION IF EXISTS public.sync_user_profile(text, text, text, text);
DROP FUNCTION IF EXISTS public.sync_user_profile_admin(uuid, text, text, text);

GRANT EXECUTE ON FUNCTION public.validate_registration(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_profile(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_profile_admin(uuid, text, text, text, text) TO service_role;
