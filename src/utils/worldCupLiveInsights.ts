import type { GroupProgress, OverallProgress } from './predictionProgress'
import { getNextRewardMilestone, getRecommendedGroup } from './predictionProgress'
import type { LeaderboardEntry, Match, Player, TopScorer } from '../types/worldcup'
import type { LiveMatchStatRow } from '../services/worldcup/worldCupService'

export const LIVE_INSIGHTS_CACHE_MS = 30 * 60 * 1000
/** Mínimo de predicciones para mostrar tendencia como dato de comunidad. */
export const MIN_TREND_PREDICTIONS = 3
const LB_SNAPSHOT_KEY = 'wc26_live_lb_snapshot_v2'

export type WorldCupLiveCardType =
  | 'next_match'
  | 'community_trend'
  | 'ranking_move'
  | 'popular_match'
  | 'top_scorers'
  | 'your_progress'
  | 'next_reward'

export type WorldCupLiveCard = {
  id: string
  type: WorldCupLiveCardType
  emoji: string
  title: string
  subtitle?: string
  cta?: { label: string; action: 'predict' | 'matches' | 'leaderboard' | 'login' }
}

export type NextMatchInsight = WorldCupLiveCard & {
  type: 'next_match'
  match: Match
  countdownLabel: string
}

export type CommunityTrendInsight = WorldCupLiveCard & {
  type: 'community_trend'
  match: Match
  homePct: number
  drawPct: number
  awayPct: number
  favoriteLabel: string
  hasEnoughData: boolean
}

export type RankingMoveInsight = WorldCupLiveCard & {
  type: 'ranking_move'
  lines: string[]
}

export type PopularMatchInsight = WorldCupLiveCard & {
  type: 'popular_match'
  match: Match
  predictionCount: number
  emptyMessage?: string
}

export type TopScorersInsight = WorldCupLiveCard & {
  type: 'top_scorers'
  scorers: { name: string; goals: number }[]
  emptyMessage?: string
}

export type YourProgressInsight = WorldCupLiveCard & {
  type: 'your_progress'
  predicted: number
  total: number
  percent: number
  points: number
  rank: number | null
}

export type NextRewardInsight = WorldCupLiveCard & {
  type: 'next_reward'
  message: string
}

export type WorldCupLiveInsightPayload =
  | NextMatchInsight
  | CommunityTrendInsight
  | RankingMoveInsight
  | PopularMatchInsight
  | TopScorersInsight
  | YourProgressInsight
  | NextRewardInsight

type LbSnapshot = { bucket: number; ranks: Record<string, number> }

function cacheBucket(now = Date.now()): number {
  return Math.floor(now / LIVE_INSIGHTS_CACHE_MS)
}

function readLbSnapshot(): LbSnapshot | null {
  try {
    const raw = localStorage.getItem(LB_SNAPSHOT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LbSnapshot
  } catch {
    return null
  }
}

function writeLbSnapshot(leaderboard: LeaderboardEntry[], bucket: number) {
  const ranks: Record<string, number> = {}
  for (const e of leaderboard) ranks[e.userId] = e.rank
  try {
    localStorage.setItem(LB_SNAPSHOT_KEY, JSON.stringify({ bucket, ranks }))
  } catch {
    /* ignore quota */
  }
}

export function formatCountdownLabel(kickoff: string, now = Date.now()): string {
  const diff = new Date(kickoff).getTime() - now
  if (diff <= 0) return '¡Arranca pronto!'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  if (days > 0) return `Faltan ${days} ${days === 1 ? 'día' : 'días'}`
  if (hours > 0) return `Faltan ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  const mins = Math.max(1, Math.floor((diff % 3_600_000) / 60_000))
  return `Faltan ${mins} min`
}

function displayName(entry: LeaderboardEntry): string {
  const name = entry.profile?.fullName?.trim()
  if (name) return name.split(' ')[0]
  return entry.profile?.legajo ?? `Jugador #${entry.rank}`
}

function shortTeamName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1] ?? name
}

function buildRankingMoves(leaderboard: LeaderboardEntry[]): string[] {
  const bucket = cacheBucket()
  const prev = readLbSnapshot()
  const lines: string[] = []

  if (leaderboard.length === 0) {
    writeLbSnapshot(leaderboard, bucket)
    return ['Esperando movimientos']
  }

  let hasMovement = false

  if (prev && prev.bucket < bucket && Object.keys(prev.ranks).length > 0) {
    for (const entry of leaderboard) {
      const prevRank = prev.ranks[entry.userId]
      if (prevRank == null) continue
      if (prevRank > 10 && entry.rank <= 10) {
        lines.push(`${displayName(entry)} ingresó al Top 10`)
        hasMovement = true
      }
    }

    const movers = leaderboard
      .map(e => ({
        name: displayName(e),
        delta: (prev.ranks[e.userId] ?? e.rank) - e.rank,
      }))
      .filter(m => m.delta >= 2)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 2)

    for (const m of movers) {
      lines.push(`${m.name} subió ${m.delta} posiciones`)
      hasMovement = true
    }
  }

  if (!hasMovement) {
    lines.push('Esperando movimientos')
    const leader = leaderboard[0]
    if (leader && leader.points > 0) {
      lines.push(`${displayName(leader)} lidera con ${leader.points} pts`)
    }
  }

  writeLbSnapshot(leaderboard, bucket)
  return lines.slice(0, 2)
}

function statsMap(rows: LiveMatchStatRow[]): Map<string, LiveMatchStatRow> {
  return new Map(rows.map(r => [r.matchId, r]))
}

function favoriteTrendLabel(
  match: Match,
  homePct: number,
  drawPct: number,
  awayPct: number,
  hasEnoughData: boolean,
): string {
  if (!hasEnoughData) return 'Sin suficientes predicciones'
  const home = match.homeTeam?.name ?? 'Local'
  const away = match.awayTeam?.name ?? 'Visitante'
  const max = Math.max(homePct, drawPct, awayPct)
  if (max === homePct) return `${homePct}% eligió ${shortTeamName(home)}`
  if (max === awayPct) return `${awayPct}% eligió ${shortTeamName(away)}`
  return `${drawPct}% eligió empate`
}

function buildScorersList(
  topScorers: TopScorer[],
  players: Player[],
): { scorers: { name: string; goals: number }[]; emptyMessage?: string } {
  if (topScorers.length > 0) {
    return {
      scorers: topScorers.slice(0, 5).map(s => ({
        name: shortTeamName(s.player.name),
        goals: s.goals,
      })),
    }
  }
  const fromPlayers = [...players]
    .filter(p => (p.goals ?? 0) > 0)
    .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))
    .slice(0, 5)
    .map(p => ({ name: shortTeamName(p.name), goals: p.goals ?? 0 }))
  if (fromPlayers.length > 0) {
    return { scorers: fromPlayers }
  }
  return {
    scorers: [],
    emptyMessage: 'El torneo todavía no comenzó',
  }
}

export function getNextRewardInsight(
  overall: OverallProgress,
  groupProgress: GroupProgress[],
  rank: number | null,
  points: number,
  leaderboard: LeaderboardEntry[],
): string {
  const recommended = getRecommendedGroup(groupProgress)
  if (recommended && recommended.pending > 0) {
    return `Te faltan ${recommended.pending} predicciones para completar Grupo ${recommended.groupId}`
  }
  const top10 = leaderboard.find(e => e.rank === 10)
  if (rank != null && rank > 10 && top10 && top10.points > points) {
    return `Te faltan ${top10.points - points + 1} pts para entrar al Top 10`
  }
  const milestone = getNextRewardMilestone(overall.percent)
  if (overall.percent < 100) {
    return `Llegá al ${milestone}% de predicciones completadas`
  }
  return '¡Mundial completo! Seguí sumando en cada partido'
}

export type BuildWorldCupLiveInsightsInput = {
  matches: Match[]
  leaderboard: LeaderboardEntry[]
  topScorers: TopScorer[]
  players: Player[]
  overall: OverallProgress
  groupProgress: GroupProgress[]
  matchStats: LiveMatchStatRow[]
  userId?: string
  points: number
  rank: number | null
  now?: number
}

function pickTrendMatch(
  nextMatch: Match | null,
  matches: Match[],
  stats: Map<string, LiveMatchStatRow>,
): Match | null {
  if (nextMatch?.homeTeam && nextMatch.awayTeam) return nextMatch
  let best: { match: Match; count: number } | null = null
  for (const row of stats.values()) {
    const match = matches.find(m => m.id === row.matchId)
    if (!match?.homeTeam || !match.awayTeam) continue
    if (!best || row.predictionCount > best.count) {
      best = { match, count: row.predictionCount }
    }
  }
  return best?.match ?? null
}

function findPopularMatch(
  matches: Match[],
  stats: Map<string, LiveMatchStatRow>,
  fallbackMatch: Match | null,
): PopularMatchInsight {
  let best: { match: Match; count: number } | null = null
  for (const row of stats.values()) {
    const match = matches.find(m => m.id === row.matchId)
    if (!match?.homeTeam || !match.awayTeam) continue
    if (!best || row.predictionCount > best.count) {
      best = { match, count: row.predictionCount }
    }
  }

  if (best && best.count > 0) {
    return {
      id: 'popular-match',
      type: 'popular_match',
      emoji: '🔥',
      title: 'Partido más popular',
      match: best.match,
      predictionCount: best.count,
      subtitle: `${best.count} predicciones`,
    }
  }

  const match =
    fallbackMatch ??
    matches.find(m => m.homeTeam && m.awayTeam) ??
    matches[0]

  return {
    id: 'popular-match-empty',
    type: 'popular_match',
    emoji: '🔥',
    title: 'Partido más popular',
    match,
    predictionCount: 0,
    emptyMessage: 'Aún no hay actividad',
    subtitle: 'Aún no hay actividad',
  }
}

function resolveNextMatch(matches: Match[], now: number): NextMatchInsight | null {
  const upcoming = matches
    .filter(m => m.status === 'scheduled' && m.homeTeam && m.awayTeam)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
  const next = upcoming[0]
  if (next?.homeTeam && next.awayTeam) {
    return {
      id: 'next-match',
      type: 'next_match',
      emoji: '⚽',
      title: 'Próximo partido',
      match: next,
      countdownLabel: formatCountdownLabel(next.kickoff, now),
      cta: { label: 'Predecir ahora', action: 'predict' },
    }
  }

  const anyWithTeams = matches.find(m => m.homeTeam && m.awayTeam)
  if (!anyWithTeams) return null

  return {
    id: 'next-match-fallback',
    type: 'next_match',
    emoji: '⚽',
    title: 'Próximo partido',
    match: anyWithTeams,
    countdownLabel: 'Fixture en actualización',
    subtitle: 'Próximamente nuevos partidos',
    cta: { label: 'Ver fixture', action: 'matches' },
  }
}

/** Siempre devuelve exactamente 7 tarjetas cuando hay al menos un partido en el fixture. */
export function buildWorldCupLiveInsights(input: BuildWorldCupLiveInsightsInput): WorldCupLiveInsightPayload[] {
  const now = input.now ?? Date.now()
  const stats = statsMap(input.matchStats)

  const nextCard = resolveNextMatch(input.matches, now)
  const trendMatch = pickTrendMatch(nextCard?.match ?? null, input.matches, stats)
  const scorersPayload = buildScorersList(input.topScorers, input.players)

  if (!nextCard || !trendMatch) {
    return []
  }

  const trendRow = stats.get(trendMatch.id)
  const trendCount = trendRow?.predictionCount ?? 0
  const hasEnoughTrend = trendCount >= MIN_TREND_PREDICTIONS
  const homePct = hasEnoughTrend ? (trendRow?.homePct ?? 0) : 0
  const drawPct = hasEnoughTrend ? (trendRow?.drawPct ?? 0) : 0
  const awayPct = hasEnoughTrend ? (trendRow?.awayPct ?? 0) : 0

  const cards: WorldCupLiveInsightPayload[] = [
    nextCard,
    {
      id: 'community-trend',
      type: 'community_trend',
      emoji: '📈',
      title: 'Tendencia de la comunidad',
      subtitle: favoriteTrendLabel(trendMatch, homePct, drawPct, awayPct, hasEnoughTrend),
      match: trendMatch,
      homePct,
      drawPct,
      awayPct,
      favoriteLabel: favoriteTrendLabel(trendMatch, homePct, drawPct, awayPct, hasEnoughTrend),
      hasEnoughData: hasEnoughTrend,
    },
    {
      id: 'ranking-move',
      type: 'ranking_move',
      emoji: '🏆',
      title: 'Movimiento del ranking',
      lines: buildRankingMoves(input.leaderboard),
      cta: { label: 'Ver ranking', action: 'leaderboard' },
    },
    findPopularMatch(input.matches, stats, nextCard.match),
    {
      id: 'top-scorers',
      type: 'top_scorers',
      emoji: '👑',
      title: 'Goleadores',
      subtitle: scorersPayload.emptyMessage ?? 'Top 5 actualizado',
      scorers: scorersPayload.scorers,
      emptyMessage: scorersPayload.emptyMessage,
    },
  ]

  if (input.userId) {
    cards.push(
      {
        id: 'your-progress',
        type: 'your_progress',
        emoji: '🎯',
        title: 'Tu progreso',
        predicted: input.overall.predicted,
        total: input.overall.total,
        percent: input.overall.percent,
        points: input.points,
        rank: input.rank,
        cta: { label: 'Seguir prediciendo', action: 'matches' },
      },
      {
        id: 'next-reward',
        type: 'next_reward',
        emoji: '🎁',
        title: 'Próxima recompensa',
        message: getNextRewardInsight(
          input.overall,
          input.groupProgress,
          input.rank,
          input.points,
          input.leaderboard,
        ),
        cta: { label: 'Jugar ahora', action: 'matches' },
      },
    )
  } else {
    cards.push(
      {
        id: 'your-progress-guest',
        type: 'your_progress',
        emoji: '🎯',
        title: 'Tu progreso',
        subtitle: 'Registrate y empezá a predecir',
        predicted: 0,
        total: input.overall.total || 104,
        percent: 0,
        points: 0,
        rank: null,
        cta: { label: 'Crear cuenta', action: 'login' },
      },
      {
        id: 'next-reward-guest',
        type: 'next_reward',
        emoji: '🎁',
        title: 'Próxima recompensa',
        message: 'Sumá puntos completando grupos y predicciones',
        cta: { label: 'Jugar ahora', action: 'login' },
      },
    )
  }

  return cards
}

export function getLiveInsightsCacheBucket(): number {
  return cacheBucket()
}
