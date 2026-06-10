-- Beta 200–400: snapshots de capacidad y métricas admin

CREATE TABLE IF NOT EXISTS public.system_capacity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  total_users int NOT NULL DEFAULT 0,
  new_users_today int NOT NULL DEFAULT 0,
  new_users_7d int NOT NULL DEFAULT 0,
  new_users_30d int NOT NULL DEFAULT 0,
  active_users_today int NOT NULL DEFAULT 0,
  active_users_7d int NOT NULL DEFAULT 0,
  total_predictions int NOT NULL DEFAULT 0,
  predictions_today int NOT NULL DEFAULT 0,
  predictions_7d int NOT NULL DEFAULT 0,
  users_with_predictions int NOT NULL DEFAULT 0,
  estimated_concurrent_peak int NOT NULL DEFAULT 0,
  capacity_status text NOT NULL DEFAULT 'green',
  migration_recommendation text NOT NULL DEFAULT 'stay_free',
  notes text,
  raw_payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_capacity_snapshots_created_at
  ON public.system_capacity_snapshots (created_at DESC);

ALTER TABLE public.system_capacity_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_capacity_snapshots_admin ON public.system_capacity_snapshots;
CREATE POLICY system_capacity_snapshots_admin ON public.system_capacity_snapshots
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_get_beta_capacity()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users int;
  v_new_today int;
  v_new_7d int;
  v_new_30d int;
  v_active_today int;
  v_active_7d int;
  v_total_predictions int;
  v_pred_today int;
  v_pred_7d int;
  v_users_with_pred int;
  v_recent_errors int;
  v_last_sync jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT count(*) INTO v_total_users FROM public.profiles WHERE deleted_at IS NULL;

  SELECT count(*) INTO v_new_today
  FROM public.profiles
  WHERE deleted_at IS NULL AND created_at >= date_trunc('day', now());

  SELECT count(*) INTO v_new_7d
  FROM public.profiles
  WHERE deleted_at IS NULL AND created_at >= now() - interval '7 days';

  SELECT count(*) INTO v_new_30d
  FROM public.profiles
  WHERE deleted_at IS NULL AND created_at >= now() - interval '30 days';

  SELECT count(DISTINCT user_id) INTO v_active_today
  FROM public.activity_logs
  WHERE user_id IS NOT NULL AND created_at >= date_trunc('day', now());

  SELECT count(DISTINCT al.user_id) INTO v_active_7d
  FROM public.activity_logs al
  WHERE al.user_id IS NOT NULL AND al.created_at >= now() - interval '7 days';

  SELECT count(*) INTO v_total_predictions FROM public.predictions;

  SELECT count(*) INTO v_pred_today
  FROM public.predictions WHERE created_at >= date_trunc('day', now());

  SELECT count(*) INTO v_pred_7d
  FROM public.predictions WHERE created_at >= now() - interval '7 days';

  SELECT count(DISTINCT user_id) INTO v_users_with_pred FROM public.predictions;

  SELECT count(*) INTO v_recent_errors
  FROM public.data_sync_logs
  WHERE status = 'failed' AND started_at >= now() - interval '24 hours';

  SELECT to_jsonb(s) INTO v_last_sync FROM (
    SELECT id, provider, sync_type, status, error_message, started_at, finished_at
    FROM public.data_sync_logs ORDER BY started_at DESC LIMIT 1
  ) s;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'new_users_today', v_new_today,
    'new_users_7d', v_new_7d,
    'new_users_30d', v_new_30d,
    'active_users_today', v_active_today,
    'active_users_7d', v_active_7d,
    'total_predictions', v_total_predictions,
    'predictions_today', v_pred_today,
    'predictions_7d', v_pred_7d,
    'users_with_predictions', v_users_with_pred,
    'users_played_pct', CASE WHEN v_total_users > 0
      THEN round((v_users_with_pred::numeric / v_total_users) * 100, 1) ELSE 0 END,
    'recent_sync_errors_24h', v_recent_errors,
    'last_sync', v_last_sync,
    'realtime_enabled', coalesce(current_setting('app.beta_realtime', true), 'unknown'),
    'latest_snapshots', (
      SELECT coalesce(jsonb_agg(row_to_json(s) ORDER BY s.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, created_at, total_users, active_users_7d, total_predictions,
               estimated_concurrent_peak, capacity_status, migration_recommendation, notes
        FROM public.system_capacity_snapshots
        ORDER BY created_at DESC LIMIT 10
      ) s
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_beta_capacity() TO authenticated;
