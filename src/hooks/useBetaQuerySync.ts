import { useCallback } from 'react'
import { ENABLE_REALTIME, BETA_POLL_INTERVAL_MS } from '../config/betaMode'
import { useSupabaseRealtime } from './useSupabaseRealtime'

type TableName = 'matches' | 'leaderboard' | 'predictions' | 'events' | 'player_live_status'

/**
 * Realtime si VITE_ENABLE_REALTIME=true; si no, devuelve intervalo de polling (ms).
 */
export function useBetaQuerySync(
  enabled: boolean,
  table: TableName,
  onInvalidate: () => void,
  deps: unknown[],
  options?: { filter?: string; pollMs?: number },
): number | false {
  const pollMs = options?.pollMs ?? BETA_POLL_INTERVAL_MS.leaderboard

  useSupabaseRealtime(
    ENABLE_REALTIME && enabled,
    {
      event: '*',
      schema: 'public',
      table,
      filter: options?.filter,
    },
    onInvalidate,
    deps,
  )

  return ENABLE_REALTIME ? false : pollMs
}

export function useInvalidateMatchById(
  matchId: string | undefined,
  invalidateMatch: (id: string) => void,
) {
  return useCallback(() => {
    if (matchId) invalidateMatch(matchId)
  }, [matchId, invalidateMatch])
}
