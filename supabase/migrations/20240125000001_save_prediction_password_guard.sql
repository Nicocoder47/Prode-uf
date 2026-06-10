-- Patch save_prediction: bloquear si must_change_password o is_blocked (sin tocar lógica scoring)

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
  v_match public.matches%ROWTYPE;
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
    BEGIN
      INSERT INTO public.predictions (
        user_id, match_id, predicted_winner, predicted_score_home, predicted_score_away,
        predicted_first_scorer, predicted_mvp, status, points, updated_at
      )
      VALUES (
        v_uid, p_match_id, v_winner, p_score_home, p_score_away,
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
      'status', v_pred.status,
      'points', v_pred.points,
      'created_at', v_pred.created_at,
      'updated_at', v_pred.updated_at
    )
  );
END;
$$;
