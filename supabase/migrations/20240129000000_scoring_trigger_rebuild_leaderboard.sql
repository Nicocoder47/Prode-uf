-- Beta pre-launch: trigger scoring en updates posteriores, rebuild leaderboard, alerta stale pending
-- NO modifica score_match_predictions, rescore_match_predictions, save_prediction, auth, RLS ni reglas de puntaje

-- ---------------------------------------------------------------------------
-- 1. Trigger: puntuar si finished + marcador completo aunque el status ya era finished
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_score_finished_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finished'
     AND NEW.scored_at IS NULL
     AND NEW.score_home IS NOT NULL
     AND NEW.score_away IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM 'finished'
       OR OLD.score_home IS NULL
       OR OLD.score_away IS NULL
       OR OLD.score_home IS DISTINCT FROM NEW.score_home
       OR OLD.score_away IS DISTINCT FROM NEW.score_away
     ) THEN
    PERFORM public.score_match_predictions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Partidos finished con marcador pero sin scored_at hace > 5 minutos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_stale_pending_scoring()
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
              'match_id', m.id,
              'status', m.status,
              'score_home', m.score_home,
              'score_away', m.score_away,
              'kick_off', m.kick_off,
              'updated_at', m.updated_at,
              'stale_minutes', round(extract(epoch FROM (now() - m.updated_at)) / 60.0, 1),
              'home_team', ht.name,
              'away_team', at.name,
              'predictions_total', (
                SELECT count(*)::int FROM public.predictions p WHERE p.match_id = m.id
              )
            )
            ORDER BY m.updated_at ASC
          ),
          '[]'::jsonb
        )
      )
      FROM public.matches m
      LEFT JOIN public.teams ht ON ht.id = m.home_team_id
      LEFT JOIN public.teams at ON at.id = m.away_team_id
      WHERE m.status = 'finished'
        AND m.score_home IS NOT NULL
        AND m.score_away IS NOT NULL
        AND m.scored_at IS NULL
        AND m.updated_at < now() - interval '5 minutes'
    ),
    jsonb_build_object('count', 0, 'cases', '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Rebuild leaderboard desde SUM(predictions.points) WHERE status = 'scored'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_rebuild_leaderboard_from_predictions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_rebuilt int := 0;
  v_removed int := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH agg AS (
    SELECT
      p.user_id,
      coalesce(sum(p.points), 0)::int AS total_points
    FROM public.predictions p
    WHERE p.status = 'scored'
    GROUP BY p.user_id
  ),
  upserted AS (
    INSERT INTO public.leaderboard (user_id, period, rank, points, wins, draws, losses, updated_at)
    SELECT
      a.user_id,
      'global',
      1,
      a.total_points,
      lb.wins,
      lb.draws,
      lb.losses,
      now()
    FROM agg a
    LEFT JOIN public.leaderboard lb
      ON lb.user_id = a.user_id AND lb.period = 'global'
    ON CONFLICT (user_id, period) DO UPDATE SET
      points = EXCLUDED.points,
      updated_at = now()
    RETURNING user_id
  )
  SELECT count(*)::int INTO v_rebuilt FROM upserted;

  DELETE FROM public.leaderboard lb
  WHERE lb.period = 'global'
    AND NOT EXISTS (
      SELECT 1
      FROM public.predictions p
      WHERE p.user_id = lb.user_id
        AND p.status = 'scored'
    );
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  PERFORM public.admin_recalculate_leaderboard_ranks();

  PERFORM public.insert_activity_log(
    NULL, v_actor, 'score_calculated',
    'Leaderboard reconstruido',
    format('Rebuild desde predictions: %s usuarios actualizados, %s filas eliminadas', v_rebuilt, v_removed),
    jsonb_build_object('action', 'rebuild_leaderboard', 'users_rebuilt', v_rebuilt, 'rows_removed', v_removed)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'users_rebuilt', v_rebuilt,
    'rows_removed', v_removed
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. admin_get_scoring_center — incluir alerta stale pending scoring
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
  v_stale jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_orphans := public.admin_get_orphan_scored_predictions();
  v_stale := public.admin_get_stale_pending_scoring();

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
    'stale_pending_scoring', v_stale,
    'summary', (
      SELECT jsonb_build_object(
        'pending_scoring', count(*) FILTER (WHERE scoring_status = 'pending_scoring'),
        'scored', count(*) FILTER (WHERE scoring_status = 'scored'),
        'live', count(*) FILTER (WHERE scoring_status = 'live'),
        'scheduled', count(*) FILTER (WHERE scoring_status = 'scheduled'),
        'errors', count(*) FILTER (WHERE scoring_status NOT IN ('pending_scoring','scored','live','scheduled')),
        'stale_pending_scoring', coalesce((v_stale->>'count')::int, 0)
      )
      FROM jsonb_to_recordset(v_matches) AS t(scoring_status text)
    ),
    'matches', v_matches
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_get_stale_pending_scoring() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rebuild_leaderboard_from_predictions() TO authenticated;
