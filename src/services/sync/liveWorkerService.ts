import { supabase } from '../../database/supabaseClient';
import { ApiFootballProvider } from '../../providers/apiFootball/ApiFootballProvider';
import { resolveSportsDataProvider } from './DataProviderManager';
import { SyncEngine } from './SyncEngine';

export type LiveSyncCycleResult = {
  ok: boolean;
  primaryProvider: string | null;
  liveMatchesUpserted: number;
  liveBundlesProcessed: number;
  apiFootballConfigured: boolean;
  errors: string[];
  durationMs: number;
};

async function logSyncRun(
  syncType: string,
  provider: string,
  status: 'done' | 'error',
  records: number,
  errorMessage?: string
) {
  await supabase.from('data_sync_logs').insert({
    provider,
    sync_type: syncType,
    status,
    records_upserted: records,
    records_skipped: 0,
    error_message: errorMessage ?? null,
    finished_at: new Date().toISOString(),
  });
}

async function writeWorkerHeartbeat(payload: Record<string, unknown>) {
  const row = {
    snapshot_type: 'worker_heartbeat',
    payload: {
      ...payload,
      at: new Date().toISOString(),
      host: process.env.WORKER_HOST || process.env.HOSTNAME || 'unknown',
    },
  };
  await supabase.from('system_snapshots').insert(row);
  await supabase.from('system_snapshots').insert({
    snapshot_type: 'worker_health',
    payload: row.payload,
  });
}

/** Heartbeat al arrancar el worker (Oracle PM2). */
export async function registerWorkerStartup(): Promise<void> {
  await writeWorkerHeartbeat({
    event: 'startup',
    ok: true,
    nodeEnv: process.env.NODE_ENV ?? 'development',
  });
}

/** Ciclo live cada 30s: partidos + pipeline API-Football (events, ratings, MVP). */
export async function runLiveSyncCycle(): Promise<LiveSyncCycleResult> {
  const started = Date.now();
  const errors: string[] = [];
  let primaryProvider: string | null = null;
  let liveMatchesUpserted = 0;
  let liveBundlesProcessed = 0;
  const apiFootballConfigured = ApiFootballProvider.isConfigured();

  try {
    const provider = resolveSportsDataProvider();
    primaryProvider = provider.name;

    if (provider.syncLiveMatches) {
      const live = await provider.syncLiveMatches();
      if (live.length > 0) {
        await SyncEngine.upsertAndCache(
          'matches',
          live,
          `cache:matches:live:${provider.name}`,
          30,
          'provider,provider_match_id'
        );
        liveMatchesUpserted = live.length;
      }
      await logSyncRun('live_matches', provider.name, 'done', live.length);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`live_matches: ${msg}`);
    await logSyncRun('live_matches', primaryProvider ?? 'unknown', 'error', 0, msg);
  }

  if (apiFootballConfigured) {
    try {
      liveBundlesProcessed = await ApiFootballProvider.syncLivePipeline();
      await logSyncRun('live_pipeline', 'api-football', 'done', liveBundlesProcessed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`live_pipeline: ${msg}`);
      await logSyncRun('live_pipeline', 'api-football', 'error', 0, msg);
    }
  }

  const result: LiveSyncCycleResult = {
    ok: errors.length === 0,
    primaryProvider,
    liveMatchesUpserted,
    liveBundlesProcessed,
    apiFootballConfigured,
    errors,
    durationMs: Date.now() - started,
  };

  await writeWorkerHeartbeat(result as unknown as Record<string, unknown>);

  return result;
}
