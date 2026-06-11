import { supabase } from '../../database/supabaseClient'
import { ApiFootballProvider } from '../../providers/apiFootball/ApiFootballProvider'
import { resolveSportsDataProvider } from './DataProviderManager'
import { SyncEngine } from './SyncEngine'
import { logSyncPhase } from './matchSyncDiagnostics'
import { syncTodayMatchResultsFromApi } from './todayMatchResultsSync'

export type LiveSyncCycleResult = {
  ok: boolean
  primaryProvider: string | null
  liveMatchesUpserted: number
  todayResultsFetched: number
  todayResultsUpserted: number
  todayResultsSkipped: number
  liveBundlesProcessed: number
  apiFootballConfigured: boolean
  errors: string[]
  durationMs: number
}

type SyncLogInput = {
  syncType: string
  provider: string
  status: 'done' | 'error'
  recordsUpserted: number
  recordsSkipped?: number
  startedAt: string
  errorMessage?: string | null
  meta?: Record<string, unknown>
}

async function logSyncRun(input: SyncLogInput): Promise<void> {
  const metaJson = input.meta ? JSON.stringify(input.meta) : null
  const errorMessage = input.errorMessage ?? metaJson

  await supabase.from('data_sync_logs').insert({
    provider: input.provider,
    sync_type: input.syncType,
    status: input.status,
    records_upserted: input.recordsUpserted,
    records_skipped: input.recordsSkipped ?? 0,
    error_message: errorMessage,
    started_at: input.startedAt,
    finished_at: new Date().toISOString(),
  })
}

async function writeWorkerHeartbeat(payload: Record<string, unknown>) {
  const row = {
    snapshot_type: 'worker_heartbeat',
    payload: {
      ...payload,
      at: new Date().toISOString(),
      host: process.env.WORKER_HOST || process.env.HOSTNAME || 'unknown',
    },
  }
  await supabase.from('system_snapshots').insert(row)
  await supabase.from('system_snapshots').insert({
    snapshot_type: 'worker_health',
    payload: row.payload,
  })
}

/** Heartbeat al arrancar el worker (Oracle PM2). */
export async function registerWorkerStartup(): Promise<void> {
  await writeWorkerHeartbeat({
    event: 'startup',
    ok: true,
    nodeEnv: process.env.NODE_ENV ?? 'development',
  })
}

/** Ciclo live: partidos en vivo + resultados del día + pipeline API-Football. */
export async function runLiveSyncCycle(): Promise<LiveSyncCycleResult> {
  const cycleStartedAt = new Date().toISOString()
  const started = Date.now()
  const errors: string[] = []
  let primaryProvider: string | null = null
  let liveMatchesUpserted = 0
  let todayResultsFetched = 0
  let todayResultsUpserted = 0
  let todayResultsSkipped = 0
  let liveBundlesProcessed = 0
  const apiFootballConfigured = ApiFootballProvider.isConfigured()

  logSyncPhase('live_cycle', {
    event: 'start',
    started_at: cycleStartedAt,
    footballDataKey: Boolean(process.env.FOOTBALL_DATA_API_KEY?.trim()),
    apiFootballKey: apiFootballConfigured,
  })

  // --- live_matches ---
  const liveStartedAt = new Date().toISOString()
  try {
    const provider = resolveSportsDataProvider()
    primaryProvider = provider.name

    if (provider.syncLiveMatches) {
      const live = await provider.syncLiveMatches()
      logSyncPhase('live_matches', { event: 'fetched', provider: primaryProvider, count: live.length })

      if (live.length > 0) {
        await SyncEngine.upsertAndCache(
          'matches',
          live,
          `cache:matches:live:${provider.name}`,
          30,
          'provider,provider_match_id',
        )
        liveMatchesUpserted = live.length
      }

      await logSyncRun({
        syncType: 'live_matches',
        provider: provider.name,
        status: 'done',
        recordsUpserted: live.length,
        recordsSkipped: 0,
        startedAt: liveStartedAt,
        meta: { liveMatchesUpserted: live.length },
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`live_matches: ${msg}`)
    await logSyncRun({
      syncType: 'live_matches',
      provider: primaryProvider ?? 'unknown',
      status: 'error',
      recordsUpserted: 0,
      startedAt: liveStartedAt,
      errorMessage: msg,
    })
  }

  // --- today_results (siempre corre) ---
  const todayStartedAt = new Date().toISOString()
  try {
    const todaySync = await syncTodayMatchResultsFromApi()
    todayResultsFetched = todaySync.fetched
    todayResultsUpserted = todaySync.upserted
    todayResultsSkipped = todaySync.skipped

    if (todaySync.errors.length > 0) {
      errors.push(...todaySync.errors.map(e => `today_results: ${e}`))
    }

    await logSyncRun({
      syncType: 'today_results',
      provider: todaySync.provider ?? primaryProvider ?? 'unknown',
      status: todaySync.errors.length > 0 ? 'error' : 'done',
      recordsUpserted: todaySync.upserted,
      recordsSkipped: todaySync.skipped,
      startedAt: todayStartedAt,
      errorMessage: todaySync.errors[0] ?? null,
      meta: {
        fetched: todaySync.fetched,
        upserted: todaySync.upserted,
        skipped: todaySync.skipped,
        statsBundlesSynced: todaySync.statsBundlesSynced,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`today_results: ${msg}`)
    await logSyncRun({
      syncType: 'today_results',
      provider: primaryProvider ?? 'unknown',
      status: 'error',
      recordsUpserted: 0,
      startedAt: todayStartedAt,
      errorMessage: msg,
    })
  }

  // --- api-football pipeline (opcional) ---
  if (apiFootballConfigured) {
    const pipelineStartedAt = new Date().toISOString()
    try {
      liveBundlesProcessed = await ApiFootballProvider.syncLivePipeline()
      await logSyncRun({
        syncType: 'live_pipeline',
        provider: 'api-football',
        status: 'done',
        recordsUpserted: liveBundlesProcessed,
        startedAt: pipelineStartedAt,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`live_pipeline: ${msg}`)
      await logSyncRun({
        syncType: 'live_pipeline',
        provider: 'api-football',
        status: 'error',
        recordsUpserted: 0,
        startedAt: pipelineStartedAt,
        errorMessage: msg,
      })
    }
  }

  const result: LiveSyncCycleResult = {
    ok: errors.length === 0,
    primaryProvider,
    liveMatchesUpserted,
    todayResultsFetched,
    todayResultsUpserted,
    todayResultsSkipped,
    liveBundlesProcessed,
    apiFootballConfigured,
    errors,
    durationMs: Date.now() - started,
  }

  logSyncPhase('live_cycle', { event: 'done', ...result })

  await logSyncRun({
    syncType: 'live_cycle',
    provider: primaryProvider ?? 'unknown',
    status: errors.length > 0 ? 'error' : 'done',
    recordsUpserted: todayResultsUpserted + liveMatchesUpserted,
    recordsSkipped: todayResultsSkipped,
    startedAt: cycleStartedAt,
    errorMessage: errors.length > 0 ? errors.join('; ') : null,
    meta: {
      liveMatchesUpserted,
      todayResultsFetched,
      todayResultsUpserted,
      todayResultsSkipped,
      liveBundlesProcessed,
      apiFootballConfigured,
      errors,
      durationMs: result.durationMs,
    },
  })

  await writeWorkerHeartbeat(result as unknown as Record<string, unknown>)

  return result
}
