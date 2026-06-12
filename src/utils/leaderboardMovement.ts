import type { LeaderboardEntry } from '../types/worldcup'
import { todayInArgentina } from './matchDay'

/** Snapshot unificado — reemplaza v1 (visita) y v2 (carrusel por bucket). */
export const RANKING_SNAPSHOT_KEY = 'wc26_ranking_snapshot_v3'

const LEGACY_SNAPSHOT_V1 = 'wc26_ranking_snapshot_v1'
const LEGACY_SNAPSHOT_V2 = 'wc26_live_lb_snapshot_v2'

export type LeaderboardDaySnapshot = {
  /** Día calendario Argentina (YYYY-MM-DD) del baseline activo. */
  dayKey: string
  /** Posiciones al inicio del día (no se actualizan durante el día). */
  baselineRanks: Record<string, number>
  /** Últimas posiciones conocidas (para arrastrar al día siguiente). */
  lastRanks: Record<string, number>
  updatedAt: number
}

export type RankMovementRow = {
  userId: string
  name: string
  delta: number
  currentRank: number
  points: number
}

function ranksFromEntries(entries: LeaderboardEntry[]): Record<string, number> {
  const ranks: Record<string, number> = {}
  for (const entry of entries) ranks[entry.userId] = entry.rank
  return ranks
}

function parseLegacyRanks(raw: string): Record<string, number> | null {
  try {
    const parsed = JSON.parse(raw) as { ranks?: Record<string, number> }
    if (parsed.ranks && Object.keys(parsed.ranks).length > 0) return parsed.ranks
  } catch {
    /* ignore */
  }
  return null
}

function readLegacyLastRanks(): Record<string, number> | null {
  try {
    for (const key of [LEGACY_SNAPSHOT_V1, LEGACY_SNAPSHOT_V2]) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const ranks = parseLegacyRanks(raw)
      if (ranks) return ranks
    }
  } catch {
    /* ignore */
  }
  return null
}

export function readLeaderboardDaySnapshot(): LeaderboardDaySnapshot | null {
  try {
    const raw = localStorage.getItem(RANKING_SNAPSHOT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LeaderboardDaySnapshot
  } catch {
    return null
  }
}

function writeLeaderboardDaySnapshot(snapshot: LeaderboardDaySnapshot): void {
  try {
    localStorage.setItem(RANKING_SNAPSHOT_KEY, JSON.stringify(snapshot))
    localStorage.removeItem(LEGACY_SNAPSHOT_V1)
    localStorage.removeItem(LEGACY_SNAPSHOT_V2)
  } catch {
    /* ignore quota */
  }
}

/**
 * Asegura el snapshot del día: al cambiar de día, el baseline = cierre del día anterior.
 * Durante el mismo día solo actualiza lastRanks.
 */
export function touchLeaderboardDaySnapshot(
  entries: LeaderboardEntry[],
  now = new Date(),
): LeaderboardDaySnapshot {
  const dayKey = todayInArgentina(now)
  const currentRanks = ranksFromEntries(entries)
  const stored = readLeaderboardDaySnapshot()

  if (!stored || stored.dayKey !== dayKey) {
    const carriedBaseline =
      stored?.lastRanks && Object.keys(stored.lastRanks).length > 0
        ? stored.lastRanks
        : readLegacyLastRanks() ?? currentRanks

    const next: LeaderboardDaySnapshot = {
      dayKey,
      baselineRanks: carriedBaseline,
      lastRanks: currentRanks,
      updatedAt: Date.now(),
    }
    writeLeaderboardDaySnapshot(next)
    return next
  }

  const next: LeaderboardDaySnapshot = {
    ...stored,
    lastRanks: currentRanks,
    updatedAt: Date.now(),
  }
  writeLeaderboardDaySnapshot(next)
  return next
}

export function getDayBaselineRanks(entries: LeaderboardEntry[], now = new Date()): Record<string, number> {
  const snapshot = touchLeaderboardDaySnapshot(entries, now)
  return snapshot.baselineRanks
}

/** Positivo = subió puestos, negativo = bajó, 0 = igual, null = sin historial previo. */
export function computeRankDelta(prevRank: number | undefined, currentRank: number): number | null {
  if (prevRank == null) return null
  return prevRank - currentRank
}

export function computeDayRankMovements(
  entries: LeaderboardEntry[],
  now = new Date(),
): Map<string, number | null> {
  const baseline = getDayBaselineRanks(entries, now)
  const movements = new Map<string, number | null>()

  for (const entry of entries) {
    const prevRank = baseline[entry.userId]
    movements.set(entry.userId, computeRankDelta(prevRank, entry.rank))
  }

  return movements
}

export function displayLeaderboardName(entry: LeaderboardEntry): string {
  const full = entry.profile?.fullName?.trim()
  if (full) return full
  return entry.profile?.legajo?.trim() || `Jugador #${entry.rank}`
}

export function displayLeaderboardShortName(entry: LeaderboardEntry): string {
  const full = entry.profile?.fullName?.trim()
  if (full) return full.split(/\s+/)[0] ?? full
  return entry.profile?.legajo?.trim() || `Jugador #${entry.rank}`
}

function movementRows(
  entries: LeaderboardEntry[],
  movements: Map<string, number | null>,
): RankMovementRow[] {
  return entries
    .map(entry => {
      const delta = movements.get(entry.userId)
      if (delta == null || delta === 0) return null
      return {
        userId: entry.userId,
        name: displayLeaderboardName(entry),
        delta,
        currentRank: entry.rank,
        points: entry.points,
      }
    })
    .filter((row): row is RankMovementRow => row != null)
}

export function getTopRisers(
  entries: LeaderboardEntry[],
  movements: Map<string, number | null>,
  limit = 2,
): RankMovementRow[] {
  return movementRows(entries, movements)
    .filter(row => row.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.currentRank - b.currentRank)
    .slice(0, limit)
}

export function getTopFallers(
  entries: LeaderboardEntry[],
  movements: Map<string, number | null>,
  limit = 1,
): RankMovementRow[] {
  return movementRows(entries, movements)
    .filter(row => row.delta < 0)
    .sort((a, b) => a.delta - b.delta || b.currentRank - a.currentRank)
    .slice(0, limit)
}

export function getBiggestRiser(
  entries: LeaderboardEntry[],
  movements: Map<string, number | null>,
): RankMovementRow | null {
  return getTopRisers(entries, movements, 1)[0] ?? null
}

export function getGapToLeader(
  entries: LeaderboardEntry[],
  userId?: string,
): { points: number; leaderName: string } | null {
  if (!userId || entries.length === 0) return null
  const leader = entries[0]
  const me = entries.find(e => e.userId === userId)
  if (!leader || !me || leader.userId === userId) return null
  return {
    points: Math.max(0, leader.points - me.points),
    leaderName: displayLeaderboardShortName(leader),
  }
}

/** Líneas narrativas para el carrusel en vivo. */
export function buildRankingMoveLines(entries: LeaderboardEntry[], now = new Date()): string[] {
  if (entries.length === 0) return []

  const baseline = getDayBaselineRanks(entries, now)
  const movements = computeDayRankMovements(entries, now)
  const lines: string[] = []

  for (const entry of entries) {
    const prevRank = baseline[entry.userId]
    if (prevRank == null) continue
    if (prevRank > 10 && entry.rank <= 10) {
      lines.push(`${displayLeaderboardShortName(entry)} ingresó al Top 10`)
    }
  }

  for (const mover of getTopRisers(entries, movements, 2)) {
    if (mover.delta >= 2) {
      lines.push(`${displayLeaderboardShortName(entries.find(e => e.userId === mover.userId)!)} subió ${mover.delta} posiciones`)
    }
  }

  return lines.slice(0, 2)
}

export function formatRankMovement(delta: number | null | undefined): string {
  if (delta == null) return '—'
  if (delta === 0) return '0'
  return delta > 0 ? `+${delta}` : `${delta}`
}

/** @deprecated Usar touchLeaderboardDaySnapshot */
export function readRankingSnapshot(): { updatedAt: number; ranks: Record<string, number> } | null {
  const snap = readLeaderboardDaySnapshot()
  if (!snap) return null
  return { updatedAt: snap.updatedAt, ranks: snap.baselineRanks }
}

/** @deprecated Usar touchLeaderboardDaySnapshot */
export function persistLeaderboardSnapshot(entries: LeaderboardEntry[]): void {
  touchLeaderboardDaySnapshot(entries)
}

/** @deprecated Usar computeDayRankMovements */
export function computeLeaderboardMovements(entries: LeaderboardEntry[]): Map<string, number | null> {
  return computeDayRankMovements(entries)
}
