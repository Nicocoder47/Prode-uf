-- Alerta global destacada (banner modal al iniciar sesión)

CREATE TABLE IF NOT EXISTS public.global_app_alert (
  singleton_key text PRIMARY KEY DEFAULT 'default' CHECK (singleton_key = 'default'),
  kicker text NOT NULL DEFAULT 'Aviso importante',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.global_app_alert (singleton_key)
VALUES ('default')
ON CONFLICT (singleton_key) DO NOTHING;

ALTER TABLE public.global_app_alert ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_app_alert_admin ON public.global_app_alert;
CREATE POLICY global_app_alert_admin ON public.global_app_alert
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_active_global_alert()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.global_app_alert%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.global_app_alert
  WHERE singleton_key = 'default'
  LIMIT 1;

  IF NOT FOUND OR NOT v_row.is_active THEN
    RETURN NULL;
  END IF;

  IF trim(coalesce(v_row.title, '')) = '' AND trim(coalesce(v_row.message, '')) = '' THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'kicker', coalesce(nullif(trim(v_row.kicker), ''), 'Aviso importante'),
    'title', trim(v_row.title),
    'message', trim(v_row.message),
    'is_active', v_row.is_active,
    'updated_at', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_global_alert()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.global_app_alert%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_row
  FROM public.global_app_alert
  WHERE singleton_key = 'default'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'kicker', 'Aviso importante',
      'title', '',
      'message', '',
      'is_active', false,
      'updated_at', now()
    );
  END IF;

  RETURN jsonb_build_object(
    'kicker', coalesce(nullif(trim(v_row.kicker), ''), 'Aviso importante'),
    'title', coalesce(v_row.title, ''),
    'message', coalesce(v_row.message, ''),
    'is_active', v_row.is_active,
    'updated_at', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_global_alert(
  p_kicker text,
  p_title text,
  p_message text,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.global_app_alert (singleton_key, kicker, title, message, is_active, updated_by, updated_at)
  VALUES (
    'default',
    coalesce(nullif(trim(p_kicker), ''), 'Aviso importante'),
    coalesce(trim(p_title), ''),
    coalesce(trim(p_message), ''),
    coalesce(p_is_active, false),
    v_actor,
    now()
  )
  ON CONFLICT (singleton_key) DO UPDATE SET
    kicker = coalesce(nullif(trim(EXCLUDED.kicker), ''), 'Aviso importante'),
    title = coalesce(trim(EXCLUDED.title), ''),
    message = coalesce(trim(EXCLUDED.message), ''),
    is_active = coalesce(EXCLUDED.is_active, false),
    updated_by = v_actor,
    updated_at = now();

  PERFORM public.insert_activity_log(
    NULL, v_actor, 'notification_created', 'Alerta global actualizada',
    coalesce(nullif(trim(p_title), ''), 'Sin título'),
    jsonb_build_object('is_active', coalesce(p_is_active, false))
  );

  RETURN public.admin_get_global_alert();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_global_alert() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_global_alert() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_global_alert(text, text, text, boolean) TO authenticated;
