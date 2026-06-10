-- Bloqueo definitivo de scoring prematuro en RPCs admin
-- NO modifica score_match_predictions, rescore_match_predictions ni reglas de puntaje

-- ---------------------------------------------------------------------------
-- 1. Helper: predicciones scored en partidos no finalizados
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_orphan_scored_predictions()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT jsonb_build_object(
        'count', count(*)::int,
        'cases', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'prediction_id', p.id,
              'user_id', p.user_id,
              'match_id', p.match_id,
              'match_status', m.status,
              'points', p.points,
              'email', pr.email,
              'full_name', pr.full_name,
              'home_team', ht.name,
              'away_team', at.name,
              'kick_off', m.kick_off
            )
            ORDER BY p.scored_at DESC NULLS LAST
          ),
          '[]'::jsonb
        )
      )
      FROM public.predictions p
      JOIN public.matches m ON m.id = p.match_id
      LEFT JOIN public.profiles pr ON pr.id = p.user_id
      LEFT JOIN public.teams ht ON ht.id = m.home_team_id
      LEFT JOIN public.teams at ON at.id = m.away_team_id
      WHERE p.status = 'scored'
        AND m.status <> 'finished'
    ),
    jsonb_build_object('count', 0, 'cases', '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. admin_score_match — bloqueo obligatorio finished
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
  v_match public.matches%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_match_id IS NULL THEN RAISE EXCEPTION 'match_id_required'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  IF v_match.status <> 'finished' THEN
    RAISE EXCEPTION 'match_not_finished'
      USING HINT = 'No se puede puntuar un partido que no está finalizado.';
  END IF;

  IF v_match.score_home IS NULL OR v_match.score_away IS NULL THEN
    RAISE EXCEPTION 'match_result_missing'
      USING HINT = 'El partido finalizado debe tener marcador completo.';
  END IF;

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

-- ---------------------------------------------------------------------------
-- 3. admin_rescore_match — mismo bloqueo
-- ---------------------------------------------------------------------------
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
  v_match public.matches%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_match_id IS NULL THEN RAISE EXCEPTION 'match_id_required'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  IF v_match.status <> 'finished' THEN
    RAISE EXCEPTION 'match_not_finished'
      USING HINT = 'No se puede puntuar un partido que no está finalizado.';
  END IF;

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

-- ---------------------------------------------------------------------------
-- 4. admin_get_scoring_center — incluir alerta huérfanas
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
  v_orphans jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_orphans := public.admin_get_orphan_scored_predictions();

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
    WHERE m.status IN ('scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled')
    ORDER BY m.kick_off DESC NULLS LAST
    LIMIT 120
  ) x;

  RETURN jsonb_build_object(
    'last_score_at', v_last_score,
    'last_rescore_at', v_last_rescore,
    'orphan_scored', v_orphans,
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
-- 5. admin_get_system_health — check huérfanas
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
  v_orphans jsonb;
  v_orphan_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_orphans := public.admin_get_orphan_scored_predictions();
  v_orphan_count := coalesce((v_orphans->>'count')::int, 0);

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
    'orphan_scored', v_orphans,
    'services', jsonb_build_array(
      jsonb_build_object('id', 'supabase', 'label', 'Supabase', 'status', 'green', 'last_run', now(), 'response_ms', round(v_elapsed_ms::numeric, 1), 'last_error', null, 'detail', 'RPC admin responde'),
      jsonb_build_object('id', 'realtime', 'label', 'Realtime', 'status', 'green', 'last_run', null, 'response_ms', null, 'last_error', null, 'detail', 'Canales activos en cliente'),
      jsonb_build_object('id', 'scheduler', 'label', 'Scheduler', 'status', CASE WHEN v_last_sync_status = 'ok' THEN 'green' WHEN v_last_sync IS NULL THEN 'yellow' ELSE 'red' END, 'last_run', v_last_sync, 'response_ms', null, 'last_error', CASE WHEN v_last_sync_status <> 'ok' THEN v_last_sync_status ELSE null END, 'detail', 'GitHub Actions sync'),
      jsonb_build_object('id', 'leaderboard', 'label', 'Leaderboard', 'status', CASE WHEN v_lb_count > 0 THEN 'green' ELSE 'yellow' END, 'last_run', null, 'response_ms', null, 'last_error', null, 'detail', format('%s entradas global', v_lb_count)),
      jsonb_build_object('id', 'invitations', 'label', 'Invitaciones', 'status', CASE WHEN v_reg_open THEN 'green' ELSE 'yellow' END, 'last_run', null, 'response_ms', null, 'last_error', null, 'detail', CASE WHEN v_reg_open THEN 'Registro abierto' ELSE 'Registro cerrado' END),
      jsonb_build_object(
        'id', 'scoring_integrity',
        'label', 'Integridad scoring',
        'status', CASE WHEN v_orphan_count > 0 THEN 'red' ELSE 'green' END,
        'last_run', v_last_score,
        'response_ms', null,
        'last_error', CASE WHEN v_orphan_count > 0 THEN format('%s predicciones puntuadas en partidos no finalizados', v_orphan_count) ELSE null END,
        'detail', CASE WHEN v_orphan_count > 0 THEN 'Hay predicciones puntuadas en partidos no finalizados.' ELSE 'Sin predicciones huérfanas' END
      ),
      jsonb_build_object('id', 'scoring', 'label', 'Scoring Engine', 'status', CASE WHEN v_last_score IS NOT NULL THEN 'green' ELSE 'yellow' END, 'last_run', v_last_score, 'response_ms', null, 'last_error', null, 'detail', 'score_match_predictions vía trigger/admin'),
      jsonb_build_object('id', 'football_api', 'label', 'API Football', 'status', CASE WHEN v_sync_err = 0 THEN 'green' WHEN v_sync_err < 3 THEN 'yellow' ELSE 'red' END, 'last_run', v_last_sync, 'response_ms', null, 'last_error', CASE WHEN v_sync_err > 0 THEN format('%s sync fallidos 24h', v_sync_err) ELSE null END, 'detail', 'data_sync_logs + activity_logs')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_orphan_scored_predictions() TO authenticated;
