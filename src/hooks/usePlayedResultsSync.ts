import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ENABLE_LIVE_INSIGHTS } from '../config/betaMode.ts'
import { supabase } from '../lib/supabase.ts'
import { worldCupKeys } from '../useWorldCupData.ts'
import { worldCupLiveKeys } from './useWorldCupLiveInsights.ts'

export const PLAYED_RESULTS_SYNC_MS = 24 * 60 * 60 * 1000
const LAST_SYNC_KEY = 'wc26_played_results_sync_v1'

export function getPlayedResultsLastSync(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY)
    if (!raw) return null
    const ts = Number(raw)
    return Number.isFinite(ts) ? ts : null
  } catch {
    return null
  }
}

function markPlayedResultsSynced() {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

async function invalidateMatchQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: worldCupKeys.matches() })
  await queryClient.invalidateQueries({ queryKey: worldCupKeys.liveMatches() })
  await queryClient.invalidateQueries({ queryKey: worldCupKeys.groups() })
  await queryClient.invalidateQueries({ queryKey: worldCupLiveKeys.matchStats() })
}

/** Sincroniza resultados de partidos jugados desde la API cada 24 h. */
export function usePlayedResultsSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ENABLE_LIVE_INSIGHTS) return

    let cancelled = false

    async function run(force = false) {
      const last = getPlayedResultsLastSync()
      if (!force && last != null && Date.now() - last < PLAYED_RESULTS_SYNC_MS) {
        return
      }

      try {
        const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
          'sync-today-results',
        )

        if (cancelled) return

        if (error || data?.error) {
          console.warn(
            '[played-results-sync]',
            error?.message ?? data?.error ?? 'sync falló',
          )
        } else {
          markPlayedResultsSynced()
        }

        await invalidateMatchQueries(queryClient)
      } catch (err) {
        if (!cancelled) {
          console.warn(
            '[played-results-sync]',
            err instanceof Error ? err.message : 'Error desconocido',
          )
          await invalidateMatchQueries(queryClient)
        }
      }
    }

    void run(false)
    const id = window.setInterval(() => void run(false), PLAYED_RESULTS_SYNC_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [queryClient])
}
