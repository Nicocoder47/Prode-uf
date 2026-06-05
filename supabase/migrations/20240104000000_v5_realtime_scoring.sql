-- V5: standings, player_live_status, match_events view, scoring automático, bloqueo live

-- Tabla de posiciones (API-Football standings)
CREATE TABLE IF NOT EXISTS standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  group_label text,
  phase text NOT NULL DEFAULT 'group',
  rank integer NOT NULL,
  played integer NOT NULL DEFAULT 0,
  won integer NOT NULL DEFAULT 0,
  drawn integer NOT NULL DEFAULT 0,
  lost integer NOT NULL DEFAULT 0,
  goals_for integer NOT NULL DEFAULT 0,
  goals_against integer NOT NULL DEFAULT 0,
  goal_diff integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  provider text NOT NULL DEFAULT 'api_football',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, group_label, phase, provider)
);

-- Estado en vivo por jugador/partido
CREATE TABLE IF NOT EXISTS player_live_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  is_starting boolean NOT NULL DEFAULT false,
  is_substitute boolean NOT NULL DEFAULT false,
  is_substituted boolean NOT NULL DEFAULT false,
  minute_in integer,
  minute_out integer,
  goals integer NOT NULL DEFAULT 0,
  assists integer NOT NULL DEFAULT 0,
  yellow_cards integer NOT NULL DEFAULT 0,
  red_cards integer NOT NULL DEFAULT 0,
  rating numeric(4,2),
  xg numeric(5,2),
  xa numeric(5,2),
  shots integer NOT NULL DEFAULT 0,
  passes integer NOT NULL DEFAULT 0,
  tackles integer NOT NULL DEFAULT 0,
  market_value integer,
  last_updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);

-- Alias semántico requerido por V5 (events ya existe)
CREATE OR REPLACE VIEW match_events AS
SELECT
  id,
  match_id,
  provider,
  provider_event_id,
  event_type,
  event_data,
  event_time,
  created_at
FROM events;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS scored_at timestamptz;

-- Realtime: habilitar publicación en tablas clave
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE player_live_status;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE predictions;

-- Bloquear predicciones cuando el partido pasa a live
CREATE OR REPLACE FUNCTION public.lock_predictions_on_match_live()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IN ('live', 'halftime') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.matches SET is_locked = true, updated_at = now() WHERE id = NEW.id;
    UPDATE public.predictions
    SET status = 'locked', locked_at = now(), updated_at = now()
    WHERE match_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_predictions_on_live ON public.matches;
CREATE TRIGGER trg_lock_predictions_on_live
AFTER UPDATE OF status ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.lock_predictions_on_match_live();

-- Motor de puntuación automático
CREATE OR REPLACE FUNCTION public.score_match_predictions(p_match_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match RECORD;
  v_pred RECORD;
  v_first_scorer uuid;
  v_actual_result text;
  v_points integer;
  v_total_scored integer := 0;
  v_bonus_knockout integer := 0; -- configurable en futuro vía tabla app_settings
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

  IF v_match.score_home > v_match.score_away THEN
    v_actual_result := 'home';
  ELSIF v_match.score_home < v_match.score_away THEN
    v_actual_result := 'away';
  ELSE
    v_actual_result := 'draw';
  END IF;

  -- Primer goleador desde eventos (tipo Goal)
  SELECT (e.event_data->>'player_id')::uuid INTO v_first_scorer
  FROM public.events e
  WHERE e.match_id = p_match_id
    AND lower(e.event_type) IN ('goal', 'goal normal', 'penalty', 'own goal')
  ORDER BY e.event_time NULLS LAST, e.created_at
  LIMIT 1;

  FOR v_pred IN
    SELECT * FROM public.predictions
    WHERE match_id = p_match_id AND status IN ('pending', 'locked')
  LOOP
    v_points := 0;

    -- Marcador exacto = 5
    IF v_pred.predicted_score_home = v_match.score_home
       AND v_pred.predicted_score_away = v_match.score_away THEN
      v_points := v_points + 5;
    ELSIF v_pred.predicted_winner = v_actual_result THEN
      -- Resultado correcto = 3
      v_points := v_points + 3;
    END IF;

    -- Primer goleador = 2
    IF v_pred.predicted_first_scorer IS NOT NULL
       AND v_first_scorer IS NOT NULL
       AND v_pred.predicted_first_scorer = v_first_scorer THEN
      v_points := v_points + 2;
    END IF;

    -- MVP = 2
    IF v_pred.predicted_mvp IS NOT NULL
       AND v_match.mvp_player_id IS NOT NULL
       AND v_pred.predicted_mvp = v_match.mvp_player_id THEN
      v_points := v_points + 2;
    END IF;

    -- Bonus eliminatorias (configurable vía app setting futuro)
    IF v_match.phase IS NOT NULL AND v_match.phase ILIKE '%knockout%' THEN
      v_points := v_points + v_bonus_knockout;
    END IF;

    UPDATE public.predictions
    SET points = v_points,
        status = 'scored',
        scored_at = now(),
        updated_at = now()
    WHERE id = v_pred.id;

    -- Actualizar leaderboard (periodo global)
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

  -- Recalcular ranks
  WITH ranked AS (
    SELECT user_id,
           ROW_NUMBER() OVER (ORDER BY points DESC, updated_at ASC) AS new_rank
    FROM public.leaderboard
    WHERE period = 'global'
  )
  UPDATE public.leaderboard l
  SET rank = r.new_rank
  FROM ranked r
  WHERE l.user_id = r.user_id AND l.period = 'global';

  UPDATE public.matches SET scored_at = now(), updated_at = now() WHERE id = p_match_id;

  RETURN v_total_scored;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_score_finished_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'finished'
     AND (OLD.status IS DISTINCT FROM 'finished')
     AND NEW.scored_at IS NULL THEN
    PERFORM public.score_match_predictions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_finished_match ON public.matches;
CREATE TRIGGER trg_score_finished_match
AFTER UPDATE OF status, score_home, score_away ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.trigger_score_finished_match();

-- RLS nuevas tablas
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY standings_select ON standings FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY standings_admin ON standings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE player_live_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_live_status_select ON player_live_status FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY player_live_status_admin ON player_live_status FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Reforzar: usuarios no pueden editar puntos ni rankings
DROP POLICY IF EXISTS predictions_owner_update ON predictions;
CREATE POLICY predictions_owner_update ON predictions FOR UPDATE
USING ((auth.uid() = user_id AND status = 'pending') OR public.is_admin())
WITH CHECK ((auth.uid() = user_id AND status = 'pending') OR public.is_admin());

DROP POLICY IF EXISTS leaderboard_admin ON leaderboard;
CREATE POLICY leaderboard_select_only ON leaderboard FOR SELECT USING (true);
CREATE POLICY leaderboard_admin_write ON leaderboard FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
