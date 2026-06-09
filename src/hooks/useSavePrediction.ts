import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { worldCupKeys } from '../useWorldCupData'

export interface SavePredictionInput {
  matchId: string
  homeScore: number
  awayScore: number
}

interface SavePredictionRpcResult {
  ok: boolean
  prediction?: Record<string, unknown>
}

function mapRpcError(message: string): string {
  if (message.includes('not_authenticated')) {
    return 'Debes iniciar sesión con tu email para predecir.'
  }
  if (message.includes('account_inactive')) {
    return 'Tu cuenta está deshabilitada. No podés predecir.'
  }
  if (message.includes('predictions_closed') || message.includes('kickoff')) {
    return 'Las predicciones están cerradas para este partido.'
  }
  if (message.includes('prediction_locked')) {
    return 'Esta predicción ya está cerrada y no se puede modificar.'
  }
  if (message.includes('invalid_scores')) {
    return 'Marcador inválido. Ingresá goles entre 0 y 99.'
  }
  return message
}

export function useSavePrediction(userId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SavePredictionInput) => {
      if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
        throw new Error('Debes iniciar sesión con tu email para predecir.')
      }

      const { data, error } = await supabase.rpc('save_prediction', {
        p_match_id: input.matchId,
        p_score_home: input.homeScore,
        p_score_away: input.awayScore,
      })

      if (error) throw new Error(mapRpcError(error.message))

      const result = data as SavePredictionRpcResult | null
      if (!result?.ok || !result.prediction) {
        throw new Error('No se pudo guardar la predicción.')
      }

      return result.prediction
    },
    onSuccess: (_data, input) => {
      if (!userId) return
      queryClient.invalidateQueries({ queryKey: worldCupKeys.predictions(userId) })
      queryClient.invalidateQueries({ queryKey: worldCupKeys.match(input.matchId) })
      queryClient.invalidateQueries({ queryKey: worldCupKeys.matches() })
    },
  })
}
