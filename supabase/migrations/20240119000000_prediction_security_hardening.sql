-- Blindaje producción: save_prediction RPC, RLS estricto, scoring idempotente, índices

-- ---------------------------------------------------------------------------
-- 1. Índices de soporte (UNIQUE user_id+match_id ya existe desde schema inicial)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON public.predictions (user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON public.predictions (match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match_status ON public.predictions (match_id, status);

-- ---------------------------------------------------------------------------
-- 2. Eliminar duplicados históricos sin borrar datos válidos (conserva el más reciente)
-- ---------------------------------------------------------------------------
DELETE FROM public.predictions p
WHERE p.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, match_id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM public.predictions
  ) ranked
  WHERE ranked.rn > 1
);

-- ---------------------------------------------------------------------------
-- 3. Restricciones de integridad en marcadores
-- ---------------------------------------------------------------------------
ALTER TABLE public.predictions
  DROP CONSTRAINT IF EXISTS predictions_scores_valid;

ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_scores_valid
  CHECK (
    predicted_score_home IS NULL
    OR (
      predicted_score_home >= 0
      AND predicted_score_home <= 99
      AND predicted_score_away >= 0
      AND predicted_score_away <= 99
    )
  );

-- ---------------------------------------------------------------------------
-- 4. can_submit_prediction (restaurar uso en RLS y RPC)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5. RPC save_prediction — toda la lógica de negocio en la base
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_prediction(
  p_match_id uuid,
  p_score_home integer,
  p_score_away integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pred public.predictions%ROWTYPE;
  v_winner text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'match_id_required';
  END IF;

  IF p_score_home IS NULL OR p_score_away IS NULL THEN
    RAISE EXCEPTION 'invalid_scores';
  END IF;

  IF p_score_home < 0 OR p_score_away < 0 OR p_score_home > 99 OR p_score_away > 99 THEN
    RAISE EXCEPTION 'invalid_scores';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.is_active = true
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'account_inactive';
  END IF;

  IF NOT public.can_submit_prediction(p_match_id) THEN
    RAISE EXCEPTION 'predictions_closed';
  END IF;

  SELECT *
  INTO v_pred
  FROM public.predictions
  WHERE user_id = v_uid
    AND match_id = p_match_id;

  IF FOUND AND v_pred.status <> 'pending' THEN
    RAISE EXCEPTION 'prediction_locked';
  END IF;

  v_winner := public.match_result_from_scores(p_score_home, p_score_away);

  IF FOUND THEN
    UPDATE public.predictions
    SET
      predicted_winner = v_winner,
      predicted_score_home = p_score_home,
      predicted_score_away = p_score_away,
      predicted_first_scorer = NULL,
      predicted_mvp = NULL,
      status = 'pending',
      points = 0,
      scored_at = NULL,
      updated_at = now()
    WHERE user_id = v_uid
      AND match_id = p_match_id
      AND status = 'pending'
    RETURNING * INTO v_pred;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'prediction_locked';
    END IF;
  ELSE
    INSERT INTO public.predictions (
      user_id,
      match_id,
      predicted_winner,
      predicted_score_home,
      predicted_score_away,
      predicted_first_scorer,
      predicted_mvp,
      status,
      points,
      updated_at
    )
    VALUES (
      v_uid,
      p_match_id,
      v_winner,
      p_score_home,
      p_score_away,
      NULL,
      NULL,
      'pending',
      0,
      now()
    )
    RETURNING * INTO v_pred;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'prediction', jsonb_build_object(
      'id', v_pred.id,
      'user_id', v_pred.user_id,
      'match_id', v_pred.match_id,
      'predicted_winner', v_pred.predicted_winner,
      'predicted_score_home', v_pred.predicted_score_home,
      'predicted_score_away', v_pred.predicted_score_away,
      'status', v_pred.status,
      'points', v_pred.points,
      'created_at', v_pred.created_at,
      'updated_at', v_pred.updated_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_prediction(uuid, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS predictions — usuarios solo lectura; escritura vía RPC SECURITY DEFINER
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS predictions_insert ON public.predictions;
DROP POLICY IF EXISTS predictions_owner_update ON public.predictions;

CREATE POLICY predictions_insert ON public.predictions
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY predictions_owner_update ON public.predictions
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SELECT y DELETE permanecen: owner/admin (políticas existentes)

-- ---------------------------------------------------------------------------
-- 7. Leaderboard: lectura pública; escritura solo admin / funciones internas
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS leaderboard_select ON public.leaderboard;
DROP POLICY IF EXISTS leaderboard_admin ON public.leaderboard;
DROP POLICY IF EXISTS leaderboard_select_only ON public.leaderboard;
DROP POLICY IF EXISTS leaderboard_admin_write ON public.leaderboard;

CREATE POLICY leaderboard_select_only ON public.leaderboard
  FOR SELECT
  USING (true);

CREATE POLICY leaderboard_admin_write ON public.leaderboard
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Perfiles visibles en ranking (join del cliente)
DROP POLICY IF EXISTS profiles_leaderboard_select ON public.profiles;
CREATE POLICY profiles_leaderboard_select ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.leaderboard lb
      WHERE lb.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- 8. score_match_predictions — idempotente, con bloqueo de filas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.score_match_predictions(p_match_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_pred RECORD;
  v_actual_result text;
  v_points integer;
  v_total_scored integer := 0;
  v_bonus_knockout integer := 0;
  v_rows_updated integer;
BEGIN
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match IS NULL OR v_match.status <> 'finished' THEN
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
    v_points := 0;

    IF v_pred.predicted_score_home = v_match.score_home
       AND v_pred.predicted_score_away = v_match.score_away THEN
      v_points := 5;
    ELSIF v_pred.predicted_winner = v_actual_result THEN
      v_points := 3;
    END IF;

    IF v_match.phase IS NOT NULL AND v_match.phase ILIKE '%knockout%' THEN
      v_points := v_points + v_bonus_knockout;
    END IF;

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
      points = public.leaderboard.points + EXCLUDED.points,
      wins = public.leaderboard.wins + EXCLUDED.wins,
      draws = public.leaderboard.draws + EXCLUDED.draws,
      losses = public.leaderboard.losses + EXCLUDED.losses,
      updated_at = now();

    v_total_scored := v_total_scored + 1;
  END LOOP;

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

  RETURN v_total_scored;
END;
$$;
