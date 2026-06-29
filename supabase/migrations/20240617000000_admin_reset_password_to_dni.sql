-- Marca en perfil que la contraseña volvió a ser el DNI (tras reset vía Edge Function / API).

CREATE OR REPLACE FUNCTION public.admin_mark_password_reset_to_dni(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_target.dni IS NULL OR public.normalize_dni(v_target.dni) = '' THEN
    RAISE EXCEPTION 'dni_required';
  END IF;

  UPDATE public.profiles
  SET
    must_change_password = false,
    password_changed_at = NULL,
    is_active = true,
    is_blocked = false,
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.insert_activity_log(
    p_user_id,
    v_actor,
    'admin_role_changed',
    'Contraseña restablecida a DNI',
    NULL,
    jsonb_build_object('reset_to_dni', true, 'dni_masked', public.mask_dni(v_target.dni))
  );

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_mark_password_reset_to_dni(uuid) TO authenticated;
