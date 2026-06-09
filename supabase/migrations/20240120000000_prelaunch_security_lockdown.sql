-- Pre-launch Fase A: lockdown RPCs scoring, PII ranking, save_prediction TOCTOU, anon grants

-- ---------------------------------------------------------------------------
-- 1. Guard interno para funciones de scoring (defensa en profundidad)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_internal_scoring_caller()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;

  IF public.is_admin() THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'forbidden';
END;
$$;

REVOKE ALL ON FUNCTION public.assert_internal_scoring_caller() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. Vista pública segura para ranking (sin PII)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_leaderboard_select ON public.profiles;

CREATE OR REPLACE VIEW public.public_leaderboard_profiles
WITH (security_barrier = true)
AS
SELECT
  p.id,
  trim(p.full_name) AS display_name,
  p.avatar_url,
  p.legajo
FROM public.profiles p
WHERE EXISTS (
  SELECT 1
  FROM public.leaderboard lb
  WHERE lb.user_id = p.id
    AND lb.period = 'global'
);

REVOKE ALL ON public.public_leaderboard_profiles FROM PUBLIC;
GRANT SELECT ON public.public_leaderboard_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_leaderboard_profiles IS
  'Perfil mínimo para ranking público. No incluye email, DNI, phone, role ni flags admin.';

-- ---------------------------------------------------------------------------
-- 3. save_prediction — lock de partido + validación in-transaction + race INSERT
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.is_active = true
      AND p.deleted_at IS NULL
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
    EXCEPTION
      WHEN unique_violation THEN
        SELECT *
        INTO v_pred
        FROM public.predictions
        WHERE user_id = v_uid
          AND match_id = p_match_id
        FOR UPDATE;

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
        WHERE user_id = v_uid
          AND match_id = p_match_id
          AND status = 'pending'
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

GRANT EXECUTE ON FUNCTION public.save_prediction(uuid, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. score_match_predictions — guard interno + scored_at solo si hubo predicciones
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
  PERFORM public.assert_internal_scoring_caller();

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

  -- Si v_total_scored = 0: no se marca scored_at — el partido puede reintentar scoring
  -- cuando existan predicciones elegibles (pending/locked).

  RETURN v_total_scored;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. rescore_match_predictions — guard interno
-- ---------------------------------------------------------------------------
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
  PERFORM public.assert_internal_scoring_caller();

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

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
    FOR UPDATE
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

-- ---------------------------------------------------------------------------
-- 6. REVOKE RPCs sensibles — solo service_role (+ postgres owner)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.score_match_predictions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.score_match_predictions(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.score_match_predictions(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.rescore_match_predictions(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rescore_match_predictions(uuid, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.rescore_match_predictions(uuid, integer, integer) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.score_match_predictions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rescore_match_predictions(uuid, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. validate_member_legajo — solo uso interno (no cliente)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.validate_member_legajo(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_member_legajo(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.validate_member_legajo(text, text) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 8. validate_registration — respuestas genéricas para anon (anti-enumeración)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_registration(
  p_email text,
  p_dni text,
  p_legajo text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dni text;
  v_legajo text;
  v_email text;
  v_conflict uuid;
  v_is_anon boolean;
BEGIN
  v_is_anon := auth.uid() IS NULL;
  v_email := lower(trim(coalesce(p_email, '')));
  v_dni := public.normalize_dni(p_dni);
  v_legajo := public.normalize_legajo(p_legajo);

  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_email');
  END IF;

  IF v_dni = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'dni_required');
  END IF;

  IF length(v_dni) < 7 OR length(v_dni) > 8 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_dni');
  END IF;

  IF v_legajo = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'legajo_required');
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_dni(dni) = v_dni
    AND lower(trim(email)) <> v_email
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    IF v_is_anon THEN
      RETURN jsonb_build_object('ok', false, 'code', 'registration_conflict');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'dni_taken');
  END IF;

  SELECT id INTO v_conflict
  FROM public.profiles
  WHERE public.normalize_legajo(legajo) = v_legajo
    AND lower(trim(email)) <> v_email
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    IF v_is_anon THEN
      RETURN jsonb_build_object('ok', false, 'code', 'registration_conflict');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'legajo_taken');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_registration(text, text, text) TO anon, authenticated;
