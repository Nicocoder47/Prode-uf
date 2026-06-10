import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createNodeSupabaseClient } from '../lib/supabaseNodeClient.js';
import { initLoadEnv } from '../load/lib/loadEnv.js';
import {
  evaluateBeta300,
  estimateConcurrentUsers,
  type Beta300Evaluation,
} from '../../src/utils/beta300Capacity.ts';

export type BetaMetricsRaw = {
  total_users: number;
  new_users_today: number;
  new_users_7d: number;
  new_users_30d: number;
  active_users_today: number;
  active_users_7d: number;
  total_predictions: number;
  predictions_today: number;
  predictions_7d: number;
  users_with_predictions: number;
  users_played_pct: number;
  recent_sync_errors_24h: number;
  last_sync: Record<string, unknown> | null;
};

export type BetaReport = {
  generated_at: string;
  metrics: BetaMetricsRaw;
  evaluation: Beta300Evaluation;
  cost_zero_viable: boolean;
  thresholds_exceeded: string[];
  recommended_action: string;
  load_reports?: Record<string, unknown>;
};

function readJsonReport(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function collectBetaMetrics(): Promise<BetaMetricsRaw> {
  const { url, serviceKey } = initLoadEnv();
  const sb = createNodeSupabaseClient(url, serviceKey);

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const iso7d = new Date(Date.now() - 7 * 86400000).toISOString();
  const iso30d = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    profilesRes,
    predsRes,
    activityTodayRes,
    activity7dRes,
    syncErrorsRes,
    lastSyncRes,
  ] = await Promise.all([
    sb.from('profiles').select('id, created_at, deleted_at', { count: 'exact', head: false }),
    sb.from('predictions').select('id, user_id, created_at'),
    sb.from('activity_logs').select('user_id').gte('created_at', dayStart.toISOString()),
    sb.from('activity_logs').select('user_id').gte('created_at', iso7d),
    sb.from('data_sync_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte(
      'started_at',
      new Date(Date.now() - 86400000).toISOString(),
    ),
    sb.from('data_sync_logs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (predsRes.error) throw predsRes.error;

  const profiles = (profilesRes.data ?? []).filter(p => !p.deleted_at);
  const preds = predsRes.data ?? [];

  const total_users = profiles.length;
  const new_users_today = profiles.filter(p => new Date(p.created_at) >= dayStart).length;
  const new_users_7d = profiles.filter(p => new Date(p.created_at) >= new Date(iso7d)).length;
  const new_users_30d = profiles.filter(p => new Date(p.created_at) >= new Date(iso30d)).length;

  const activeToday = new Set(
    (activityTodayRes.data ?? []).map(r => r.user_id).filter(Boolean),
  );
  const active7d = new Set((activity7dRes.data ?? []).map(r => r.user_id).filter(Boolean));

  const total_predictions = preds.length;
  const predictions_today = preds.filter(p => new Date(p.created_at) >= dayStart).length;
  const predictions_7d = preds.filter(p => new Date(p.created_at) >= new Date(iso7d)).length;
  const users_with_predictions = new Set(preds.map(p => p.user_id)).size;
  const users_played_pct =
    total_users > 0 ? Math.round((users_with_predictions / total_users) * 1000) / 10 : 0;

  return {
    total_users,
    new_users_today,
    new_users_7d,
    new_users_30d,
    active_users_today: activeToday.size,
    active_users_7d: active7d.size,
    total_predictions,
    predictions_today,
    predictions_7d,
    users_with_predictions,
    users_played_pct,
    recent_sync_errors_24h: syncErrorsRes.count ?? 0,
    last_sync: (lastSyncRes.data as Record<string, unknown> | null) ?? null,
  };
}

export function buildBetaReport(metrics: BetaMetricsRaw, extra?: Partial<BetaReport>): BetaReport {
  const reportsDir = join(process.cwd(), 'reports');
  const loadRead = readJsonReport(join(reportsDir, 'load-read-api.json'));
  const loadSave = readJsonReport(join(reportsDir, 'load-save-prediction.json'));

  const p95Latency =
    typeof loadRead?.p95 === 'number'
      ? loadRead.p95
      : (loadRead?.latencies as { p95?: number } | undefined)?.p95;
  const saveP95 =
    typeof loadSave?.p95 === 'number'
      ? loadSave.p95
      : (loadSave?.latencies as { p95?: number } | undefined)?.p95;

  const evaluation = evaluateBeta300({
    registeredUsers: metrics.total_users,
    activeUsers24h: metrics.active_users_today,
    activeUsers7d: metrics.active_users_7d,
    readP95Ms: p95Latency ?? null,
    saveP95Ms: saveP95 ?? null,
    syncErrors24h: metrics.recent_sync_errors_24h,
    estimatedConcurrent: estimateConcurrentUsers(
      metrics.total_users,
      metrics.active_users_7d,
      metrics.active_users_today,
    ),
  });

  const thresholds_exceeded = evaluation.reasons.filter(r => !r.includes('dentro de beta'));
  const cost_zero_viable = !evaluation.migrationNeeded;

  return {
    generated_at: new Date().toISOString(),
    metrics,
    evaluation,
    cost_zero_viable,
    thresholds_exceeded,
    recommended_action: evaluation.message,
    load_reports: {
      read_api: loadRead,
      save_prediction: loadSave,
    },
    ...extra,
  };
}

export function writeBetaReport(filename: string, report: BetaReport) {
  const dir = join(process.cwd(), 'reports');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), JSON.stringify(report, null, 2));
  console.log(`Reporte: reports/${filename}`);
}

export async function persistCapacitySnapshot(report: BetaReport) {
  const { url, serviceKey } = initLoadEnv();
  const sb = createNodeSupabaseClient(url, serviceKey);
  const m = report.metrics;
  const e = report.evaluation;

  const { error } = await sb.from('system_capacity_snapshots').insert({
    total_users: m.total_users,
    new_users_today: m.new_users_today,
    new_users_7d: m.new_users_7d,
    new_users_30d: m.new_users_30d,
    active_users_today: m.active_users_today,
    active_users_7d: m.active_users_7d,
    total_predictions: m.total_predictions,
    predictions_today: m.predictions_today,
    predictions_7d: m.predictions_7d,
    users_with_predictions: m.users_with_predictions,
    estimated_concurrent_peak: e.estimatedConcurrent,
    capacity_status: e.status,
    migration_recommendation: e.technicalAction,
    notes: report.recommended_action,
    raw_payload: report,
  });

  if (error && !error.message.includes('does not exist')) {
    console.warn('No se pudo guardar snapshot (¿migración pendiente?):', error.message);
  }
}
