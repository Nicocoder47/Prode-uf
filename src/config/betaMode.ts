/**
 * Beta cerrada — máximo operativo 300 usuarios (costo $0).
 * Compatible con Vite (import.meta.env) y scripts Node (process.env).
 */
const viteEnv =
  typeof import.meta !== 'undefined'
    ? ((import.meta as { env?: Record<string, string | undefined> }).env ?? {})
    : {}

function readEnv(key: string): string | undefined {
  const nodeEnv =
    typeof process !== 'undefined' && process.env
      ? (process.env as Record<string, string | undefined>)[key]
      : undefined
  return viteEnv[key] ?? nodeEnv
}

const betaMode = readEnv('VITE_BETA_MODE') === 'true'

function envFlag(key: string, betaDefault: boolean): boolean {
  const raw = readEnv(key)
  if (raw === 'true') return true
  if (raw === 'false') return false
  return betaDefault
}

export const MAX_BETA_USERS = 300
export const WARN_USERS = 220
export const CRITICAL_USERS = 280
export const HARD_STOP_USERS = 300
export const WARN_CONCURRENT_USERS = 80
export const CRITICAL_CONCURRENT_USERS = 120

/** Realtime desactivado por defecto en beta (usar polling). */
export const ENABLE_REALTIME = envFlag('VITE_ENABLE_REALTIME', !betaMode)

/** Animaciones framer-motion pesadas en home. */
export const ENABLE_HEAVY_ANIMATIONS = envFlag('VITE_ENABLE_HEAVY_ANIMATIONS', !betaMode)

/** Carrusel insights + RPC get_live_match_stats en home. */
export const ENABLE_LIVE_INSIGHTS = envFlag('VITE_ENABLE_LIVE_INSIGHTS', true)

export const BETA_MODE = betaMode || !ENABLE_REALTIME

export const POLLING_INTERVALS = {
  leaderboard: 30_000,
  predictions: 30_000,
  live: 45_000,
  matches: 60_000,
  capacity: 60_000,
  matchEvents: 30_000,
  playerLiveStatus: 45_000,
} as const

/** Alias usado por hooks de datos. */
export const BETA_POLL_INTERVAL_MS = {
  leaderboard: POLLING_INTERVALS.leaderboard,
  predictions: POLLING_INTERVALS.predictions,
  matches: POLLING_INTERVALS.matches,
  liveMatches: POLLING_INTERVALS.live,
  matchEvents: POLLING_INTERVALS.matchEvents,
  playerLiveStatus: POLLING_INTERVALS.playerLiveStatus,
} as const
