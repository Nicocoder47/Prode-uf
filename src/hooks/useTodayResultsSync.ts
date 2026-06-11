import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ENABLE_LIVE_INSIGHTS } from '../config/betaMode.ts'
import { supabase } from '../lib/supabase.ts'
import { worldCupLiveKeys } from './useWorldCupLiveInsights.ts'
import { worldCupKeys } from '../useWorldCupData.ts'

const SYNC_INTERVAL_MS = 5 * 60 * 1000
const SYNC_ERROR_KEY = 'prode:sync-today-results:last-error'

type SyncTodayResultsPayload = {
  ok?: boolean
  upserted?: number
  provider?: string
  error?: string
}

async function invalidateMatchQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: worldCupKeys.matches() })
  await queryClient.invalidateQueries({ queryKey: worldCupKeys.liveMatches() })
  await queryClient.invalidateQueries({ queryKey: worldCupKeys.groups() })
  await queryClient.invalidateQueries({ queryKey: worldCupKeys.topScorers() })
  await queryClient.invalidateQueries({ queryKey: worldCupKeys.players() })
  await queryClient.invalidateQueries({ queryKey: worldCupLiveKeys.matchStats() })
}

function reportSyncError(message: string) {
  try {
    sessionStorage.setItem(SYNC_ERROR_KEY, JSON.stringify({ at: new Date().toISOString(), message }))
  } catch {
    // sessionStorage puede no estar disponible
  }
  console.warn('[sync-today-results]', message)
}

/** Dispara sync de resultados del día desde la API → Supabase y refresca partidos en UI. */
export function useTodayResultsSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ENABLE_LIVE_INSIGHTS) return

    let cancelled = false

    async function run() {
      try {
        const { data, error } = await supabase.functions.invoke<SyncTodayResultsPayload>(
          'sync-today-results',
        )

        if (cancelled) return

        if (error) {
          reportSyncError(
            `Edge function no disponible o falló: ${error.message}. El workflow sync-live en GitHub Actions cubre el mismo caso si está activo.`,
          )
          // Aunque falle la edge function, refrescar por si GH Actions ya actualizó Supabase.
          await invalidateMatchQueries(queryClient)
          return
        }

        if (data?.error) {
          reportSyncError(`sync-today-results respondió error: ${data.error}`)
          await invalidateMatchQueries(queryClient)
          return
        }

        if (import.meta.env.DEV) {
          console.info('[sync-today-results] ok', data)
        }

        await invalidateMatchQueries(queryClient)
      } catch (err) {
        if (!cancelled) {
          reportSyncError(
            err instanceof Error ? err.message : 'Error desconocido invocando sync-today-results',
          )
          await invalidateMatchQueries(queryClient)
        }
      }
    }

    void run()
    const id = window.setInterval(() => void run(), SYNC_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [queryClient])
}

export { SYNC_ERROR_KEY }
