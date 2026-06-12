import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePollingInterval } from './useDocumentVisible.ts'
import { useRankingLoreConfig } from './useRankingLoreConfig.ts'
import { worldCupService } from '../services/worldcup/worldCupService'
import { getPlayedResultsLastSync } from './usePlayedResultsSync.ts'
import {
  buildWorldCupLiveInsights,
  getLiveInsightsCacheBucket,
  LIVE_INSIGHTS_CACHE_MS,
  type WorldCupLiveInsightPayload,
} from '../utils/worldCupLiveInsights'
import type { GroupProgress, OverallProgress } from '../utils/predictionProgress'
import type { LeaderboardEntry, Match, TopScorer } from '../types/worldcup'

export const worldCupLiveKeys = {
  all: ['worldcup-live'] as const,
  matchStats: () => [...worldCupLiveKeys.all, 'match-stats'] as const,
  snapshot: (bucket: number, userId?: string) =>
    [...worldCupLiveKeys.all, bucket, userId ?? 'guest'] as const,
}

type UseWorldCupLiveInsightsInput = {
  matches: Match[]
  leaderboard: LeaderboardEntry[]
  topScorers: TopScorer[]
  overall: OverallProgress
  groupProgress: GroupProgress[]
  userId?: string
  points: number
  rank: number | null
  enabled?: boolean
}

export function useWorldCupLiveInsights(input: UseWorldCupLiveInsightsInput) {
  const bucket = getLiveInsightsCacheBucket()
  const enabled = input.enabled ?? true
  const { data: rankingLore } = useRankingLoreConfig()
  const matchStatsPollMs = usePollingInterval(60_000)

  const { data: matchStats = [] } = useQuery({
    queryKey: worldCupLiveKeys.matchStats(),
    queryFn: () => worldCupService.getLiveMatchStats(),
    enabled: enabled && input.matches.length > 0,
    staleTime: 60_000,
    refetchInterval: matchStatsPollMs,
  })

  const cards = useMemo<WorldCupLiveInsightPayload[]>(() => {
    if (!enabled || input.matches.length === 0) return []
    return buildWorldCupLiveInsights({
      matches: input.matches,
      leaderboard: input.leaderboard,
      topScorers: input.topScorers,
      overall: input.overall,
      groupProgress: input.groupProgress,
      matchStats,
      userId: input.userId,
      points: input.points,
      rank: input.rank,
      rankingLore: rankingLore ?? null,
      playedResultsLastSync: getPlayedResultsLastSync(),
    })
  }, [
    enabled,
    input.matches,
    input.leaderboard,
    input.topScorers,
    input.overall,
    input.groupProgress,
    input.userId,
    input.points,
    input.rank,
    matchStats,
    rankingLore,
  ])

  return {
    cards,
    bucket,
    isLoading: false,
    refetch: async () => undefined,
  }
}

export { LIVE_INSIGHTS_CACHE_MS }
