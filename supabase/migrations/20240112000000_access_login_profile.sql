-- Acceso por email OTP: dominio/patente en perfil y validación de registro

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS domain_plate text;

CREATE OR REPLACE FUNCTION public.normalize_domain_plate(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(regexp_replace(trim(coalesce(raw, '')), '[\s\-]+', '', 'g'));
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_domain_plate_unique
  ON public.profiles (public.normalize_domain_plate(domain_plate))
  WHERE domain_plate IS NOT NULL AND trim(domain_plate) <> '';

CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, domain_plate, role, created_at, updated_at)
  VALUES (
    NEW.id,
    lower(trim(COALESCE(NEW.email, ''))),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(NEW.email, ''), '@', 1), 'Jugador'),
    NULLIF(public.normalize_domain_plate(NEW.raw_user_meta_data->>'domain_plate'), ''),
    'member',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    domain_plate = COALESCE(EXCLUDED.domain_plate, public.profiles.domain_plate),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Pre-validación antes de enviar OTP (anon OK)
CREATE OR REPLACE FUNCTION public.validate_registration(
  p_email text,
  p_domain_plate text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plate text;
  v_email text;
  v_conflict uuid;
BEGIN
  v_email := lower(trim(coalesce(p_email, '')));
  v_plate := public.normalize_domain_plate(p_domain_plate);

  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_email');
  END IF;

  IF v_plate = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'domain_plate_required');
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_domain_plate(domain_plate) = v_plate
    AND lower(trim(email)) <> v_email
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'domain_plate_taken');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Sincronizar perfil tras verificar OTP (usuario autenticado)
CREATE OR REPLACE FUNCTION public.sync_user_profile(
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
  v_uid uuid := auth.uid();
  v_plate text;
  v_email text;
  v_conflict uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  v_plate := public.normalize_domain_plate(p_domain_plate);

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
  VALUES (v_uid, v_email, trim(p_full_name), v_plate, 'member', true, 0, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    domain_plate = EXCLUDED.domain_plate,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'domain_plate', v_plate,
    'email', v_email,
    'full_name', trim(p_full_name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_registration(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_profile(text, text, text) TO authenticated;
