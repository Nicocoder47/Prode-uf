-- Fix: score_match_predictions pasaba RECORD genérico a compute_prediction_points(predictions, matches)
-- Error en cloud: "cannot cast type record to predictions" — bloqueaba UPDATE status→finished y el sync.

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
