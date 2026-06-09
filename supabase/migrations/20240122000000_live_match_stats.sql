-- Agregados públicos de predicciones para carrusel "Mundial en Vivo" (sin exponer filas individuales).

CREATE OR REPLACE FUNCTION public.get_live_match_stats()
RETURNS TABLE (
  match_id uuid,
  prediction_count integer,
  home_pct integer,
  draw_pct integer,
  away_pct integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.match_id,
    count(*)::integer AS prediction_count,
    CASE WHEN count(*) = 0 THEN 0
      ELSE round(100.0 * count(*) FILTER (WHERE p.predicted_winner = 'home') / count(*))::integer
    END AS home_pct,
    CASE WHEN count(*) = 0 THEN 0
      ELSE round(100.0 * count(*) FILTER (WHERE p.predicted_winner = 'draw') / count(*))::integer
    END AS draw_pct,
    CASE WHEN count(*) = 0 THEN 0
      ELSE 100
        - CASE WHEN count(*) = 0 THEN 0
          ELSE round(100.0 * count(*) FILTER (WHERE p.predicted_winner = 'home') / count(*))::integer
        END
        - CASE WHEN count(*) = 0 THEN 0
          ELSE round(100.0 * count(*) FILTER (WHERE p.predicted_winner = 'draw') / count(*))::integer
        END
    END AS away_pct
  FROM public.predictions p
  WHERE p.status IN ('pending', 'locked', 'scored')
  GROUP BY p.match_id;
$$;

REVOKE ALL ON FUNCTION public.get_live_match_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_match_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_match_stats() TO anon;
