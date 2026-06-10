-- Beta 300: device_reports + admin_get_beta_capacity ampliado

CREATE TABLE IF NOT EXISTS public.device_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  device_type text NOT NULL CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  browser text,
  os text,
  viewport_width int,
  viewport_height int,
  user_agent text,
  route text,
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'error', 'performance')),
  error_message text,
  performance_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_reports_created_at ON public.device_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_reports_device_type ON public.device_reports (device_type);
CREATE INDEX IF NOT EXISTS idx_device_reports_event_type ON public.device_reports (event_type);
CREATE INDEX IF NOT EXISTS idx_device_reports_route ON public.device_reports (route);
CREATE INDEX IF NOT EXISTS idx_device_reports_user_id ON public.device_reports (user_id);

ALTER TABLE public.device_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_reports_insert ON public.device_reports;
CREATE POLICY device_reports_insert ON public.device_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS device_reports_admin_select ON public.device_reports;
CREATE POLICY device_reports_admin_select ON public.device_reports
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_get_beta_capacity()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registered int;
  v_new_today int;
  v_new_7d int;
  v_new_30d int;
  v_active_24h int;
  v_active_7d int;
  v_total_preds int;
  v_pred_24h int;
  v_pred_7d int;
  v_users_with_pred int;
  v_sync_errors int;
  v_last_sync jsonb;
  v_estimated int;
  v_capacity_pct numeric;
  v_status text;
  v_recommendation text;
  v_migration_needed boolean;
  v_reasons jsonb := '[]'::jsonb;
  v_device_health jsonb;
  v_reports_24h int;
  v_errors_24h int;
  v_error_rate numeric;
  v_read_p95 numeric;
  v_save_p95 numeric;
  v_auth_429 int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT count(*) INTO v_registered FROM public.profiles WHERE deleted_at IS NULL;

  SELECT count(*) INTO v_new_today
  FROM public.profiles WHERE deleted_at IS NULL AND created_at >= date_trunc('day', now());

  SELECT count(*) INTO v_new_7d
  FROM public.profiles WHERE deleted_at IS NULL AND created_at >= now() - interval '7 days';

  SELECT count(*) INTO v_new_30d
  FROM public.profiles WHERE deleted_at IS NULL AND created_at >= now() - interval '30 days';

  SELECT count(DISTINCT user_id) INTO v_active_24h
  FROM public.activity_logs
  WHERE user_id IS NOT NULL AND created_at >= now() - interval '24 hours';

  SELECT count(DISTINCT user_id) INTO v_active_7d
  FROM public.activity_logs
  WHERE user_id IS NOT NULL AND created_at >= now() - interval '7 days';

  SELECT count(*) INTO v_total_preds FROM public.predictions;

  SELECT count(*) INTO v_pred_24h
  FROM public.predictions WHERE created_at >= now() - interval '24 hours';

  SELECT count(*) INTO v_pred_7d
  FROM public.predictions WHERE created_at >= now() - interval '7 days';

  SELECT count(DISTINCT user_id) INTO v_users_with_pred FROM public.predictions;

  SELECT count(*) INTO v_sync_errors
  FROM public.data_sync_logs
  WHERE status IN ('failed', 'error') AND started_at >= now() - interval '24 hours';

  SELECT to_jsonb(s) INTO v_last_sync FROM (
    SELECT id, provider, sync_type, status, error_message, started_at, finished_at
    FROM public.data_sync_logs ORDER BY started_at DESC LIMIT 1
  ) s;

  v_estimated := greatest(
    round(v_active_24h * 0.4)::int,
    round(v_active_7d * 0.35)::int,
    round(v_registered * 0.12)::int,
    5
  );

  v_capacity_pct := least(100, round((v_registered::numeric / 300) * 1000) / 10);

  IF v_registered > 300 THEN
    v_status := 'exceeded';
    v_recommendation := 'Excede beta 300. Desactivar nuevas invitaciones y migrar.';
    v_migration_needed := true;
    v_reasons := v_reasons || jsonb_build_array('Usuarios superan límite 300');
  ELSIF v_registered >= 280 THEN
    v_status := 'red';
    v_recommendation := 'Crítico: no abrir más invitaciones. Preparar migración.';
    v_migration_needed := true;
    v_reasons := v_reasons || jsonb_build_array('Zona crítica ≥ 280 usuarios');
  ELSIF v_registered >= 220 THEN
    v_status := 'yellow';
    v_recommendation := 'Atención: acercándose al límite de beta 300.';
    v_migration_needed := false;
    v_reasons := v_reasons || jsonb_build_array('≥ 220 usuarios registrados');
  ELSE
    v_status := 'green';
    v_recommendation := 'Beta saludable. Puede seguir gratis.';
    v_migration_needed := false;
    v_reasons := v_reasons || jsonb_build_array('Capacidad dentro de beta 300');
  END IF;

  IF v_estimated >= 120 THEN
    v_reasons := v_reasons || jsonb_build_array('Concurrentes estimados ≥ 120');
    IF v_status = 'green' THEN v_status := 'yellow'; END IF;
  ELSIF v_estimated >= 80 AND v_status = 'green' THEN
    v_reasons := v_reasons || jsonb_build_array('Concurrentes estimados ≥ 80');
  END IF;

  IF v_sync_errors > 0 THEN
    v_reasons := v_reasons || jsonb_build_array('Errores sync en 24h: ' || v_sync_errors);
    IF v_status = 'green' THEN v_status := 'yellow'; END IF;
  END IF;

  SELECT count(*) INTO v_reports_24h
  FROM public.device_reports WHERE created_at >= now() - interval '24 hours';

  SELECT count(*) INTO v_errors_24h
  FROM public.device_reports
  WHERE event_type = 'error' AND created_at >= now() - interval '24 hours';

  v_error_rate := CASE WHEN v_reports_24h > 0
    THEN round((v_errors_24h::numeric / v_reports_24h) * 1000) / 10 ELSE 0 END;

  SELECT count(*) INTO v_auth_429
  FROM public.device_reports
  WHERE event_type = 'error'
    AND created_at >= now() - interval '24 hours'
    AND (error_message ILIKE '%429%' OR error_message ILIKE '%rate limit%');

  IF v_auth_429 > 0 THEN
    v_reasons := v_reasons || jsonb_build_array('Errores Auth 429: ' || v_auth_429);
    v_status := 'red';
    v_migration_needed := true;
    v_recommendation := 'Errores de autenticación. Revisar límites y preparar migración.';
  END IF;

  SELECT (raw_payload->'load_reports'->'read_api'->>'p95')::numeric INTO v_read_p95
  FROM public.system_capacity_snapshots ORDER BY created_at DESC LIMIT 1;

  SELECT (raw_payload->'load_reports'->'save_prediction'->>'p95')::numeric INTO v_save_p95
  FROM public.system_capacity_snapshots ORDER BY created_at DESC LIMIT 1;

  v_device_health := jsonb_build_object(
    'reports_24h', v_reports_24h,
    'errors_24h', v_errors_24h,
    'error_rate', v_error_rate,
    'errors_by_device', (
      SELECT coalesce(jsonb_object_agg(device_type, cnt), '{}'::jsonb)
      FROM (
        SELECT device_type, count(*)::int AS cnt
        FROM public.device_reports
        WHERE event_type = 'error' AND created_at >= now() - interval '24 hours'
        GROUP BY device_type
      ) d
    ),
    'errors_by_browser', (
      SELECT coalesce(jsonb_object_agg(browser, cnt), '{}'::jsonb)
      FROM (
        SELECT coalesce(browser, 'unknown') AS browser, count(*)::int AS cnt
        FROM public.device_reports
        WHERE event_type = 'error' AND created_at >= now() - interval '24 hours'
        GROUP BY browser
      ) b
    ),
    'slow_routes', (
      SELECT coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
      FROM (
        SELECT route, round(avg(performance_ms))::int AS avg_ms
        FROM public.device_reports
        WHERE event_type = 'performance'
          AND performance_ms IS NOT NULL
          AND created_at >= now() - interval '24 hours'
        GROUP BY route
        ORDER BY avg(performance_ms) DESC
        LIMIT 5
      ) s
    ),
    'top_error_routes', (
      SELECT coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
      FROM (
        SELECT route, count(*)::int AS count
        FROM public.device_reports
        WHERE event_type = 'error' AND created_at >= now() - interval '24 hours'
        GROUP BY route
        ORDER BY count(*) DESC
        LIMIT 5
      ) s
    ),
    'mobile_error_share_pct', (
      SELECT CASE WHEN v_errors_24h > 0 THEN
        round((
          (SELECT count(*)::numeric FROM public.device_reports
           WHERE event_type = 'error' AND device_type = 'mobile'
             AND created_at >= now() - interval '24 hours') / v_errors_24h
        ) * 1000) / 10
      ELSE 0 END
    )
  );

  RETURN jsonb_build_object(
    'registered_users', v_registered,
    'new_users_today', v_new_today,
    'new_users_7d', v_new_7d,
    'new_users_30d', v_new_30d,
    'active_users_24h', v_active_24h,
    'active_users_7d', v_active_7d,
    'total_predictions', v_total_preds,
    'predictions_24h', v_pred_24h,
    'predictions_7d', v_pred_7d,
    'users_with_predictions', v_users_with_pred,
    'users_played_pct', CASE WHEN v_registered > 0
      THEN round((v_users_with_pred::numeric / v_registered) * 100, 1) ELSE 0 END,
    'estimated_concurrent_users', v_estimated,
    'capacity_percent', v_capacity_pct,
    'status', v_status,
    'recommendation', v_recommendation,
    'technical_action', CASE
      WHEN v_status = 'exceeded' OR v_migration_needed THEN 'migrar'
      WHEN v_status = 'red' THEN 'cerrar_invitaciones'
      WHEN v_status = 'yellow' THEN 'monitorear'
      ELSE 'seguir_gratis'
    END,
    'device_health', v_device_health,
    'migration_needed', v_migration_needed,
    'reasons', v_reasons,
    'recent_sync_errors_24h', v_sync_errors,
    'auth_errors_429_24h', v_auth_429,
    'read_p95_ms', v_read_p95,
    'save_p95_ms', v_save_p95,
    'last_sync', v_last_sync,
    'latest_snapshots', (
      SELECT coalesce(jsonb_agg(row_to_json(s) ORDER BY s.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, created_at, total_users, active_users_7d, total_predictions,
               estimated_concurrent_peak, capacity_status, migration_recommendation, notes
        FROM public.system_capacity_snapshots
        ORDER BY created_at DESC LIMIT 10
      ) s
    ),
    'total_users', v_registered,
    'active_users_today', v_active_24h,
    'predictions_today', v_pred_24h
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_beta_capacity() TO authenticated;
