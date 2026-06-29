-- Alargue como marcador SEPARADO (solo tiempo suplementario), no acumulado.

COMMENT ON COLUMN predictions.predicted_et_score_home IS 'Goles del local SOLO en tiempo suplementario (no acumulado).';
COMMENT ON COLUMN predictions.predicted_et_score_away IS 'Goles del visitante SOLO en tiempo suplementario (no acumulado).';

CREATE OR REPLACE FUNCTION public.compute_prediction_points(
  p_pred public.predictions,
  p_match public.matches
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_points integer := 0;
  v_pred_90 text;
  v_actual_90 text;
  v_knockout boolean;
  v_match_had_et boolean;
  v_match_had_pen boolean;
  v_pen_winner text;
  v_actual_et_home integer;
  v_actual_et_away integer;
BEGIN
  IF p_match.score_home IS NULL OR p_match.score_away IS NULL THEN
    RETURN 0;
  END IF;

  v_knockout := public.is_knockout_match(p_match.group_label, p_match.phase);
  v_pred_90 := public.match_result_from_scores(p_pred.predicted_score_home, p_pred.predicted_score_away);
  v_actual_90 := public.match_result_from_scores(p_match.score_home, p_match.score_away);

  v_pen_winner := public.penalty_winner_from_match(p_match.score_home_penalties, p_match.score_away_penalties);
  v_match_had_pen := v_pen_winner IS NOT NULL;

  v_match_had_et :=
    p_match.score_home_after_et IS NOT NULL
    AND p_match.score_away_after_et IS NOT NULL
    AND (
      p_match.score_home_after_et <> p_match.score_home
      OR p_match.score_away_after_et <> p_match.score_away
      OR v_match_had_pen
    );

  IF v_match_had_et THEN
    v_actual_et_home := p_match.score_home_after_et - p_match.score_home;
    v_actual_et_away := p_match.score_away_after_et - p_match.score_away;
  END IF;

  IF v_knockout THEN
    IF v_pred_90 = v_actual_90 THEN
      v_points := 5;
    END IF;

    IF v_match_had_et
       AND p_pred.predicted_et_score_home IS NOT NULL
       AND p_pred.predicted_et_score_away IS NOT NULL
       AND p_pred.predicted_et_score_home = v_actual_et_home
       AND p_pred.predicted_et_score_away = v_actual_et_away THEN
      v_points := v_points + 3;
    END IF;

    IF v_match_had_pen
       AND p_pred.predicted_penalty_winner IS NOT NULL
       AND p_pred.predicted_penalty_winner = v_pen_winner THEN
      v_points := v_points + 2;
    END IF;
  ELSE
    IF p_pred.predicted_score_home = p_match.score_home
       AND p_pred.predicted_score_away = p_match.score_away THEN
      v_points := 5;
    ELSIF v_pred_90 = v_actual_90 THEN
      v_points := 3;
    END IF;
  END IF;

  RETURN v_points;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_prediction(
  p_match_id uuid,
  p_score_home integer,
  p_score_away integer,
  p_et_score_home integer DEFAULT NULL,
  p_et_score_away integer DEFAULT NULL,
  p_penalty_winner text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pred public.predictions%ROWTYPE;
  v_match public.matches%ROWTYPE;
  v_winner text;
  v_knockout boolean;
  v_et_winner text;
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

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND coalesce(p.must_change_password, false) = true
  ) THEN
    RAISE EXCEPTION 'password_change_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.is_active = true
      AND p.deleted_at IS NULL
      AND coalesce(p.is_blocked, false) = false
  ) THEN
    RAISE EXCEPTION 'account_inactive';
  END IF;

  SELECT *
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.status <> 'scheduled' OR COALESCE(v_match.is_locked, false) = true THEN
    RAISE EXCEPTION 'predictions_closed';
  END IF;

  IF v_match.kick_off IS NULL OR v_match.kick_off <= now() THEN
    RAISE EXCEPTION 'predictions_closed';
  END IF;

  v_knockout := public.is_knockout_match(v_match.group_label, v_match.phase);
  v_winner := public.match_result_from_scores(p_score_home, p_score_away);

  IF v_knockout AND v_winner = 'draw' THEN
    IF p_et_score_home IS NULL OR p_et_score_away IS NULL THEN
      RAISE EXCEPTION 'knockout_et_required';
    END IF;
    IF p_et_score_home < 0 OR p_et_score_away < 0 OR p_et_score_home > 99 OR p_et_score_away > 99 THEN
      RAISE EXCEPTION 'invalid_scores';
    END IF;

    v_et_winner := public.match_result_from_scores(p_et_score_home, p_et_score_away);
    IF v_et_winner = 'draw' THEN
      IF p_penalty_winner IS NULL OR p_penalty_winner NOT IN ('home', 'away') THEN
        RAISE EXCEPTION 'knockout_penalty_winner_required';
      END IF;
    ELSE
      p_penalty_winner := NULL;
    END IF;
  ELSE
    p_et_score_home := NULL;
    p_et_score_away := NULL;
    p_penalty_winner := NULL;
  END IF;

  IF p_penalty_winner IS NOT NULL AND p_penalty_winner NOT IN ('home', 'away') THEN
    RAISE EXCEPTION 'knockout_penalty_winner_invalid';
  END IF;

  SELECT *
  INTO v_pred
  FROM public.predictions
  WHERE user_id = v_uid
    AND match_id = p_match_id;

  IF FOUND AND v_pred.status <> 'pending' THEN
    RAISE EXCEPTION 'prediction_locked';
  END IF;

  IF FOUND THEN
    UPDATE public.predictions
    SET
      predicted_winner = v_winner,
      predicted_score_home = p_score_home,
      predicted_score_away = p_score_away,
      predicted_et_score_home = p_et_score_home,
      predicted_et_score_away = p_et_score_away,
      predicted_penalty_winner = p_penalty_winner,
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
    BEGIN
      INSERT INTO public.predictions (
        user_id, match_id, predicted_winner,
        predicted_score_home, predicted_score_away,
        predicted_et_score_home, predicted_et_score_away, predicted_penalty_winner,
        predicted_first_scorer, predicted_mvp, status, points, updated_at
      )
      VALUES (
        v_uid, p_match_id, v_winner,
        p_score_home, p_score_away,
        p_et_score_home, p_et_score_away, p_penalty_winner,
        NULL, NULL, 'pending', 0, now()
      )
      RETURNING * INTO v_pred;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT * INTO v_pred FROM public.predictions
        WHERE user_id = v_uid AND match_id = p_match_id FOR UPDATE;

        IF NOT FOUND OR v_pred.status <> 'pending' THEN
          RAISE EXCEPTION 'prediction_locked';
        END IF;

        UPDATE public.predictions
        SET
          predicted_winner = v_winner,
          predicted_score_home = p_score_home,
          predicted_score_away = p_score_away,
          predicted_et_score_home = p_et_score_home,
          predicted_et_score_away = p_et_score_away,
          predicted_penalty_winner = p_penalty_winner,
          predicted_first_scorer = NULL,
          predicted_mvp = NULL,
          status = 'pending',
          points = 0,
          scored_at = NULL,
          updated_at = now()
        WHERE user_id = v_uid AND match_id = p_match_id AND status = 'pending'
        RETURNING * INTO v_pred;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'prediction_locked';
        END IF;
    END;
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
      'predicted_et_score_home', v_pred.predicted_et_score_home,
      'predicted_et_score_away', v_pred.predicted_et_score_away,
      'predicted_penalty_winner', v_pred.predicted_penalty_winner,
      'status', v_pred.status,
      'points', v_pred.points,
      'created_at', v_pred.created_at,
      'updated_at', v_pred.updated_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_prediction(uuid, integer, integer, integer, integer, text) TO authenticated;
