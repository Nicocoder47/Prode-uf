import { supabase } from '../../database/supabaseClient'
import { ApiFootballProvider } from '../../providers/apiFootball/ApiFootballProvider'
import { FootballDataProvider } from '../../providers/footballData/FootballDataProvider'
import { kickOffDateInArgentina, todayInArgentina } from '../../utils/matchDay'
import type { SportsDataProviderAdapter } from './DataProviderManager'
import { logSyncPhase } from './matchSyncDiagnostics'

type StaleMatchRef = {
  provider: string
  provider_match_id: string
  kick_off: string
}

export async function listStaleLiveMatchRefs(): Promise<StaleMatchRef[]> {
  const today = todayInArgentina()
  const { data, error } = await supabase
    .from('matches')
    .select('provider,provider_match_id,kick_off')
    .in('status', ['live', 'halftime'])

  if (error) {
    console.warn('[SYNC:stale_live] lookup failed:', error.message)
    return []
  }

  return (data ?? []).filter(
    row => kickOffDateInArgentina(String(row.kick_off)) < today,
  ) as StaleMatchRef[]
}

async function fetchStaleRow(
  providerName: string,
  providerMatchId: string,
): Promise<Record<string, unknown> | null> {
  if (providerName === 'football-data.org' && FootballDataProvider.isConfigured()) {
    return (await FootballDataProvider.fetchMatchByProviderId(providerMatchId)) as unknown as Record<
      string,
      unknown
    > | null
  }
  if (providerName === 'api-football' && ApiFootballProvider.isConfigured()) {
    return (await ApiFootballProvider.fetchFixtureByProviderId(providerMatchId)) as Record<
      string,
      unknown
    > | null
  }
  return null
}

/** Partidos live/halftime de días anteriores que el sync diario no alcanza a cerrar. */
export async function fetchStaleLiveMatchRows(
  provider: SportsDataProviderAdapter,
): Promise<Record<string, unknown>[]> {
  const staleRefs = await listStaleLiveMatchRefs()
  if (staleRefs.length === 0) return []

  logSyncPhase('stale_live', {
    event: 'start',
    provider: provider.name,
    stale_count: staleRefs.length,
  })

  const rows: Record<string, unknown>[] = []
  for (const ref of staleRefs) {
    if (ref.provider === 'football_data' && provider.name !== 'football-data.org') continue
    if (ref.provider === 'api_football' && provider.name !== 'api-football') continue

    try {
      const row = await fetchStaleRow(provider.name, String(ref.provider_match_id))
      if (row) {
        rows.push(row)
        console.log(
          `[SYNC:stale_live] resolved provider_match_id=${ref.provider_match_id} status=${row.status} score=${row.score_home ?? 'null'}-${row.score_away ?? 'null'}`,
        )
      }
    } catch (err) {
      console.warn(
        `[SYNC:stale_live] fetch failed provider_match_id=${ref.provider_match_id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  logSyncPhase('stale_live', {
    event: 'done',
    provider: provider.name,
    fetched: rows.length,
  })

  return rows
}
