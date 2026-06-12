import type { AdminCard } from '../types/admin.ts'
import type { LeaderboardEntry } from '../types/worldcup.ts'

export const RANKING_LORE_CARD_KEYS = {
  enabled: 'ranking_lore_enabled',
  auto: 'ranking_lore_auto',
  emoji: 'ranking_lore_emoji',
  headline: 'ranking_lore_headline',
  subject: 'ranking_lore_subject',
  body: 'ranking_lore_body',
  distance: 'ranking_lore_distance',
  objective: 'ranking_lore_objective',
} as const

export type RankingLoreConfig = {
  enabled: boolean
  /** Si true, nombre / cuerpo / distancia salen del 2° del leaderboard en vivo. */
  autoFromLeaderboard: boolean
  emoji: string
  headline: string
  subjectName: string
  body: string
  /** Puntos acumulados del protagonista (2° en modo auto). */
  subjectPoints: number
  objective: string
}

export const DEFAULT_RANKING_LORE: RankingLoreConfig = {
  enabled: false,
  autoFromLeaderboard: true,
  emoji: '🎯',
  headline: 'TIENE AL LÍDER EN LA MIRA',
  subjectName: 'Marcelo Arguello',
  body:
    'Marcelo Arguello sigue de cerca la pelea por el primer puesto. La diferencia es mínima y un resultado exacto podría cambiar el ranking en cualquier momento.',
  subjectPoints: 0,
  objective: 'superar al líder',
}

function loreDisplayName(entry: LeaderboardEntry): string {
  const name = entry.profile?.fullName?.trim()
  if (name) return name
  return entry.profile?.legajo?.trim() || `Jugador #${entry.rank}`
}

function defaultHeadline(distancePts: number): string {
  if (distancePts <= 0) return 'TIENE AL LÍDER EN LA MIRA'
  if (distancePts <= 3) return 'A UN PASO DEL LÍDER'
  return 'ESCALA EN EL RANKING'
}

function defaultBody(subjectName: string, leaderName: string): string {
  return `${subjectName} sigue de cerca la pelea por el primer puesto contra ${leaderName}. Un resultado exacto podría cambiar el ranking en cualquier momento.`
}

/** Combina plantilla admin con el 2° puesto real del leaderboard. */
export function buildRankingLoreFromLeaderboard(
  leaderboard: LeaderboardEntry[],
  template: RankingLoreConfig,
): RankingLoreConfig | null {
  if (!template.enabled) return null

  if (!template.autoFromLeaderboard) {
    return template.headline.trim() ? template : null
  }

  const runnerUp = leaderboard.find(entry => entry.rank === 2) ?? leaderboard[1]
  if (!runnerUp) return null

  const leader = leaderboard.find(entry => entry.rank === 1) ?? leaderboard[0]
  const subjectName = loreDisplayName(runnerUp)
  const leaderName = leader ? loreDisplayName(leader) : 'el líder'
  const distancePts = leader ? Math.max(0, leader.points - runnerUp.points) : 0
  const headline = template.headline.trim() || defaultHeadline(distancePts)

  return {
    ...template,
    headline,
    subjectName,
    body: defaultBody(subjectName, leaderName),
    subjectPoints: runnerUp.points,
    objective: template.objective.trim() || 'superar al líder',
  }
}

function findCard(cards: AdminCard[], key: string) {
  return cards.find(card => card.key === key)
}

function readFlag(value: string | null | undefined): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readPts(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export function resolveRankingLore(cards: AdminCard[]): RankingLoreConfig {
  const enabledCard = findCard(cards, RANKING_LORE_CARD_KEYS.enabled)
  const autoCard = findCard(cards, RANKING_LORE_CARD_KEYS.auto)
  const emojiCard = findCard(cards, RANKING_LORE_CARD_KEYS.emoji)
  const headlineCard = findCard(cards, RANKING_LORE_CARD_KEYS.headline)
  const subjectCard = findCard(cards, RANKING_LORE_CARD_KEYS.subject)
  const bodyCard = findCard(cards, RANKING_LORE_CARD_KEYS.body)
  const distanceCard = findCard(cards, RANKING_LORE_CARD_KEYS.distance)
  const objectiveCard = findCard(cards, RANKING_LORE_CARD_KEYS.objective)

  if (!enabledCard && !headlineCard && !bodyCard) {
    return { ...DEFAULT_RANKING_LORE }
  }

  return {
    enabled: enabledCard ? readFlag(enabledCard.value) : DEFAULT_RANKING_LORE.enabled,
    autoFromLeaderboard: autoCard ? readFlag(autoCard.value) : DEFAULT_RANKING_LORE.autoFromLeaderboard,
    emoji: (emojiCard?.icon ?? emojiCard?.value ?? DEFAULT_RANKING_LORE.emoji).trim() || '🎯',
    headline: (headlineCard?.value ?? DEFAULT_RANKING_LORE.headline).trim(),
    subjectName: (subjectCard?.value ?? DEFAULT_RANKING_LORE.subjectName).trim(),
    body: (bodyCard?.description ?? bodyCard?.value ?? DEFAULT_RANKING_LORE.body).trim(),
    subjectPoints: readPts(distanceCard?.value, DEFAULT_RANKING_LORE.subjectPoints),
    objective: (objectiveCard?.value ?? DEFAULT_RANKING_LORE.objective).trim(),
  }
}
