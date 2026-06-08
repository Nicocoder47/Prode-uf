-- Production hardening: prediction gates, rescore on admin correction, anti double-scoring

CREATE OR REPLACE FUNCTION public.match_result_from_scores(p_home integer, p_away integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_home IS NULL OR p_away IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_home > p_away THEN
    RETURN 'home';
  ELSIF p_home < p_away THEN
    RETURN 'away';
  END IF;
  RETURN 'draw';
END;
$$;

-- Usuario solo puede predecir partidos scheduled, no bloqueados y antes del kickoff
CREATE OR REPLACE FUNCTION public.can_submit_prediction(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND m.status = 'scheduled'
      AND COALESCE(m.is_locked, false) = false
      AND m.kick_off > now()
  );
$$;

DROP POLICY IF EXISTS predictions_insert ON public.predictions;
CREATE POLICY predictions_insert ON public.predictions
  FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id AND public.can_submit_prediction(match_id))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS predictions_owner_update ON public.predictions;
CREATE POLICY predictions_owner_update ON public.predictions
  FOR UPDATE
  USING ((auth.uid() = user_id AND status = 'pending') OR public.is_admin())
  WITH CHECK (
    (auth.uid() = user_id AND status = 'pending' AND public.can_submit_prediction(match_id))
    OR public.is_admin()
  );

-- Re-puntuar si un admin corrige el marcador de un partido ya scored
CREATE OR REPLACE FUNCTION public.rescore_match_predictions(
  p_match_id uuid,
  p_old_score_home integer,
  p_old_score_away integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_pred RECORD;
  v_old_result text;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF v_match IS NULL OR v_match.status <> 'finished' THEN
    RETURN 0;
  END IF;
  IF v_match.scored_at IS NULL THEN
    RETURN 0;
  END IF;
  IF v_match.score_home IS NULL OR v_match.score_away IS NULL THEN
    RETURN 0;
  END IF;

  v_old_result := public.match_result_from_scores(p_old_score_home, p_old_score_away);

  FOR v_pred IN
    SELECT * FROM public.predictions
    WHERE match_id = p_match_id AND status = 'scored'
  LOOP
    UPDATE public.leaderboard
    SET
      points = GREATEST(0, points - COALESCE(v_pred.points, 0)),
      wins = GREATEST(0, wins - CASE WHEN v_old_result = 'home' THEN 1 ELSE 0 END),
      draws = GREATEST(0, draws - CASE WHEN v_old_result = 'draw' THEN 1 ELSE 0 END),
      losses = GREATEST(0, losses - CASE WHEN v_old_result = 'away' THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE user_id = v_pred.user_id AND period = 'global';

    UPDATE public.predictions
    SET points = 0,
        status = 'locked',
        scored_at = NULL,
        updated_at = now()
    WHERE id = v_pred.id;
  END LOOP;

  UPDATE public.matches
  SET scored_at = NULL, updated_at = now()
  WHERE id = p_match_id;

  RETURN public.score_match_predictions(p_match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_rescore_on_result_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finished'
     AND OLD.status = 'finished'
     AND NEW.scored_at IS NOT NULL
     AND (
       OLD.score_home IS DISTINCT FROM NEW.score_home
       OR OLD.score_away IS DISTINCT FROM NEW.score_away
     ) THEN
    PERFORM public.rescore_match_predictions(NEW.id, OLD.score_home, OLD.score_away);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rescore_on_result_change ON public.matches;
CREATE TRIGGER trg_rescore_on_result_change
AFTER UPDATE OF score_home, score_away ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.trigger_rescore_on_result_change();

-- Refuerzo: trigger de scoring solo si aún no fue puntuado
CREATE OR REPLACE FUNCTION public.trigger_score_finished_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finished'
     AND (OLD.status IS DISTINCT FROM 'finished')
     AND NEW.scored_at IS NULL
     AND NEW.score_home IS NOT NULL
     AND NEW.score_away IS NOT NULL THEN
    PERFORM public.score_match_predictions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
