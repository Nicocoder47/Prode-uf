import { useEffect, useMemo } from 'react'
import type { LeaderboardEntry } from '../types/worldcup'
import {
  computeDayRankMovements,
  touchLeaderboardDaySnapshot,
} from '../utils/leaderboardMovement'

/**
 * Movimiento de ranking vs inicio del día (Argentina).
 * Actualiza el snapshot unificado al recibir datos nuevos.
 */
export function useLeaderboardMovements(leaderboard: LeaderboardEntry[]) {
  useEffect(() => {
    if (leaderboard.length > 0) touchLeaderboardDaySnapshot(leaderboard)
  }, [leaderboard])

  return useMemo(() => computeDayRankMovements(leaderboard), [leaderboard])
}
