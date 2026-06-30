import type { AdminUserPredictionRow } from '../types/admin'
import { KNOCKOUT_SCORING } from '../constants/knockoutScoring'

const KNOCKOUT_PHASES = new Set([
  'LAST_32',
  'LAST_16',
  'ROUND_OF_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
])

export function isKnockoutAdminPhase(phase?: string | null): boolean {
  if (!phase) return false
  return KNOCKOUT_PHASES.has(phase) || phase.includes('KNOCKOUT')
}

function winnerFromScores(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

function penaltyWinnerFromScores(
  homePen: number | null | undefined,
  awayPen: number | null | undefined,
): 'home' | 'away' | null {
  if (homePen == null || awayPen == null) return null
  if (homePen > awayPen) return 'home'
  if (awayPen > homePen) return 'away'
  return null
}

function teamLabel(
  side: 'home' | 'away',
  p: AdminUserPredictionRow,
): string {
  if (side === 'home') return p.home_team_code ?? p.home_team ?? 'Local'
  return p.away_team_code ?? p.away_team ?? 'Visit.'
}

export type AdminPredictionPart = {
  key: 'r90' | 'et' | 'pen'
  label: string
  predicted: string
  actual: string | null
  points: number
  maxPoints: number
  hit: boolean | null
}

export type AdminPredictionBreakdown = {
  isKnockout: boolean
  parts: AdminPredictionPart[]
  totalPoints: number
  maxPoints: number
}

export function buildAdminPredictionBreakdown(p: AdminUserPredictionRow): AdminPredictionBreakdown {
  const isKnockout = isKnockoutAdminPhase(p.match_phase)
  const predHome = p.predicted_score_home
  const predAway = p.predicted_score_away

  if (!isKnockout || predHome == null || predAway == null) {
    const actual =
      p.result_home != null && p.result_away != null
        ? `${p.result_home}-${p.result_away}`
        : null
    const pts = p.status === 'scored' ? (p.points ?? 0) : 0
    const hit90 = pts > 0

    return {
      isKnockout: false,
      parts: [
        {
          key: 'r90',
          label: 'Partido (90\')',
          predicted: `${predHome}-${predAway}`,
          actual,
          points: pts,
          maxPoints: 5,
          hit: p.status === 'scored' ? hit90 : null,
        },
      ],
      totalPoints: pts,
      maxPoints: 5,
    }
  }

  const actualHome = p.result_home
  const actualAway = p.result_away
  const actual90 =
    actualHome != null && actualAway != null ? `${actualHome}-${actualAway}` : null

  const actualEtHome =
    p.result_et_home != null
      ? p.result_et_home
      : actualHome != null && p.result_home_after_et != null
        ? p.result_home_after_et - actualHome
        : null
  const actualEtAway =
    p.result_et_away != null
      ? p.result_et_away
      : actualAway != null && p.result_away_after_et != null
        ? p.result_away_after_et - actualAway
        : null
  const actualEt =
    actualEtHome != null && actualEtAway != null ? `${actualEtHome}-${actualEtAway}` : null

  const actualPen = p.result_penalty_winner
    ? teamLabel(p.result_penalty_winner, p)
    : penaltyWinnerFromScores(p.result_home_penalties, p.result_away_penalties)
      ? teamLabel(
          penaltyWinnerFromScores(p.result_home_penalties, p.result_away_penalties)!,
          p,
        )
      : null

  const predEtHome = p.predicted_et_score_home
  const predEtAway = p.predicted_et_score_away
  const predEt =
    predEtHome != null && predEtAway != null ? `${predEtHome}-${predEtAway}` : '—'
  const predPen = p.predicted_penalty_winner
    ? teamLabel(p.predicted_penalty_winner, p)
    : '—'

  const matchHadEt =
    actualEtHome != null &&
    actualEtAway != null &&
    (actualEtHome !== 0 ||
      actualEtAway !== 0 ||
      p.result_home_penalties != null ||
      p.result_penalty_winner != null)

  const matchHadPen =
    p.result_penalty_winner != null ||
    (p.result_home_penalties != null && p.result_away_penalties != null)

  const hit90 =
    actualHome != null &&
    actualAway != null &&
    winnerFromScores(predHome, predAway) === winnerFromScores(actualHome, actualAway)

  const hitEt =
    matchHadEt &&
    predEtHome != null &&
    predEtAway != null &&
    actualEtHome != null &&
    actualEtAway != null &&
    predEtHome === actualEtHome &&
    predEtAway === actualEtAway

  const hitPen =
    matchHadPen &&
    p.predicted_penalty_winner != null &&
    (p.result_penalty_winner === p.predicted_penalty_winner ||
      (p.result_home_penalties != null &&
        p.result_away_penalties != null &&
        penaltyWinnerFromScores(p.result_home_penalties, p.result_away_penalties) ===
          p.predicted_penalty_winner))

  const pts90 = hit90 ? KNOCKOUT_SCORING.result90 : 0
  const ptsEt = hitEt ? KNOCKOUT_SCORING.afterExtraTime : 0
  const ptsPen = hitPen ? KNOCKOUT_SCORING.penaltyWinner : 0

  const parts: AdminPredictionPart[] = [
    {
      key: 'r90',
      label: "Partido (90')",
      predicted: `${predHome}-${predAway}`,
      actual: actual90,
      points: p.status === 'scored' ? pts90 : 0,
      maxPoints: KNOCKOUT_SCORING.result90,
      hit: p.status === 'scored' ? hit90 : null,
    },
  ]

  if (predHome === predAway || matchHadEt) {
    parts.push({
      key: 'et',
      label: 'Alargue',
      predicted: predEt,
      actual: actualEt,
      points: p.status === 'scored' ? ptsEt : 0,
      maxPoints: KNOCKOUT_SCORING.afterExtraTime,
      hit: p.status === 'scored' ? (matchHadEt ? hitEt : null) : null,
    })
  }

  if (p.predicted_penalty_winner || matchHadPen) {
    parts.push({
      key: 'pen',
      label: 'Penales (ganador)',
      predicted: predPen,
      actual: actualPen,
      points: p.status === 'scored' ? ptsPen : 0,
      maxPoints: KNOCKOUT_SCORING.penaltyWinner,
      hit: p.status === 'scored' ? (matchHadPen ? hitPen : null) : null,
    })
  }

  return {
    isKnockout: true,
    parts,
    totalPoints: p.status === 'scored' ? (p.points ?? 0) : 0,
    maxPoints: KNOCKOUT_SCORING.maxTotal,
  }
}

export function formatAdminPredictionScore(p: AdminUserPredictionRow): string {
  const b = buildAdminPredictionBreakdown(p)
  return b.parts.map(part => `${part.label}: ${part.predicted}`).join(' · ')
}

export function formatAdminPredictionPoints(p: AdminUserPredictionRow): { label: string; muted?: boolean } {
  if (p.status === 'scored') {
    return { label: `${p.points ?? 0} pts` }
  }
  if (p.status === 'locked') {
    if (p.match_status === 'live' || p.match_status === 'halftime') {
      return { label: 'En juego', muted: true }
    }
    if (p.match_status === 'finished') {
      return { label: 'Sin puntuar', muted: true }
    }
    return { label: 'Bloqueada', muted: true }
  }
  return { label: 'Pendiente', muted: true }
}
