import type { LeaderboardEntry } from '../types/worldcup'

const RANKING_SNAPSHOT_KEY = 'wc26_ranking_snapshot_v1'

type RankingSnapshot = {
  updatedAt: number
  ranks: Record<string, number>
}

export function readRankingSnapshot(): RankingSnapshot | null {
  try {
    const raw = localStorage.getItem(RANKING_SNAPSHOT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RankingSnapshot
  } catch {
    return null
  }
}

/** Positivo = subió puestos, negativo = bajó, 0 = igual, null = sin historial previo. */
export function computeRankDelta(prevRank: number | undefined, currentRank: number): number | null {
  if (prevRank == null) return null
  return prevRank - currentRank
}

export function computeLeaderboardMovements(
  entries: LeaderboardEntry[],
): Map<string, number | null> {
  const prev = readRankingSnapshot()
  const movements = new Map<string, number | null>()

  for (const entry of entries) {
    const prevRank = prev?.ranks[entry.userId]
    movements.set(entry.userId, computeRankDelta(prevRank, entry.rank))
  }

  return movements
}

export function persistLeaderboardSnapshot(entries: LeaderboardEntry[]): void {
  const ranks: Record<string, number> = {}
  for (const entry of entries) ranks[entry.userId] = entry.rank
  try {
    localStorage.setItem(
      RANKING_SNAPSHOT_KEY,
      JSON.stringify({ updatedAt: Date.now(), ranks } satisfies RankingSnapshot),
    )
  } catch {
    /* ignore quota */
  }
}

export function formatRankMovement(delta: number | null | undefined): string {
  if (delta == null) return '—'
  if (delta === 0) return '0'
  return delta > 0 ? `+${delta}` : `${delta}`
}
