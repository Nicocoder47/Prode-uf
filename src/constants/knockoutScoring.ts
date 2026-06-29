import type { Match, MatchStage } from '../types/worldcup'

export const KNOCKOUT_SCORING = {
  result90: 5,
  afterExtraTime: 3,
  penaltyWinner: 2,
  maxTotal: 10,
} as const

export const GROUP_SCORING = {
  exact: 5,
  result: 3,
  maxTotal: 5,
} as const

const KNOCKOUT_STAGES = new Set<MatchStage>([
  'round32',
  'round16',
  'quarterfinals',
  'semifinals',
  'thirdplace',
  'final',
])

export function isKnockoutMatch(match: Pick<Match, 'stage'>): boolean {
  return KNOCKOUT_STAGES.has(match.stage)
}

export function maxPointsForMatch(match?: Pick<Match, 'stage'> | null): number {
  return match && isKnockoutMatch(match) ? KNOCKOUT_SCORING.maxTotal : GROUP_SCORING.maxTotal
}

export type PenaltyWinnerPick = 'home' | 'away'

export function isEtScoreFilled(
  etHome: number | null | undefined,
  etAway: number | null | undefined,
): etHome is number {
  return etHome != null && etAway != null
}

export function isKnockoutDrawAfterEt(
  etHome: number | null | undefined,
  etAway: number | null | undefined,
): boolean {
  return isEtScoreFilled(etHome, etAway) && etHome === etAway
}

export function cumulativeTotal(
  baseHome: number,
  baseAway: number,
  etHome: number | null,
  etAway: number | null,
): { home: number; away: number } | null {
  if (!isEtScoreFilled(etHome, etAway)) return null
  return { home: baseHome + etHome, away: baseAway + etAway }
}

export function validateKnockoutPrediction(input: {
  homeScore: number
  awayScore: number
  etHomeScore?: number | null
  etAwayScore?: number | null
  penaltyWinner?: PenaltyWinnerPick | null
}): string | null {
  const { homeScore, awayScore, etHomeScore, etAwayScore, penaltyWinner } = input
  if (homeScore !== awayScore) return null

  if (!isEtScoreFilled(etHomeScore, etAwayScore)) {
    return 'Si pronosticás empate en 90 minutos, completá el marcador del alargue (solo tiempo suplementario).'
  }
  if (etHomeScore < 0 || etAwayScore < 0) {
    return 'Los goles del alargue deben ser enteros mayores o iguales a 0.'
  }
  if (isKnockoutDrawAfterEt(etHomeScore, etAwayScore) && !penaltyWinner) {
    return 'Si también empatan en el alargue, elegí quién clasifica por penales.'
  }
  return null
}
