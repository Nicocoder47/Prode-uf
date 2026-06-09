import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { worldCupService } from '../services/worldcup/worldCupService'
import {
  buildWorldCupLiveInsights,
  getLiveInsightsCacheBucket,
  LIVE_INSIGHTS_CACHE_MS,
  type WorldCupLiveInsightPayload,
} from '../utils/worldCupLiveInsights'
import type { GroupProgress, OverallProgress } from '../utils/predictionProgress'
import type { LeaderboardEntry, Match, Player, TopScorer } from '../types/worldcup'
export const worldCupLiveKeys = {
  all: ['worldcup-live'] as const,
  snapshot: (bucket: number, userId?: string) =>
    [...worldCupLiveKeys.all, bucket, userId ?? 'guest'] as const,
}

type UseWorldCupLiveInsightsInput = {
  matches: Match[]
  leaderboard: LeaderboardEntry[]
  topScorers: TopScorer[]
  players: Player[]
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

  const query = useQuery<WorldCupLiveInsightPayload[]>({
    queryKey: worldCupLiveKeys.snapshot(bucket, input.userId),
    enabled: enabled && input.matches.length > 0,
    queryFn: async () => {
      const matchStats = await worldCupService.getLiveMatchStats()
      return buildWorldCupLiveInsights({
        matches: input.matches,
        leaderboard: input.leaderboard,
        topScorers: input.topScorers,
        players: input.players,
        overall: input.overall,
        groupProgress: input.groupProgress,
        matchStats,
        userId: input.userId,
        points: input.points,
        rank: input.rank,
      })
    },
    staleTime: LIVE_INSIGHTS_CACHE_MS,
    gcTime: LIVE_INSIGHTS_CACHE_MS * 2,
  })

  const cards = useMemo(() => query.data ?? [], [query.data])

  return {
    cards,
    bucket,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}

export { LIVE_INSIGHTS_CACHE_MS }
