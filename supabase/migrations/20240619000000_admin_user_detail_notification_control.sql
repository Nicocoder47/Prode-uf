-- Detalle admin: incluir is_active y target_type en notificaciones del usuario

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
    SELECT
      nt.id,
      nt.title,
      nt.message,
      nt.created_at,
      nt.expires_at,
      nt.is_active,
      nt.target_type,
      EXISTS (
        SELECT 1 FROM public.notification_reads nr
        WHERE nr.notification_id = nt.id AND nr.user_id = p_user_id
      ) AS is_read
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
