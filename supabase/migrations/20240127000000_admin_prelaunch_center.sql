-- Admin pre-lanzamiento: scoring center, system health, analytics (solo lectura + wrappers admin)
-- NO modifica score_match_predictions, rescore_match_predictions, save_prediction, auth, RLS invitaciones

-- ---------------------------------------------------------------------------
-- 1. Scoring center — overview de partidos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_scoring_center()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_score timestamptz;
  v_last_rescore timestamptz;
  v_matches jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT max(created_at) INTO v_last_score
  FROM public.activity_logs WHERE type = 'score_calculated';

  SELECT max(created_at) INTO v_last_rescore
  FROM public.activity_logs
  WHERE type = 'score_calculated'
    AND coalesce(metadata->>'rescore', 'false') = 'true';

  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.kick_off DESC NULLS LAST), '[]'::jsonb)
  INTO v_matches
  FROM (
    SELECT
      m.id,
      m.status,
      m.score_home,
      m.score_away,
      m.scored_at,
      m.kick_off,
      m.phase,
      ht.name AS home_team,
      at.name AS away_team,
      (SELECT count(*)::int FROM public.predictions p WHERE p.match_id = m.id) AS predictions_total,
      (SELECT count(*)::int FROM public.predictions p WHERE p.match_id = m.id AND p.status = 'scored') AS predictions_scored,
      (SELECT coalesce(sum(p.points), 0)::int FROM public.predictions p WHERE p.match_id = m.id AND p.status = 'scored') AS points_assigned,
      CASE
        WHEN m.status = 'finished' AND m.scored_at IS NULL AND m.score_home IS NOT NULL THEN 'pending_scoring'
        WHEN m.scored_at IS NOT NULL THEN 'scored'
        WHEN m.status IN ('live', 'halftime') THEN 'live'
        WHEN m.status = 'scheduled' THEN 'scheduled'
        ELSE m.status
      END AS scoring_status
    FROM public.matches m
    LEFT JOIN public.teams ht ON ht.id = m.home_team_id
    LEFT JOIN public.teams at ON at.id = m.away_team_id
    WHERE m.status IN ('scheduled', 'live', 'halftime', 'finished')
    ORDER BY m.kick_off DESC NULLS LAST
    LIMIT 120
  ) x;

  RETURN jsonb_build_object(
    'last_score_at', v_last_score,
    'last_rescore_at', v_last_rescore,
    'summary', (
      SELECT jsonb_build_object(
        'pending_scoring', count(*) FILTER (WHERE scoring_status = 'pending_scoring'),
        'scored', count(*) FILTER (WHERE scoring_status = 'scored'),
        'live', count(*) FILTER (WHERE scoring_status = 'live'),
        'scheduled', count(*) FILTER (WHERE scoring_status = 'scheduled'),
        'errors', count(*) FILTER (WHERE scoring_status NOT IN ('pending_scoring','scored','live','scheduled'))
      )
      FROM jsonb_to_recordset(v_matches) AS t(scoring_status text)
    ),
    'matches', v_matches
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Wrappers admin → motores existentes (sin modificar lógica)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_score_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result int;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_match_id IS NULL THEN RAISE EXCEPTION 'match_id_required'; END IF;

  SELECT public.score_match_predictions(p_match_id) INTO v_result;

  PERFORM public.insert_activity_log(
    NULL, v_actor, 'score_calculated',
    'Scoring manual admin',
    format('Partido %s — %s predicciones puntuadas', p_match_id, coalesce(v_result, 0)),
    jsonb_build_object('match_id', p_match_id, 'predictions_scored', v_result, 'admin_triggered', true)
  );

  RETURN jsonb_build_object('ok', true, 'predictions_scored', coalesce(v_result, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_rescore_match(
  p_match_id uuid,
  p_old_score_home int,
  p_old_score_away int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result int;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_match_id IS NULL THEN RAISE EXCEPTION 'match_id_required'; END IF;

  SELECT public.rescore_match_predictions(p_match_id, p_old_score_home, p_old_score_away) INTO v_result;

  PERFORM public.insert_activity_log(
    NULL, v_actor, 'score_calculated',
    'Rescoring manual admin',
    format('Partido %s — %s predicciones recalculadas', p_match_id, coalesce(v_result, 0)),
    jsonb_build_object('match_id', p_match_id, 'predictions_rescored', v_result, 'rescore', true, 'admin_triggered', true)
  );

  RETURN jsonb_build_object('ok', true, 'predictions_rescored', coalesce(v_result, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_recalculate_leaderboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public.admin_recalculate_leaderboard_ranks();
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_score_round(p_round text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_total int := 0;
  v_scored int := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF nullif(trim(p_round), '') IS NULL THEN RAISE EXCEPTION 'round_required'; END IF;

  FOR v_match IN
    SELECT id FROM public.matches
    WHERE status = 'finished'
      AND score_home IS NOT NULL
      AND score_away IS NOT NULL
      AND (phase ILIKE '%' || p_round || '%' OR round = p_round)
  LOOP
    v_total := v_total + 1;
    v_scored := v_scored + coalesce(public.score_match_predictions(v_match.id), 0);
  END LOOP;

  PERFORM public.admin_recalculate_leaderboard_ranks();

  RETURN jsonb_build_object('ok', true, 'matches_processed', v_total, 'predictions_scored', v_scored);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. System health probes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started timestamptz := clock_timestamp();
  v_elapsed_ms numeric;
  v_lb_count int;
  v_sync_err int;
  v_last_sync timestamptz;
  v_last_sync_status text;
  v_last_score timestamptz;
  v_reg_open boolean;
  v_probe_ok boolean := true;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT count(*) INTO v_lb_count FROM public.leaderboard WHERE period = 'global';
  SELECT count(*) INTO v_sync_err
  FROM public.activity_logs
  WHERE type = 'sync_failed' AND created_at >= now() - interval '24 hours';

  SELECT finished_at, status INTO v_last_sync, v_last_sync_status
  FROM public.data_sync_logs
  ORDER BY started_at DESC LIMIT 1;

  SELECT max(created_at) INTO v_last_score
  FROM public.activity_logs WHERE type = 'score_calculated';

  v_reg_open := public.is_registration_open();
  v_elapsed_ms := extract(epoch FROM (clock_timestamp() - v_started)) * 1000;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'probe_ms', round(v_elapsed_ms::numeric, 1),
    'services', jsonb_build_array(
      jsonb_build_object('id', 'supabase', 'label', 'Supabase', 'status', 'green', 'last_run', now(), 'response_ms', round(v_elapsed_ms::numeric, 1), 'last_error', null, 'detail', 'RPC admin responde'),
      jsonb_build_object('id', 'realtime', 'label', 'Realtime', 'status', 'green', 'last_run', null, 'response_ms', null, 'last_error', null, 'detail', 'Canales activos en cliente'),
      jsonb_build_object('id', 'scheduler', 'label', 'Scheduler', 'status', CASE WHEN v_last_sync_status = 'ok' THEN 'green' WHEN v_last_sync IS NULL THEN 'yellow' ELSE 'red' END, 'last_run', v_last_sync, 'response_ms', null, 'last_error', CASE WHEN v_last_sync_status <> 'ok' THEN v_last_sync_status ELSE null END, 'detail', 'GitHub Actions sync'),
      jsonb_build_object('id', 'leaderboard', 'label', 'Leaderboard', 'status', CASE WHEN v_lb_count > 0 THEN 'green' ELSE 'yellow' END, 'last_run', null, 'response_ms', null, 'last_error', null, 'detail', format('%s entradas global', v_lb_count)),
      jsonb_build_object('id', 'invitations', 'label', 'Invitaciones', 'status', CASE WHEN v_reg_open THEN 'green' ELSE 'yellow' END, 'last_run', null, 'response_ms', null, 'last_error', null, 'detail', CASE WHEN v_reg_open THEN 'Registro abierto' ELSE 'Registro cerrado' END),
      jsonb_build_object('id', 'scoring', 'label', 'Scoring Engine', 'status', CASE WHEN v_last_score IS NOT NULL THEN 'green' ELSE 'yellow' END, 'last_run', v_last_score, 'response_ms', null, 'last_error', null, 'detail', 'score_match_predictions vía trigger/admin'),
      jsonb_build_object('id', 'football_api', 'label', 'API Football', 'status', CASE WHEN v_sync_err = 0 THEN 'green' WHEN v_sync_err < 3 THEN 'yellow' ELSE 'red' END, 'last_run', v_last_sync, 'response_ms', null, 'last_error', CASE WHEN v_sync_err > 0 THEN format('%s sync fallidos 24h', v_sync_err) ELSE null END, 'detail', 'data_sync_logs + activity_logs')
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Analytics overview (agregaciones ligeras)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_analytics_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registered int;
  v_active_today int;
  v_active_week int;
  v_active_month int;
  v_total_preds int;
  v_pending_preds int;
  v_users_with_preds int;
  v_top_users jsonb;
  v_top_matches jsonb;
  v_top_winners jsonb;
  v_top_scores jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT count(*) INTO v_registered FROM public.profiles WHERE deleted_at IS NULL;
  SELECT count(DISTINCT user_id) INTO v_active_today FROM public.activity_logs WHERE created_at >= date_trunc('day', now());
  SELECT count(DISTINCT user_id) INTO v_active_week FROM public.activity_logs WHERE created_at >= now() - interval '7 days';
  SELECT count(DISTINCT user_id) INTO v_active_month FROM public.activity_logs WHERE created_at >= now() - interval '30 days';
  SELECT count(*) INTO v_total_preds FROM public.predictions;
  SELECT count(*) INTO v_pending_preds FROM public.predictions WHERE status IN ('pending', 'locked');
  SELECT count(DISTINCT user_id) INTO v_users_with_preds FROM public.predictions;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.activity_count DESC), '[]'::jsonb)
  INTO v_top_users
  FROM (
    SELECT p.full_name, p.email, count(al.id)::int AS activity_count
    FROM public.activity_logs al
    JOIN public.profiles p ON p.id = al.user_id
    WHERE al.created_at >= now() - interval '30 days'
    GROUP BY p.id, p.full_name, p.email
    ORDER BY activity_count DESC
    LIMIT 10
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.prediction_count DESC), '[]'::jsonb)
  INTO v_top_matches
  FROM (
    SELECT m.id, ht.name AS home_team, at.name AS away_team, count(pr.id)::int AS prediction_count
    FROM public.predictions pr
    JOIN public.matches m ON m.id = pr.match_id
    LEFT JOIN public.teams ht ON ht.id = m.home_team_id
    LEFT JOIN public.teams at ON at.id = m.away_team_id
    GROUP BY m.id, ht.name, at.name
    ORDER BY prediction_count DESC
    LIMIT 10
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.pick_count DESC), '[]'::jsonb)
  INTO v_top_winners
  FROM (
    SELECT predicted_winner AS choice, count(*)::int AS pick_count
    FROM public.predictions
    WHERE predicted_winner IS NOT NULL
    GROUP BY predicted_winner
    ORDER BY pick_count DESC
    LIMIT 5
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.pick_count DESC), '[]'::jsonb)
  INTO v_top_scores
  FROM (
    SELECT
      format('%s-%s', predicted_score_home, predicted_score_away) AS scoreline,
      count(*)::int AS pick_count
    FROM public.predictions
    WHERE predicted_score_home IS NOT NULL AND predicted_score_away IS NOT NULL
    GROUP BY predicted_score_home, predicted_score_away
    ORDER BY pick_count DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'registered_users', v_registered,
    'active_today', v_active_today,
    'active_week', v_active_week,
    'active_month', v_active_month,
    'total_predictions', v_total_preds,
    'pending_predictions', v_pending_preds,
    'users_with_predictions', v_users_with_preds,
    'avg_predictions_per_user', round(v_total_preds::numeric / greatest(1, v_users_with_preds), 2),
    'participation_rate_pct', round((v_users_with_preds::numeric / greatest(1, v_registered)) * 100, 1),
    'top_active_users', v_top_users,
    'top_matches_by_predictions', v_top_matches,
    'top_winner_picks', v_top_winners,
    'top_scoreline_picks', v_top_scores
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Test users detail report
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_test_users_report()
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
        p.email,
        p.full_name,
        p.created_at,
        p.last_login_at,
        (SELECT max(al.created_at) FROM public.activity_logs al WHERE al.user_id = p.id) AS last_activity_at,
        (SELECT count(*)::int FROM public.predictions pr WHERE pr.user_id = p.id) AS predictions_count,
        coalesce((SELECT lb.points FROM public.leaderboard lb WHERE lb.user_id = p.id AND lb.period = 'global'), 0) AS total_points
      FROM public.profiles p
      WHERE p.deleted_at IS NULL
        AND p.role <> 'admin'
        AND public.is_test_user_email(p.email)
    ) u
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_get_scoring_center() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_score_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rescore_match(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recalculate_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_score_round(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_system_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_analytics_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_test_users_report() TO authenticated;
