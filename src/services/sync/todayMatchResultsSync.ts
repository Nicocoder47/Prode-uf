import { ApiFootballProvider } from '../../providers/apiFootball/ApiFootballProvider'
import { resolveSportsDataProvider } from './DataProviderManager'
import { SyncEngine } from './SyncEngine'
import { supabase } from '../../database/supabaseClient'
import {
  logMatchSyncDiagnostic,
  logSyncPhase,
  lookupLocalMatchUuid,
  protectExistingScores,
  type MatchSyncDiagnostic,
} from './matchSyncDiagnostics'
import { fetchStaleLiveMatchRows } from './staleLiveMatchesSync'

export type TodayMatchResultsSyncResult = {
  ok: boolean
  provider: string | null
  fetched: number
  upserted: number
  skipped: number
  statsBundlesSynced: number
  diagnostics: MatchSyncDiagnostic[]
  errors: string[]
}

async function syncFinishedMatchStatsBundles(rows: Record<string, unknown>[]): Promise<number> {
  if (!ApiFootballProvider.isConfigured()) return 0

  let synced = 0
  const finished = rows.filter(row => row.status === 'finished' && row.provider_match_id)
  for (const row of finished) {
    const providerMatchId = String(row.provider_match_id)
    const { data } = await supabase
      .from('matches')
      .select('id')
      .eq('provider', 'api_football')
      .eq('provider_match_id', providerMatchId)
      .maybeSingle()
    if (!data?.id) continue
    try {
      await ApiFootballProvider.syncLiveMatchBundle(providerMatchId, data.id)
      synced += 1
    } catch (err) {
      console.warn(
        `[SYNC:today_results] stats_bundle_failed provider_match_id=${providerMatchId}`,
        err instanceof Error ? err.message : err,
      )
    }
  }
  return synced
}

export async function syncTodayMatchResultsFromApi(): Promise<TodayMatchResultsSyncResult> {
  const errors: string[] = []
  const diagnostics: MatchSyncDiagnostic[] = []
  let providerName: string | null = null
  let fetched = 0
  let upserted = 0
  let skipped = 0
  let statsBundlesSynced = 0

  try {
    const provider = resolveSportsDataProvider()
    providerName = provider.name

    logSyncPhase('today_results', { event: 'start', provider: providerName })

    if (!provider.syncTodayMatchResults) {
      return {
        ok: false,
        provider: providerName,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        statsBundlesSynced: 0,
        diagnostics,
        errors: ['syncTodayMatchResults not supported'],
      }
    }

    const todayRows = await provider.syncTodayMatchResults()
    const staleRows = await fetchStaleLiveMatchRows(provider)
    const mergedById = new Map<string, Record<string, unknown>>()
    for (const row of todayRows as Record<string, unknown>[]) {
      mergedById.set(String(row.provider_match_id), row)
    }
    for (const row of staleRows) {
      mergedById.set(String(row.provider_match_id), row)
    }
    const rows = [...mergedById.values()]
    fetched = rows.length

    if (rows.length === 0) {
      logSyncPhase('today_results', {
        event: 'empty',
        provider: providerName,
        message: 'API devolvió 0 partidos para hoy',
      })
    } else {
      const protectedRows = await protectExistingScores(
        rows as Array<{
          provider: string
          provider_match_id: string
          status: string
          score_home: number | null
          score_away: number | null
        }>,
      )

      const toUpsert: typeof protectedRows = []

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i] as Record<string, unknown>
        const merged = protectedRows[i] as Record<string, unknown>
        const providerMatchId = String(raw.provider_match_id)
        const localUuid = await lookupLocalMatchUuid(String(raw.provider), providerMatchId)

        const { data: existing } = await supabase
          .from('matches')
          .select('status,score_home,score_away')
          .eq('provider', raw.provider)
          .eq('provider_match_id', providerMatchId)
          .maybeSingle()

        const scorePreserved =
          merged.score_home !== raw.score_home || merged.score_away !== raw.score_away

        const blockedFinished =
          raw.status === 'finished' &&
          (raw.score_home == null || raw.score_away == null) &&
          merged.status !== 'finished'

        if (blockedFinished) {
          skipped += 1
          const entry: MatchSyncDiagnostic = {
            provider: String(raw.provider),
            providerMatchId,
            externalStatus: String(raw.status),
            scoreHome: merged.score_home as number | null,
            scoreAway: merged.score_away as number | null,
            homeProviderTeamId: null,
            awayProviderTeamId: null,
            localMatchUuid: localUuid,
            action: 'skip',
            skipReason: 'finished sin marcador API',
            dbScoreHomeBefore: existing?.score_home ?? null,
            dbScoreAwayBefore: existing?.score_away ?? null,
          }
          diagnostics.push(entry)
          logMatchSyncDiagnostic(entry)
          continue
        }

        const entry: MatchSyncDiagnostic = {
          provider: String(raw.provider),
          providerMatchId,
          externalStatus: String(raw.status),
          scoreHome: merged.score_home as number | null,
          scoreAway: merged.score_away as number | null,
          homeProviderTeamId: null,
          awayProviderTeamId: null,
          localMatchUuid: localUuid,
          action: 'upsert',
          dbScoreHomeBefore: existing?.score_home ?? null,
          dbScoreAwayBefore: existing?.score_away ?? null,
          scorePreserved,
        }
        diagnostics.push(entry)
        logMatchSyncDiagnostic(entry)
        toUpsert.push(protectedRows[i])
      }

      if (toUpsert.length > 0) {
        await SyncEngine.upsertAndCache(
          'matches',
          toUpsert,
          `cache:matches:today:${provider.name}`,
          300,
          'provider,provider_match_id',
        )
      }
      upserted = toUpsert.length
      statsBundlesSynced = await syncFinishedMatchStatsBundles(toUpsert as Record<string, unknown>[])
    }

    logSyncPhase('today_results', {
      event: 'done',
      provider: providerName,
      fetched,
      upserted,
      skipped,
      statsBundlesSynced,
    })
  } catch (err) {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : err instanceof Error
          ? err.message
          : JSON.stringify(err)
    errors.push(msg)
    logSyncPhase('today_results', { event: 'error', provider: providerName, error: msg })
  }

  return {
    ok: errors.length === 0,
    provider: providerName,
    fetched,
    upserted,
    skipped,
    statsBundlesSynced,
    diagnostics,
    errors,
  }
}
