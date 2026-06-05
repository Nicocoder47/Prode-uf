-- Fase A: MVP fallback desde ratings + snapshots de sistema + heartbeat worker

CREATE TABLE IF NOT EXISTS system_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_snapshots_type_created
  ON system_snapshots (snapshot_type, created_at DESC);

ALTER TABLE system_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_snapshots_admin ON system_snapshots;
CREATE POLICY system_snapshots_admin ON system_snapshots
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS system_snapshots_service ON system_snapshots;
CREATE POLICY system_snapshots_service ON system_snapshots
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Resuelve MVP desde player_ratings (mejor rating del partido) si no hay dato oficial
CREATE OR REPLACE FUNCTION public.resolve_match_mvp_from_ratings(p_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_id uuid;
BEGIN
  SELECT pr.player_id INTO v_player_id
  FROM public.player_ratings pr
  WHERE pr.match_id = p_match_id
    AND pr.rating IS NOT NULL
    AND pr.rating > 0
  ORDER BY pr.rating DESC, pr.minutes_played DESC NULLS LAST, pr.goals DESC
  LIMIT 1;

  IF v_player_id IS NOT NULL THEN
    UPDATE public.matches
    SET mvp_player_id = v_player_id, updated_at = now()
    WHERE id = p_match_id AND mvp_player_id IS NULL;
  END IF;

  RETURN v_player_id;
END;
$$;

-- Motor de scoring: MVP fallback antes de puntuar
CREATE OR REPLACE FUNCTION public.score_match_predictions(p_match_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match RECORD;
  v_pred RECORD;
  v_first_scorer uuid;
  v_actual_result text;
  v_points integer;
  v_total_scored integer := 0;
  v_bonus_knockout integer := 0;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF v_match IS NULL OR v_match.status <> 'finished' THEN
    RETURN 0;
  END IF;
  IF v_match.scored_at IS NOT NULL THEN
    RETURN 0;
  END IF;

  IF v_match.score_home IS NULL OR v_match.score_away IS NULL THEN
    RETURN 0;
  END IF;

  IF v_match.mvp_player_id IS NULL THEN
    PERFORM public.resolve_match_mvp_from_ratings(p_match_id);
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  END IF;

  IF v_match.score_home > v_match.score_away THEN
    v_actual_result := 'home';
  ELSIF v_match.score_home < v_match.score_away THEN
    v_actual_result := 'away';
  ELSE
    v_actual_result := 'draw';
  END IF;

  SELECT (e.event_data->>'player_id')::uuid INTO v_first_scorer
  FROM public.events e
  WHERE e.match_id = p_match_id
    AND lower(e.event_type) IN ('goal', 'goal normal', 'penalty', 'own goal')
    AND (e.event_data->>'player_id') IS NOT NULL
    AND (e.event_data->>'player_id') ~* '^[0-9a-f-]{36}$'
  ORDER BY e.event_time NULLS LAST, e.created_at
  LIMIT 1;

  FOR v_pred IN
    SELECT * FROM public.predictions
    WHERE match_id = p_match_id AND status IN ('pending', 'locked')
  LOOP
    v_points := 0;

    IF v_pred.predicted_score_home = v_match.score_home
       AND v_pred.predicted_score_away = v_match.score_away THEN
      v_points := v_points + 5;
    ELSIF v_pred.predicted_winner = v_actual_result THEN
      v_points := v_points + 3;
    END IF;

    IF v_pred.predicted_first_scorer IS NOT NULL
       AND v_first_scorer IS NOT NULL
       AND v_pred.predicted_first_scorer = v_first_scorer THEN
      v_points := v_points + 2;
    END IF;

    IF v_pred.predicted_mvp IS NOT NULL
       AND v_match.mvp_player_id IS NOT NULL
       AND v_pred.predicted_mvp = v_match.mvp_player_id THEN
      v_points := v_points + 2;
    END IF;

    IF v_match.phase IS NOT NULL AND v_match.phase ILIKE '%knockout%' THEN
      v_points := v_points + v_bonus_knockout;
    END IF;

    UPDATE public.predictions
    SET points = v_points,
        status = 'scored',
        scored_at = now(),
        updated_at = now()
    WHERE id = v_pred.id;

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
      points = public.leaderboard.points + EXCLUDED.points,
      wins = public.leaderboard.wins + EXCLUDED.wins,
      draws = public.leaderboard.draws + EXCLUDED.draws,
      losses = public.leaderboard.losses + EXCLUDED.losses,
      updated_at = now();

    v_total_scored := v_total_scored + 1;
  END LOOP;

  WITH ranked AS (
    SELECT user_id,
           ROW_NUMBER() OVER (ORDER BY points DESC, updated_at ASC) AS new_rank
    FROM public.leaderboard
    WHERE period = 'global'
  )
  UPDATE public.leaderboard lb
  SET rank = r.new_rank
  FROM ranked r
  WHERE lb.user_id = r.user_id AND lb.period = 'global';

  UPDATE public.matches SET scored_at = now(), updated_at = now() WHERE id = p_match_id;

  RETURN v_total_scored;
END;
$$;
