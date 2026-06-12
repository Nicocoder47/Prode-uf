import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FOOTBALL_DATA_PROVIDER = 'football_data'
const API_FOOTBALL_PROVIDER = 'api_football'
const TOURNAMENT_SCORERS_PROVIDER_MATCH_ID = '__tournament_scorers__'
const FOOTBALL_DATA_TOURNAMENT_SCORERS_SOURCE = 'football_data_tournament'
const TBD_TEAM_ID = '00000000-0000-4000-8000-000000000001'

function todayInArgentina(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
}

function mapFootballDataStatus(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: 'scheduled',
    TIMED: 'scheduled',
    IN_PLAY: 'live',
    PAUSED: 'halftime',
    FINISHED: 'finished',
    POSTPONED: 'postponed',
    SUSPENDED: 'suspended',
    CANCELLED: 'cancelled',
  }
  return map[status] ?? 'scheduled'
}

function extractGroupLabel(group?: string | null): string | null {
  if (!group) return null
  const match = group.match(/GROUP_?([A-L])/i)
  return match?.[1]?.toUpperCase() ?? null
}

type MatchRow = {
  provider: string
  provider_match_id: string
  home_team_id: string
  away_team_id: string
  kick_off: string
  phase: string | null
  round: string | null
  group_label: string | null
  status: string
  score_home: number | null
  score_away: number | null
  updated_at: string
}

async function fetchFootballDataToday(apiKey: string, wcCode: string, teamMap: Map<string, string>): Promise<MatchRow[]> {
  const day = todayInArgentina()
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${wcCode}/matches?dateFrom=${day}&dateTo=${day}`,
    { headers: { 'X-Auth-Token': apiKey } },
  )
  if (!res.ok) {
    throw new Error(`football-data HTTP ${res.status}`)
  }
  const body = await res.json() as { matches?: Record<string, unknown>[] }
  const rows: MatchRow[] = []

  for (const raw of body.matches ?? []) {
    const home = raw.homeTeam as { id?: number } | undefined
    const away = raw.awayTeam as { id?: number } | undefined
    const homeUuid = home?.id != null ? teamMap.get(String(home.id)) : undefined
    const awayUuid = away?.id != null ? teamMap.get(String(away.id)) : undefined
    if (!homeUuid || !awayUuid) continue

    const score = raw.score as {
      fullTime?: { home?: number | null; away?: number | null }
      halfTime?: { home?: number | null; away?: number | null }
    } | undefined
    const ftHome = score?.fullTime?.home
    const ftAway = score?.fullTime?.away
    const mappedStatus = mapFootballDataStatus(String(raw.status ?? 'SCHEDULED'))
    const scoreHome =
      ftHome != null && ftAway != null
        ? ftHome
        : mappedStatus === 'live' || mappedStatus === 'halftime'
          ? (score?.halfTime?.home ?? null)
          : (ftHome ?? null)
    const scoreAway =
      ftHome != null && ftAway != null
        ? ftAway
        : mappedStatus === 'live' || mappedStatus === 'halftime'
          ? (score?.halfTime?.away ?? null)
          : (ftAway ?? null)
    const stage = String(raw.stage ?? raw.matchday ?? '')

    rows.push({
      provider: FOOTBALL_DATA_PROVIDER,
      provider_match_id: String(raw.id ?? ''),
      home_team_id: homeUuid,
      away_team_id: awayUuid,
      kick_off: String(raw.utcDate ?? new Date().toISOString()),
      phase: stage || null,
      round: stage || null,
      group_label: extractGroupLabel(raw.group as string | undefined),
      status: mappedStatus,
      score_home: scoreHome,
      score_away: scoreAway,
      updated_at: new Date().toISOString(),
    })
  }

  return rows
}

function mapApiFootballStatus(short: string): string {
  const map: Record<string, string> = {
    NS: 'scheduled',
    TBD: 'scheduled',
    '1H': 'live',
    HT: 'halftime',
    '2H': 'live',
    ET: 'live',
    BT: 'halftime',
    P: 'live',
    FT: 'finished',
    AET: 'finished',
    PEN: 'finished',
    PST: 'postponed',
    CANC: 'cancelled',
    ABD: 'cancelled',
  }
  return map[short] ?? 'scheduled'
}

async function fetchApiFootballToday(apiKey: string, leagueId: string, season: string, teamMap: Map<string, string>): Promise<MatchRow[]> {
  const day = todayInArgentina()
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?date=${day}&league=${leagueId}&season=${season}`,
    {
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
        'x-rapidapi-key': apiKey,
      },
    },
  )
  if (!res.ok) {
    throw new Error(`api-football HTTP ${res.status}`)
  }
  const body = await res.json() as { response?: Record<string, unknown>[] }
  const rows: MatchRow[] = []

  for (const item of body.response ?? []) {
    const fixture = item.fixture as { id?: number; date?: string; status?: { short?: string } }
    const teams = item.teams as { home?: { id?: number }; away?: { id?: number } }
    const goals = item.goals as { home?: number | null; away?: number | null }
    const league = item.league as { round?: string }
    const homeUuid = teams.home?.id != null ? teamMap.get(String(teams.home.id)) : undefined
    const awayUuid = teams.away?.id != null ? teamMap.get(String(teams.away.id)) : undefined
    if (!homeUuid || !awayUuid || fixture.id == null) continue

    rows.push({
      provider: API_FOOTBALL_PROVIDER,
      provider_match_id: String(fixture.id),
      home_team_id: homeUuid,
      away_team_id: awayUuid,
      kick_off: String(fixture.date ?? new Date().toISOString()),
      phase: league.round ?? null,
      round: league.round ?? null,
      group_label: null,
      status: mapApiFootballStatus(String(fixture.status?.short ?? 'NS')),
      score_home: goals.home ?? null,
      score_away: goals.away ?? null,
      updated_at: new Date().toISOString(),
    })
  }

  return rows
}

type ScorerRatingRow = {
  player_id: string
  match_id: string
  goals: number
  assists: number
  source: string
  captured_at: string
}

async function ensureTournamentScorersMatch(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const { data: existing } = await supabase
    .from('matches')
    .select('id')
    .eq('provider', FOOTBALL_DATA_PROVIDER)
    .eq('provider_match_id', TOURNAMENT_SCORERS_PROVIDER_MATCH_ID)
    .maybeSingle()

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

async function syncFootballDataScorers(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  wcCode: string,
  season: string,
): Promise<{ fetched: number; upserted: number; skipped: number }> {
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${wcCode}/scorers?limit=50&season=${season}`,
    { headers: { 'X-Auth-Token': apiKey } },
  )
  if (!res.ok) {
    throw new Error(`football-data scorers HTTP ${res.status}`)
  }

  const body = await res.json() as { scorers?: Record<string, unknown>[] }
  const scorers = body.scorers ?? []
  if (scorers.length === 0) {
    return { fetched: 0, upserted: 0, skipped: 0 }
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id,provider_player_id')
    .eq('provider', FOOTBALL_DATA_PROVIDER)

  if (playersError) throw playersError

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id,provider_team_id')
    .eq('provider', FOOTBALL_DATA_PROVIDER)

  if (teamsError) throw teamsError

  const playerMap = new Map(
    (players ?? [])
      .filter(p => p.provider_player_id)
      .map(p => [String(p.provider_player_id), String(p.id)]),
  )

  const teamMap = new Map(
    (teams ?? [])
      .filter(t => t.provider_team_id)
      .map(t => [String(t.provider_team_id), String(t.id)]),
  )

  const matchId = await ensureTournamentScorersMatch(supabase)
  const capturedAt = new Date().toISOString()
  const rows: ScorerRatingRow[] = []
  let skipped = 0

  for (const entry of scorers) {
    const player = entry.player as Record<string, unknown> | undefined
    const team = entry.team as { id?: number } | undefined
    const providerPlayerId = player?.id != null ? String(player.id) : ''
    if (!providerPlayerId) {
      skipped += 1
      continue
    }

    let playerUuid = playerMap.get(providerPlayerId)
    if (!playerUuid) {
      const teamProviderId = team?.id != null ? String(team.id) : ''
      const teamUuid = teamProviderId ? teamMap.get(teamProviderId) : undefined
      if (teamUuid) {
        const now = new Date().toISOString()
        const { data: created, error: createErr } = await supabase
          .from('players')
          .upsert(
            {
              provider: FOOTBALL_DATA_PROVIDER,
              provider_player_id: providerPlayerId,
              team_id: teamUuid,
              name: String(player?.name ?? 'Unknown'),
              nationality: (player?.nationality as string | null) ?? null,
              position: (player?.position as string | null) ?? null,
              updated_at: now,
            },
            { onConflict: 'provider,provider_player_id' },
          )
          .select('id')
          .single()
        if (!createErr && created?.id) {
          playerUuid = String(created.id)
          playerMap.set(providerPlayerId, playerUuid)
        }
      }
    }

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
    return { fetched: scorers.length, upserted: 0, skipped }
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

  console.log(`[sync-today-results] scorers fetched=${scorers.length} upserted=${rows.length} skipped=${skipped}`)
  return { fetched: scorers.length, upserted: rows.length, skipped }
}

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const footballDataKey = Deno.env.get('FOOTBALL_DATA_API_KEY')?.trim()
    const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY')?.trim()
    const wcCode = Deno.env.get('FOOTBALL_DATA_WORLD_CUP_CODE') ?? 'WC'
    const leagueId = Deno.env.get('API_FOOTBALL_WORLD_CUP_LEAGUE_ID') ?? '1'
    const season = Deno.env.get('API_FOOTBALL_WORLD_CUP_SEASON') ?? '2026'
    const wcSeason = Deno.env.get('FOOTBALL_DATA_SEASON') ?? season

    if (!supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ error: 'missing_supabase_env' }), { status: 500 })
    }
    if (!footballDataKey && !apiFootballKey) {
      return new Response(JSON.stringify({ error: 'missing_football_api_key' }), { status: 503 })
    }

    const supabase = createClient(supabaseUrl, serviceRole)
    const provider = footballDataKey ? FOOTBALL_DATA_PROVIDER : API_FOOTBALL_PROVIDER

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id,provider_team_id')
      .eq('provider', provider)

    if (teamsError) {
      return new Response(JSON.stringify({ error: teamsError.message }), { status: 500 })
    }

    const teamMap = new Map((teams ?? []).map(t => [String(t.provider_team_id), String(t.id)]))
    const rows = footballDataKey
      ? await fetchFootballDataToday(footballDataKey, wcCode, teamMap)
      : await fetchApiFootballToday(apiFootballKey!, leagueId, season, teamMap)

    console.log(`[sync-today-results] provider=${provider} day=${todayInArgentina()} fetched=${rows.length}`)

    let upserted = 0
    if (rows.length > 0) {
      // No pisar marcadores existentes si la API devuelve null en fullTime.
      const ids = rows.map(r => r.provider_match_id)
      const { data: existingRows } = await supabase
        .from('matches')
        .select('provider_match_id,status,score_home,score_away')
        .eq('provider', provider)
        .in('provider_match_id', ids)

      const existingById = new Map(
        (existingRows ?? []).map(r => [String(r.provider_match_id), r]),
      )

      const mergedRows = rows.map(row => {
        const prev = existingById.get(row.provider_match_id)
        let next = {
          ...row,
          score_home: row.score_home ?? prev?.score_home ?? null,
          score_away: row.score_away ?? prev?.score_away ?? null,
        }
        if (
          next.status === 'finished' &&
          (next.score_home == null || next.score_away == null)
        ) {
          const fallback =
            prev?.status && prev.status !== 'finished' ? prev.status : 'scheduled'
          console.warn(
            `[sync-today-results] WARN provider_match_id=${row.provider_match_id}: finished sin marcador — status=${fallback}`,
          )
          next = { ...next, status: fallback }
        }
        return next
      })

      for (const row of mergedRows) {
        console.log(
          `[sync-today-results] upsert provider_match_id=${row.provider_match_id} status=${row.status} score=${row.score_home ?? 'null'}-${row.score_away ?? 'null'}`,
        )
      }

      const { error: upsertError } = await supabase
        .from('matches')
        .upsert(mergedRows, { onConflict: 'provider,provider_match_id' })

      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 })
      }
      upserted = rows.length
    }

    let scorersUpserted = 0
    let scorersFetched = 0
    if (footballDataKey) {
      try {
        const scorers = await syncFootballDataScorers(supabase, footballDataKey, wcCode, wcSeason)
        scorersFetched = scorers.fetched
        scorersUpserted = scorers.upserted
      } catch (scorersErr) {
        console.warn(
          '[sync-today-results] scorers sync failed:',
          scorersErr instanceof Error ? scorersErr.message : scorersErr,
        )
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        upserted,
        scorersFetched,
        scorersUpserted,
        provider,
        day: todayInArgentina(),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500 },
    )
  }
})
