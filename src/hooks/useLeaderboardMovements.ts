import { useEffect, useMemo, useRef, useState } from 'react'
import type { LeaderboardEntry } from '../types/worldcup'
import {
  computeRankDelta,
  persistLeaderboardSnapshot,
  readRankingSnapshot,
} from '../utils/leaderboardMovement'

/**
 * Compara el ranking actual contra una línea base fija al entrar a la pantalla.
 * Al salir, guarda el snapshot para la próxima visita o actualización en vivo.
 */
export function useLeaderboardMovements(leaderboard: LeaderboardEntry[]) {
  const baselineRef = useRef<Record<string, number> | null>(null)
  const initializedRef = useRef(false)
  const [baselineReady, setBaselineReady] = useState(false)

  useEffect(() => {
    if (leaderboard.length === 0 || initializedRef.current) return

    const stored = readRankingSnapshot()
    if (stored?.ranks && Object.keys(stored.ranks).length > 0) {
      baselineRef.current = stored.ranks
    } else {
      const initial: Record<string, number> = {}
      for (const entry of leaderboard) initial[entry.userId] = entry.rank
      baselineRef.current = initial
      persistLeaderboardSnapshot(leaderboard)
    }

    initializedRef.current = true
    setBaselineReady(true)
  }, [leaderboard])

  useEffect(() => {
    return () => {
      if (leaderboard.length > 0) persistLeaderboardSnapshot(leaderboard)
    }
  }, [leaderboard])

  return useMemo(() => {
    const baseline = baselineRef.current
    const movements = new Map<string, number | null>()
    if (!baselineReady || !baseline) return movements

    for (const entry of leaderboard) {
      const prevRank = baseline[entry.userId]
      movements.set(entry.userId, computeRankDelta(prevRank, entry.rank))
    }

    return movements
  }, [leaderboard, baselineReady])
}
