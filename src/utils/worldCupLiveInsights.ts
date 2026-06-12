import { buildRankingLoreFromLeaderboard, type RankingLoreConfig } from '../config/rankingLore.ts'
import type { GroupProgress, OverallProgress } from './predictionProgress'
import { getNextRewardMilestone, getRecommendedGroup } from './predictionProgress'
import type { LeaderboardEntry, Match, TopScorer } from '../types/worldcup'
import type { LiveMatchStatRow } from '../services/worldcup/worldCupService'
import { buildRankingMoveLines } from './leaderboardMovement'
import { teamDisplayName } from './teamDisplay'

export const LIVE_INSIGHTS_CACHE_MS = 30 * 60 * 1000
/** Mínimo de predicciones para mostrar tendencia como dato de comunidad. */
export const MIN_TREND_PREDICTIONS = 3

export const PLAYED_MATCHES_CARD_LIMIT = 8

export type WorldCupLiveCardType =
  | 'played_matches'
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

export type PlayedMatchesInsight = WorldCupLiveCard & {
  type: 'played_matches'
  matches: Match[]
  emptyMessage?: string
}

export type NextMatchInsight = WorldCupLiveCard & {
  type: 'next_match'
  match: Match
  countdownLabel: string
  todayMatches: Match[]
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

export type RankingPodiumEntry = {
  rank: number
  name: string
  legajo: string
  points: number
}

export type RankingLoreDisplay = {
  emoji: string
  headline: string
  subjectName: string
  body: string
  subjectPoints: number
}

export type RankingMoveInsight = WorldCupLiveCard & {
  type: 'ranking_move'
  lines: string[]
  leader: RankingPodiumEntry | null
  runnerUp: RankingPodiumEntry | null
  lore?: RankingLoreDisplay | null
}

export type PopularMatchInsight = WorldCupLiveCard & {
  type: 'popular_match'
  match: Match
  predictionCount: number
  emptyMessage?: string
}

export type LiveScorerRow = {
  id: string
  name: string
  goals: number
  flag: string | null
  countryCode: string | null
}

export type TopScorersInsight = WorldCupLiveCard & {
  type: 'top_scorers'
  scorers: LiveScorerRow[]
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
  | PlayedMatchesInsight
  | NextMatchInsight
  | CommunityTrendInsight
  | RankingMoveInsight
  | PopularMatchInsight
  | TopScorersInsight
  | YourProgressInsight
  | NextRewardInsight

function cacheBucket(now = Date.now()): number {
  return Math.floor(now / LIVE_INSIGHTS_CACHE_MS)
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

function fullDisplayName(entry: LeaderboardEntry): string {
  const name = entry.profile?.fullName?.trim()
  if (name) return name
  return entry.profile?.legajo ?? `Jugador #${entry.rank}`
}

function legajoLabel(entry: LeaderboardEntry): string {
  return entry.profile?.legajo?.trim() || '—'
}

function buildRankingPodium(leaderboard: LeaderboardEntry[]): {
  leader: RankingPodiumEntry | null
  runnerUp: RankingPodiumEntry | null
} {
  const leader = leaderboard[0]
  const second = leaderboard[1]

  return {
    leader: leader
      ? {
          rank: 1,
          name: fullDisplayName(leader),
          legajo: legajoLabel(leader),
          points: leader.points,
        }
      : null,
    runnerUp: second
      ? {
          rank: 2,
          name: fullDisplayName(second),
          legajo: legajoLabel(second),
          points: second.points,
        }
      : null,
  }
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

export function getTodayMatches(matches: Match[], now = Date.now()): Match[] {
  const todayKey = new Date(now).toDateString()
  return matches
    .filter(m => hasResolvedTeams(m) && new Date(m.kickoff).toDateString() === todayKey)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
}

export function getPlayedMatches(
  matches: Match[],
  limit = PLAYED_MATCHES_CARD_LIMIT,
): Match[] {
  return matches
    .filter(
      m =>
        hasResolvedTeams(m) &&
        m.status === 'finished' &&
        m.homeScore != null &&
        m.awayScore != null,
    )
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())
    .slice(0, limit)
}

function formatPlayedResultsSubtitle(count: number, lastSyncAt: number | null): string {
  if (!lastSyncAt) {
    return count === 1 ? '1 resultado oficial' : `${count} resultados oficiales`
  }
  const hours = Math.max(0, Math.floor((Date.now() - lastSyncAt) / 3_600_000))
  const syncLabel =
    hours < 1
      ? 'API actualizada hace minutos'
      : hours < 24
        ? `API actualizada hace ${hours}h`
        : 'Sync diario con la API'
  return count === 1 ? `1 resultado · ${syncLabel}` : `${count} resultados · ${syncLabel}`
}

function resolvePlayedMatches(
  matches: Match[],
  lastSyncAt: number | null,
): PlayedMatchesInsight | null {
  const played = getPlayedMatches(matches)
  if (played.length === 0) return null

  return {
    id: 'played-matches',
    type: 'played_matches',
    emoji: '🏁',
    title: 'Partidos jugados',
    subtitle: formatPlayedResultsSubtitle(played.length, lastSyncAt),
    matches: played,
    cta: { label: 'Ver todos', action: 'matches' },
  }
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
  const home = teamDisplayName(match.homeTeam)
  const away = teamDisplayName(match.awayTeam)
  const max = Math.max(homePct, drawPct, awayPct)
  if (max === homePct) return `${homePct}% eligió ${home}`
  if (max === awayPct) return `${awayPct}% eligió ${away}`
  return `${drawPct}% eligió empate`
}

function mapLiveScorerRow(scorer: TopScorer): LiveScorerRow {
  const team = scorer.player.team
  return {
    id: scorer.player.id,
    name: scorer.player.name.trim(),
    goals: scorer.goals,
    flag: team?.flag ?? null,
    countryCode: team?.countryCode ?? team?.code ?? null,
  }
}

function buildScorersList(
  topScorers: TopScorer[],
): { scorers: LiveScorerRow[]; emptyMessage?: string } {
  if (topScorers.length > 0) {
    return {
      scorers: topScorers.slice(0, 5).map(mapLiveScorerRow),
    }
  }
  return {
    scorers: [],
    emptyMessage: 'Aún no hay goles registrados',
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
  overall: OverallProgress
  groupProgress: GroupProgress[]
  matchStats: LiveMatchStatRow[]
  userId?: string
  points: number
  rank: number | null
  rankingLore?: RankingLoreConfig | null
  playedResultsLastSync?: number | null
  now?: number
}

export function toRankingLoreDisplay(config: RankingLoreConfig): RankingLoreDisplay {
  return {
    emoji: config.emoji,
    headline: config.headline,
    subjectName: config.subjectName,
    body: config.body,
    subjectPoints: config.subjectPoints,
  }
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
  const todayMatches = getTodayMatches(matches, now)
  if (todayMatches.length === 0) return null

  const predictMatch =
    todayMatches.find(
      m => m.status === 'scheduled' || m.status === 'live' || m.status === 'halftime',
    ) ?? todayMatches[0]

  return {
    id: 'next-match',
    type: 'next_match',
    emoji: '⚽',
    title: 'Próximos partidos',
    match: predictMatch,
    countdownLabel: '',
    todayMatches,
    cta: { label: 'Predecir ahora', action: 'predict' },
  }
}

/** Siempre devuelve exactamente 7 tarjetas cuando hay al menos un partido en el fixture. */
export function buildWorldCupLiveInsights(input: BuildWorldCupLiveInsightsInput): WorldCupLiveInsightPayload[] {
  const now = input.now ?? Date.now()
  const stats = statsMap(input.matchStats)

  const playedCard = resolvePlayedMatches(input.matches, input.playedResultsLastSync ?? null)
  const nextCard = resolveNextMatch(input.matches, now)
  const trendMatch = pickTrendMatch(
    nextCard?.match ?? playedCard?.matches[0] ?? null,
    input.matches,
    stats,
  )
  const scorersPayload = buildScorersList(input.topScorers)

  if (!trendMatch) {
    return []
  }

  const trendRow = stats.get(trendMatch.id)
  const trendCount = trendRow?.predictionCount ?? 0
  const hasEnoughTrend = trendCount >= MIN_TREND_PREDICTIONS
  const homePct = hasEnoughTrend ? (trendRow?.homePct ?? 0) : 0
  const drawPct = hasEnoughTrend ? (trendRow?.drawPct ?? 0) : 0
  const awayPct = hasEnoughTrend ? (trendRow?.awayPct ?? 0) : 0

  const cards: WorldCupLiveInsightPayload[] = [
    ...(playedCard ? [playedCard] : []),
    ...(nextCard ? [nextCard] : []),
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
    (() => {
      const podium = buildRankingPodium(input.leaderboard)
      const loreTemplate = input.rankingLore
      const resolvedLore =
        loreTemplate?.enabled && loreTemplate
          ? buildRankingLoreFromLeaderboard(input.leaderboard, loreTemplate)
          : null
      const loreActive = Boolean(resolvedLore?.headline.trim())
      return {
        id: 'ranking-move',
        type: 'ranking_move' as const,
        emoji: loreActive ? resolvedLore!.emoji : '🏆',
        title: 'Movimiento del ranking',
        lines: loreActive ? [] : buildRankingMoveLines(input.leaderboard, new Date(now)),
        leader: loreActive ? null : podium.leader,
        runnerUp: loreActive ? null : podium.runnerUp,
        lore: loreActive && resolvedLore ? toRankingLoreDisplay(resolvedLore) : null,
        cta: { label: 'Ver ranking', action: 'leaderboard' as const },
      }
    })(),
    findPopularMatch(input.matches, stats, nextCard?.match ?? trendMatch),
    {
      id: 'top-scorers',
      type: 'top_scorers',
      emoji: '👑',
      title: 'Goleadores',
      subtitle:
        scorersPayload.emptyMessage ??
        (scorersPayload.scorers.length > 0
          ? `${scorersPayload.scorers.reduce((sum, s) => sum + s.goals, 0)} goles · Top ${scorersPayload.scorers.length}`
          : 'Top 5 actualizado'),
      scorers: scorersPayload.scorers,
      emptyMessage: scorersPayload.emptyMessage,
    },
  ]

  return cards
}

export function getLiveInsightsCacheBucket(): number {
  return cacheBucket()
}
