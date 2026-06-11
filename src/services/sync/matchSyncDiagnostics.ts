import { supabase } from '../../database/supabaseClient'

export type MatchSyncAction = 'upsert' | 'skip'

export type MatchSyncDiagnostic = {
  provider: string
  providerMatchId: string
  externalStatus: string
  scoreHome: number | null
  scoreAway: number | null
  homeProviderTeamId: string | null
  awayProviderTeamId: string | null
  localMatchUuid: string | null
  action: MatchSyncAction
  skipReason?: string
  dbScoreHomeBefore?: number | null
  dbScoreAwayBefore?: number | null
  scorePreserved?: boolean
  wouldUpdate?: boolean
  wouldUpdateReason?: string
}

export function logMatchSyncDiagnostic(entry: MatchSyncDiagnostic): void {
  const prefix = '[SYNC:match]'
  if (entry.action === 'skip') {
    console.warn(
      `${prefix} SKIP provider_match_id=${entry.providerMatchId} reason=${entry.skipReason ?? 'unknown'}`,
    )
    return
  }

  const score = `${entry.scoreHome ?? 'null'}-${entry.scoreAway ?? 'null'}`
  const dbBefore =
    entry.dbScoreHomeBefore != null || entry.dbScoreAwayBefore != null
      ? ` db_before=${entry.dbScoreHomeBefore ?? 'null'}-${entry.dbScoreAwayBefore ?? 'null'}`
      : ''
  const preserved = entry.scorePreserved ? ' score_preserved=true' : ''

  console.log(
    `${prefix} UPSERT provider=${entry.provider} provider_match_id=${entry.providerMatchId} status=${entry.externalStatus} score=${score} local_uuid=${entry.localMatchUuid ?? 'new'}${dbBefore}${preserved}`,
  )
}

export function logSyncPhase(phase: string, detail: Record<string, unknown>): void {
  console.log(`[SYNC:${phase}]`, JSON.stringify(detail))
}

type MatchRow = {
  provider: string
  provider_match_id: string
  status: string
  score_home: number | null
  score_away: number | null
  home_team_id?: string | null
  away_team_id?: string | null
}

type ExistingMatch = {
  status?: string
  score_home?: number | null
  score_away?: number | null
}

function hasCompleteScore(home: number | null | undefined, away: number | null | undefined): boolean {
  return home != null && away != null
}

/**
 * No marcar finished si la API no trae marcador completo.
 * Evita FIN + 0-0 falso en UI.
 */
export function sanitizeFinishedWithoutScores<T extends MatchRow>(
  row: T,
  existing?: ExistingMatch | null,
): T {
  if (row.status !== 'finished') return row
  if (hasCompleteScore(row.score_home, row.score_away)) return row

  const prevStatus =
    existing?.status && existing.status !== 'finished' ? existing.status : 'scheduled'

  console.warn(
    `[SYNC:match] WARN provider_match_id=${row.provider_match_id}: status=finished sin marcador API — conservando status=${prevStatus}`,
  )

  return { ...row, status: prevStatus }
}

/** Evita que un upsert con score null pise un marcador ya cargado en DB. */
export async function protectExistingScores<T extends MatchRow>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows

  const provider = rows[0].provider
  const ids = rows.map(r => r.provider_match_id).filter(Boolean)
  const { data: existing, error } = await supabase
    .from('matches')
    .select('id,provider_match_id,status,score_home,score_away')
    .eq('provider', provider)
    .in('provider_match_id', ids)

  if (error) {
    console.warn('[SYNC:match] protectExistingScores lookup failed:', error.message)
    return rows
  }

  const byProviderId = new Map(
    (existing ?? []).map(row => [String(row.provider_match_id), row]),
  )

  return rows.map(row => {
    const prev = byProviderId.get(String(row.provider_match_id))

    let next = { ...row }
    if (prev) {
      const incomingHome = row.score_home
      const incomingAway = row.score_away
      const preserveHome = incomingHome == null && prev.score_home != null
      const preserveAway = incomingAway == null && prev.score_away != null
      if (preserveHome || preserveAway) {
        next = {
          ...next,
          score_home: preserveHome ? prev.score_home : incomingHome,
          score_away: preserveAway ? prev.score_away : incomingAway,
        }
      }
    }

    return sanitizeFinishedWithoutScores(next, prev ?? null)
  })
}

export async function lookupLocalMatchUuid(
  provider: string,
  providerMatchId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('matches')
    .select('id')
    .eq('provider', provider)
    .eq('provider_match_id', providerMatchId)
    .maybeSingle()
  return data?.id ?? null
}

export function wouldUpdateMatch(
  api: { status: string; score_home: number | null; score_away: number | null },
  db: { status: string; score_home: number | null; score_away: number | null } | null,
): { wouldUpdate: boolean; reason: string } {
  if (!db) return { wouldUpdate: true, reason: 'partido nuevo en DB' }

  const statusChanged = api.status !== db.status
  const scoreChanged =
    api.score_home !== db.score_home || api.score_away !== db.score_away

  if (api.status === 'finished' && !hasCompleteScore(api.score_home, api.score_away)) {
    return {
      wouldUpdate: false,
      reason: 'API finished sin marcador — se bloquea para evitar FIN 0-0 falso',
    }
  }

  if (!statusChanged && !scoreChanged) {
    return { wouldUpdate: false, reason: 'sin cambios respecto a DB' }
  }

  const parts: string[] = []
  if (statusChanged) parts.push(`status ${db.status}→${api.status}`)
  if (scoreChanged) {
    parts.push(
      `score ${db.score_home ?? 'null'}-${db.score_away ?? 'null'}→${api.score_home ?? 'null'}-${api.score_away ?? 'null'}`,
    )
  }
  return { wouldUpdate: true, reason: parts.join(', ') }
}
