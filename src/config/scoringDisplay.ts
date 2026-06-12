import type { AdminCard } from '../types/admin.ts'

export const SCORING_DISPLAY_CARD_KEYS = {
  exactPts: 'scoring_exact_pts',
  resultPts: 'scoring_result_pts',
  tickerTip: 'ticker_scoring_tip',
} as const

export const DEFAULT_SCORING_DISPLAY = {
  exactPts: 5,
  resultPts: 3,
} as const

export type ScoringDisplayConfig = {
  exactPts: number
  resultPts: number
  tickerTipMessage: string
}

export function parseScoringPts(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export function buildScoringTipMessage(
  exactPts: number,
  resultPts: number,
  custom?: string | null,
): string {
  const trimmed = (custom ?? '').trim()
  if (trimmed && trimmed !== '—') return trimmed
  return `Sumá puntos acertando el marcador exacto (${exactPts}) o el resultado (${resultPts})`
}

export function resolveScoringDisplay(cards: AdminCard[]): ScoringDisplayConfig {
  const byKey = Object.fromEntries(cards.map(card => [card.key, card]))
  const exactPts = parseScoringPts(
    byKey[SCORING_DISPLAY_CARD_KEYS.exactPts]?.value,
    DEFAULT_SCORING_DISPLAY.exactPts,
  )
  const resultPts = parseScoringPts(
    byKey[SCORING_DISPLAY_CARD_KEYS.resultPts]?.value,
    DEFAULT_SCORING_DISPLAY.resultPts,
  )
  const customTip = byKey[SCORING_DISPLAY_CARD_KEYS.tickerTip]?.value

  return {
    exactPts,
    resultPts,
    tickerTipMessage: buildScoringTipMessage(exactPts, resultPts, customTip),
  }
}
