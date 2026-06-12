import { supabase } from '../../database/supabaseClient'
import { TBD_TEAM_ID } from '../../constants/knockoutBracket'
import { FootballDataProvider } from '../../providers/footballData/FootballDataProvider'
import { FOOTBALL_DATA_PROVIDER } from '../../providers/footballData/normalizers'

export const FOOTBALL_DATA_TOURNAMENT_SCORERS_SOURCE = 'football_data_tournament'
export const TOURNAMENT_SCORERS_PROVIDER_MATCH_ID = '__tournament_scorers__'

export type ScorersSyncResult = {
  ok: boolean
  fetched: number
  upserted: number
  skipped: number
  errors: string[]
}

type PlayerRatingRow = {
  player_id: string
  match_id: string
  goals: number
  assists: number
  source: string
  captured_at: string
}

async function getPlayerUuidMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('players')
    .select('id,provider_player_id')
    .eq('provider', FOOTBALL_DATA_PROVIDER)

  if (error) {
    console.warn('[SYNC:scorers] player map error:', error.message)
    return new Map()
  }

  return new Map(
    (data ?? [])
      .filter(p => p.provider_player_id)
      .map(p => [String(p.provider_player_id), String(p.id)]),
  )
}

async function getTeamUuidMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('teams')
    .select('id,provider_team_id')
    .eq('provider', FOOTBALL_DATA_PROVIDER)

  if (error) {
    console.warn('[SYNC:scorers] team map error:', error.message)
    return new Map()
  }

  return new Map(
    (data ?? [])
      .filter(t => t.provider_team_id)
      .map(t => [String(t.provider_team_id), String(t.id)]),
  )
}

/** Crea el jugador en DB si football-data lo reporta como goleador pero no estaba en planteles. */
async function ensureScorerPlayerUuid(
  entry: Record<string, unknown>,
  playerMap: Map<string, string>,
  teamMap: Map<string, string>,
): Promise<string | null> {
  const player = entry.player as Record<string, unknown> | undefined
  const team = entry.team as { id?: number } | undefined
  const providerPlayerId = player?.id != null ? String(player.id) : ''
  if (!providerPlayerId) return null

  const existing = playerMap.get(providerPlayerId)
  if (existing) return existing

  const teamProviderId = team?.id != null ? String(team.id) : ''
  const teamUuid = teamProviderId ? teamMap.get(teamProviderId) : undefined
  if (!teamUuid) {
    console.warn(
      `[SYNC:scorers] SKIP provider_player_id=${providerPlayerId} ${String(player?.name ?? '?')} reason=team_map_miss team_api=${teamProviderId || 'null'}`,
    )
    return null
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('players')
    .upsert(
      {
        provider: FOOTBALL_DATA_PROVIDER,
        provider_player_id: providerPlayerId,
        team_id: teamUuid,
        name: String(player?.name ?? 'Unknown'),
        nationality: (player?.nationality as string | null) ?? null,
        position: (player?.position as string | null) ?? null,
        date_of_birth: (player?.dateOfBirth as string | null) ?? null,
        shirt_number: typeof player?.shirtNumber === 'number' ? player.shirtNumber : null,
        updated_at: now,
      },
      { onConflict: 'provider,provider_player_id' },
    )
    .select('id')
    .single()

  if (error || !data?.id) {
    console.warn(`[SYNC:scorers] player upsert failed provider_player_id=${providerPlayerId}:`, error?.message)
    return null
  }

  const uuid = String(data.id)
  playerMap.set(providerPlayerId, uuid)
  console.log(`[SYNC:scorers] player created provider_player_id=${providerPlayerId} ${String(player?.name ?? '')}`)
  return uuid
}

export async function ensureTournamentScorersMatch(): Promise<string> {
  const { data: existing, error: lookupError } = await supabase
    .from('matches')
    .select('id')
    .eq('provider', FOOTBALL_DATA_PROVIDER)
    .eq('provider_match_id', TOURNAMENT_SCORERS_PROVIDER_MATCH_ID)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (existing?.id) return String(existing.id)

  const now = new Date().toISOString()
  const { data: created, error } = await supabase
    .from('matches')
    .upsert(
      {
        provider: FOOTBALL_DATA_PROVIDER,
        provider_match_id: TOURNAMENT_SCORERS_PROVIDER_MATCH_ID,
        home_team_id: TBD_TEAM_ID,
        away_team_id: TBD_TEAM_ID,
        kick_off: now,
        phase: 'tournament',
        round: 'scorers',
        status: 'finished',
        updated_at: now,
      },
      { onConflict: 'provider,provider_match_id' },
    )
    .select('id')
    .single()

  if (error) throw error
  return String(created.id)
}

export async function syncFootballDataScorers(limit = 50): Promise<ScorersSyncResult> {
  const errors: string[] = []
  let fetched = 0
  let upserted = 0
  let skipped = 0

  if (!FootballDataProvider.isConfigured()) {
    return {
      ok: false,
      fetched: 0,
      upserted: 0,
      skipped: 0,
      errors: ['FOOTBALL_DATA_API_KEY not configured'],
    }
  }

  try {
    const { data } = await FootballDataProvider.fetchScorersRaw(limit)
    const scorers =
      (data as { scorers?: Record<string, unknown>[] }).scorers ?? []
    fetched = scorers.length

    if (scorers.length === 0) {
      console.log('[SYNC:scorers] football-data devolvió 0 goleadores')
      return { ok: true, fetched: 0, upserted: 0, skipped: 0, errors }
    }

    const matchId = await ensureTournamentScorersMatch()
    const playerMap = await getPlayerUuidMap()
    const teamMap = await getTeamUuidMap()
    const capturedAt = new Date().toISOString()
    const rows: PlayerRatingRow[] = []

    for (const entry of scorers) {
      const playerUuid = await ensureScorerPlayerUuid(entry, playerMap, teamMap)
      if (!playerUuid) {
        skipped += 1
        continue
      }

      const goals = Number(entry.goals ?? 0)
      const assists = Number(entry.assists ?? 0)
      if (goals <= 0 && assists <= 0) {
        skipped += 1
        continue
      }

      rows.push({
        player_id: playerUuid,
        match_id: matchId,
        goals,
        assists,
        source: FOOTBALL_DATA_TOURNAMENT_SCORERS_SOURCE,
        captured_at: capturedAt,
      })
    }

    if (rows.length === 0) {
      return { ok: true, fetched, upserted: 0, skipped, errors }
    }

    const { error: deleteError } = await supabase
      .from('player_ratings')
      .delete()
      .eq('match_id', matchId)
      .eq('source', FOOTBALL_DATA_TOURNAMENT_SCORERS_SOURCE)

    if (deleteError) throw deleteError

    const { error: upsertError } = await supabase
      .from('player_ratings')
      .upsert(rows, { onConflict: 'player_id,match_id,source' })

    if (upsertError) throw upsertError

    upserted = rows.length
    console.log(
      `[SYNC:scorers] football-data fetched=${fetched} upserted=${upserted} skipped=${skipped}`,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(msg)
    console.error('[SYNC:scorers]', msg)
  }

  return {
    ok: errors.length === 0,
    fetched,
    upserted,
    skipped,
    errors,
  }
}
