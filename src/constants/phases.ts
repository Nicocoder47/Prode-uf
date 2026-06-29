import type { MatchStage, Match } from '../types/worldcup'

export interface TournamentPhase {
  id: MatchStage
  label: string
  shortLabel: string
  order: number
  expectedMatches: number
}

export const TOURNAMENT_PHASES: TournamentPhase[] = [
  { id: 'group', label: 'Fase de grupos', shortLabel: 'Grupos', order: 0, expectedMatches: 72 },
  { id: 'round32', label: '16avos de final', shortLabel: '16avos', order: 1, expectedMatches: 16 },
  { id: 'round16', label: 'Octavos de final', shortLabel: 'Octavos', order: 2, expectedMatches: 8 },
  { id: 'quarterfinals', label: 'Cuartos de final', shortLabel: 'Cuartos', order: 3, expectedMatches: 4 },
  { id: 'semifinals', label: 'Semifinales', shortLabel: 'Semis', order: 4, expectedMatches: 2 },
  { id: 'thirdplace', label: '3.er puesto', shortLabel: '3.°', order: 5, expectedMatches: 1 },
  { id: 'final', label: 'Final', shortLabel: 'Final', order: 6, expectedMatches: 1 },
]

export function getPhaseById(id: MatchStage): TournamentPhase | undefined {
  return TOURNAMENT_PHASES.find(p => p.id === id)
}

export function getPhaseLabel(id: MatchStage): string {
  return getPhaseById(id)?.label ?? id
}

function hasResolvedTeams(match: Match): boolean {
  const homeCode = match.homeTeam?.code?.trim().toUpperCase()
  const awayCode = match.awayTeam?.code?.trim().toUpperCase()
  const homeName = match.homeTeam?.name?.trim().toLowerCase()
  const awayName = match.awayTeam?.name?.trim().toLowerCase()

  return Boolean(
    homeCode &&
      awayCode &&
      homeCode !== 'TBD' &&
      awayCode !== 'TBD' &&
      homeName &&
      awayName &&
      !homeName.includes('por definir') &&
      !awayName.includes('por definir'),
  )
}

/**
 * Una fase está desbloqueada si hay al menos un partido en esa stage
 * con equipos resueltos (no TBD) en la API.
 */
export function isPhaseUnlocked(stage: MatchStage, matches: Match[]): boolean {
  if (stage === 'group') return true
  return matches.some(m => m.stage === stage && hasResolvedTeams(m))
}

/** Fase de grupos terminada: no quedan partidos programados ni en juego. */
export function isGroupStageComplete(matches: Match[]): boolean {
  const groupMatches = matches.filter(m => m.stage === 'group')
  if (groupMatches.length === 0) return isPhaseUnlocked('round32', matches)
  return !groupMatches.some(
    m => m.status === 'scheduled' || m.status === 'live' || m.status === 'halftime',
  )
}

/** Fase por defecto al entrar a Jugar (16avos si ya terminó la fase de grupos). */
export function resolveDefaultPlayPhase(matches: Match[]): MatchStage {
  if (isGroupStageComplete(matches) || isPhaseUnlocked('round32', matches)) {
    return 'round32'
  }
  return 'group'
}

export function buildPlayMatchesUrl(phase: MatchStage, matchId?: string): string {
  const params = new URLSearchParams({ phase })
  if (matchId) params.set('match', matchId)
  return `/matches?${params.toString()}`
}

export function getMatchesByStage(matches: Match[], stage: MatchStage): Match[] {
  return matches
    .filter(m => m.stage === stage)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
}

export interface PhaseProgress {
  stage: MatchStage
  label: string
  total: number
  predicted: number
  pending: number
  unlocked: boolean
}

export function computeAllPhasesProgress(
  matches: Match[],
  predictionIds: Set<string>,
): PhaseProgress[] {
  return TOURNAMENT_PHASES.map(phase => {
    const stageMatches = matches.filter(m => m.stage === phase.id)
    const predicted = stageMatches.filter(m => predictionIds.has(m.id)).length
    const pending = stageMatches.filter(
      m => m.status === 'scheduled' && !m.isLocked && !predictionIds.has(m.id),
    ).length
    const unlocked = isPhaseUnlocked(phase.id, matches)

    return {
      stage: phase.id,
      label: phase.shortLabel,
      total: stageMatches.length || phase.expectedMatches,
      predicted,
      pending,
      unlocked,
    }
  })
}
