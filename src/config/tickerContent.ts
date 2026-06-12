import type { AdminCard } from '../types/admin.ts'
import { resolveScoringDisplay, type ScoringDisplayConfig } from './scoringDisplay.ts'

export const TICKER_CONTENT_KEYS = {
  welcome: 'ticker_welcome',
  tipTitle: 'ticker_tip_title',
  tipMessage: 'ticker_scoring_tip',
  important: 'important_message',
} as const

/** Cards de ticker/puntos que deben publicarse siempre en la app. */
export const TICKER_PUBLIC_CARD_KEYS = [
  TICKER_CONTENT_KEYS.welcome,
  TICKER_CONTENT_KEYS.tipTitle,
  TICKER_CONTENT_KEYS.tipMessage,
  'scoring_exact_pts',
  'scoring_result_pts',
] as const

export function shouldPublishTickerCard(key: string): boolean {
  return (TICKER_PUBLIC_CARD_KEYS as readonly string[]).includes(key)
}

export const DEFAULT_TICKER_CONTENT = {
  welcomeTitle: 'PRODEMUNDIAL 2026',
  welcomeMessage: 'Viví el Mundial · Hacé tus predicciones antes de cada partido',
  tipTitle: 'Tip',
  importantTitle: 'Aviso',
} as const

export type TickerContentConfig = {
  welcomeTitle: string
  welcomeMessage: string
  tipTitle: string
  tipMessage: string
  importantTitle: string
  importantMessage: string | null
  importantActive: boolean
}

function pickDisplayValue(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed || trimmed === '—') return null
  return trimmed
}

export function resolveTickerContent(
  cards: AdminCard[],
  scoring?: ScoringDisplayConfig,
): TickerContentConfig {
  const byKey = Object.fromEntries(cards.map(card => [card.key, card]))
  const resolvedScoring = scoring ?? resolveScoringDisplay(cards)

  const welcomeCard = byKey[TICKER_CONTENT_KEYS.welcome]
  const tipTitleCard = byKey[TICKER_CONTENT_KEYS.tipTitle]
  const importantCard = byKey[TICKER_CONTENT_KEYS.important]

  const welcomeTitle =
    welcomeCard?.title?.trim() || DEFAULT_TICKER_CONTENT.welcomeTitle
  const welcomeMessage =
    pickDisplayValue(welcomeCard?.value) ?? DEFAULT_TICKER_CONTENT.welcomeMessage
  const tipTitle =
    pickDisplayValue(tipTitleCard?.value) ?? DEFAULT_TICKER_CONTENT.tipTitle
  const importantTitle =
    importantCard?.title?.trim() || DEFAULT_TICKER_CONTENT.importantTitle
  const importantMessage = pickDisplayValue(importantCard?.value)

  return {
    welcomeTitle,
    welcomeMessage,
    tipTitle,
    tipMessage: resolvedScoring.tickerTipMessage,
    importantTitle,
    importantMessage,
    importantActive: Boolean(importantMessage),
  }
}
