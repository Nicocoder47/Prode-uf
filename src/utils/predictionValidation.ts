import type { PredictionResult } from '../types/worldcup'

/** Deriva el ganador a partir del marcador exacto. */
export function getWinnerFromScore(scoreHome: number, scoreAway: number): PredictionResult {
  if (scoreHome > scoreAway) return 'home'
  if (scoreAway > scoreHome) return 'away'
  return 'draw'
}

export function getResultLabel(
  result: PredictionResult | string | null | undefined,
  homeCode?: string,
  awayCode?: string
): string {
  if (result === 'home') return homeCode ? `Gana ${homeCode}` : 'Gana local'
  if (result === 'away') return awayCode ? `Gana ${awayCode}` : 'Gana visitante'
  if (result === 'draw') return 'Empate'
  return '—'
}

/** true si no hay marcador cargado o si predicted_winner coincide con el marcador. */
export function isPredictionCoherent(
  predictedWinner: PredictionResult | string | null | undefined,
  scoreHome: number | null | undefined,
  scoreAway: number | null | undefined
): boolean {
  if (predictedWinner == null) return false
  if (scoreHome == null || scoreAway == null || Number.isNaN(scoreHome) || Number.isNaN(scoreAway)) {
    return true
  }
  return predictedWinner === getWinnerFromScore(Number(scoreHome), Number(scoreAway))
}

export function validatePredictionCoherence(
  result: PredictionResult,
  homeScore: number,
  awayScore: number
): string | null {
  const derived = getWinnerFromScore(homeScore, awayScore)
  if (result === derived) return null

  const implied =
    derived === 'home' ? 'victoria local' : derived === 'away' ? 'victoria visitante' : 'empate'

  return `El marcador ${homeScore}-${awayScore} implica ${implied}, pero elegiste un resultado distinto. Ajustá el marcador o volvé al paso 1.`
}
