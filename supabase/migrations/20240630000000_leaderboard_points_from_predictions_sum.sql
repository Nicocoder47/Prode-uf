-- Evita inflar leaderboard.points: total = SUM(predictions) por usuario, no acumulado incremental.

CREATE OR REPLACE FUNCTION public.sync_user_leaderboard_points(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  SELECT coalesce(sum(p.points), 0)::int
  INTO v_total
  FROM public.predictions p
  WHERE p.user_id = p_user_id
    AND p.status = 'scored';

  INSERT INTO public.leaderboard (user_id, period, rank, points, wins, draws, losses, updated_at)
  VALUES (p_user_id, 'global', 1, v_total, 0, 0, 0, now())
  ON CONFLICT (user_id, period) DO UPDATE SET
    points = EXCLUDED.points,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.score_match_predictions(p_match_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_pred public.predictions%ROWTYPE;
  v_actual_result text;
  v_points integer;
  v_total_scored integer := 0;
  v_rows_updated integer;
  v_synced_users uuid[] := '{}';
  v_uid uuid;
BEGIN
  PERFORM public.assert_internal_scoring_caller();

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.id IS NULL OR v_match.status <> 'finished' THEN
    RETURN 0;
  END IF;

  IF v_match.scored_at IS NOT NULL THEN
    RETURN 0;
  END IF;

  IF v_match.score_home IS NULL OR v_match.score_away IS NULL THEN
    RETURN 0;
  END IF;

  v_actual_result := public.match_result_from_scores(v_match.score_home, v_match.score_away);

  FOR v_pred IN
    SELECT *
    FROM public.predictions
    WHERE match_id = p_match_id
      AND status IN ('pending', 'locked')
      AND scored_at IS NULL
    FOR UPDATE
  LOOP
    v_points := public.compute_prediction_points(v_pred, v_match);

    UPDATE public.predictions
    SET
      points = v_points,
      status = 'scored',
      scored_at = now(),
      updated_at = now()
    WHERE id = v_pred.id
      AND status IN ('pending', 'locked')
      AND scored_at IS NULL;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.leaderboard (user_id, period, rank, points, wins, draws, losses, updated_at)
    VALUES (
      v_pred.user_id,
      'global',
      1,
      v_points,
      CASE WHEN v_actual_result = 'home' AND v_match.home_team_id IS NOT NULL THEN 1 ELSE 0 END,
      CASE WHEN v_actual_result = 'draw' THEN 1 ELSE 0 END,
      CASE WHEN v_actual_result = 'away' AND v_match.away_team_id IS NOT NULL THEN 1 ELSE 0 END,
      now()
    )
    ON CONFLICT (user_id, period) DO UPDATE SET
      wins = public.leaderboard.wins + EXCLUDED.wins,
      draws = public.leaderboard.draws + EXCLUDED.draws,
      losses = public.leaderboard.losses + EXCLUDED.losses,
      updated_at = now();

    v_synced_users := array_append(v_synced_users, v_pred.user_id);
    v_total_scored := v_total_scored + 1;
  END LOOP;

  IF array_length(v_synced_users, 1) IS NOT NULL THEN
    FOREACH v_uid IN ARRAY v_synced_users
    LOOP
      PERFORM public.sync_user_leaderboard_points(v_uid);
    END LOOP;
  END IF;

  IF v_total_scored > 0 THEN
    WITH ranked AS (
      SELECT
        user_id,
        ROW_NUMBER() OVER (ORDER BY points DESC, updated_at ASC) AS new_rank
      FROM public.leaderboard
      WHERE period = 'global'
    )
    UPDATE public.leaderboard lb
    SET rank = r.new_rank
    FROM ranked r
    WHERE lb.user_id = r.user_id
      AND lb.period = 'global';

    UPDATE public.matches
    SET scored_at = now(), updated_at = now()
    WHERE id = p_match_id
      AND scored_at IS NULL;
  END IF;

  RETURN v_total_scored;
END;
$$;

-- Rebuild one-shot al aplicar migración
DO $$
DECLARE
  v_rebuilt int;
BEGIN
  WITH agg AS (
    SELECT p.user_id, coalesce(sum(p.points), 0)::int AS total_points
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
      coalesce(lb.wins, 0),
      coalesce(lb.draws, 0),
      coalesce(lb.losses, 0),
      now()
    FROM agg a
    LEFT JOIN public.leaderboard lb ON lb.user_id = a.user_id AND lb.period = 'global'
    ON CONFLICT (user_id, period) DO UPDATE SET
      points = EXCLUDED.points,
      updated_at = now()
    RETURNING user_id
  )
  SELECT count(*)::int INTO v_rebuilt FROM upserted;

  DELETE FROM public.leaderboard lb
  WHERE lb.period = 'global'
    AND NOT EXISTS (
      SELECT 1 FROM public.predictions p
      WHERE p.user_id = lb.user_id AND p.status = 'scored'
    );

  PERFORM public.admin_recalculate_leaderboard_ranks();
END;
$$;
