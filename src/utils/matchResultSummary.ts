import type { Match } from '../types/worldcup.ts'

export type MatchResultSummary = {
  homeGoals: number
  awayGoals: number
  totalGoals: number
  outcome: 'home' | 'away' | 'draw'
  outcomeLabel: string
}

export function getMatchResultSummary(match: Match): MatchResultSummary | null {
  if (match.status !== 'finished') return null
  if (match.homeScore == null || match.awayScore == null) return null

  const homeGoals = match.homeScore
  const awayGoals = match.awayScore

  let outcome: MatchResultSummary['outcome'] = 'draw'
  let outcomeLabel = 'Empate'
  if (homeGoals > awayGoals) {
    outcome = 'home'
    outcomeLabel = 'Victoria local'
  } else if (awayGoals > homeGoals) {
    outcome = 'away'
    outcomeLabel = 'Victoria visitante'
  }

  return {
    homeGoals,
    awayGoals,
    totalGoals: homeGoals + awayGoals,
    outcome,
    outcomeLabel,
  }
}
