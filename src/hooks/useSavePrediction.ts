import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { worldCupKeys } from '../useWorldCupData'
import {
  isMissingExtendedSaveRpc,
  isMissingLegacySaveRpc,
  mapPredictionSaveError,
  needsExtendedSave,
  type SavePredictionInput,
} from '../utils/predictionSaveErrors'

export type { SavePredictionInput }

interface SavePredictionRpcResult {
  ok: boolean
  prediction?: Record<string, unknown>
}

type RpcError = { message: string; code?: string | null }

async function callExtendedSavePredictionRpc(
  input: SavePredictionInput,
): Promise<{ data: SavePredictionRpcResult | null; error: RpcError | null }> {
  const res = await supabase.rpc('save_prediction', {
    p_match_id: input.matchId,
    p_score_home: input.homeScore,
    p_score_away: input.awayScore,
    p_et_score_home: input.etHomeScore ?? null,
    p_et_score_away: input.etAwayScore ?? null,
    p_penalty_winner: input.penaltyWinner ?? null,
  })
  return {
    data: res.data as SavePredictionRpcResult | null,
    error: res.error ? { message: res.error.message, code: res.error.code } : null,
  }
}

async function callLegacySavePredictionRpc(
  input: SavePredictionInput,
): Promise<{ data: SavePredictionRpcResult | null; error: RpcError | null }> {
  const res = await supabase.rpc('save_prediction', {
    p_match_id: input.matchId,
    p_score_home: input.homeScore,
    p_score_away: input.awayScore,
  })
  return {
    data: res.data as SavePredictionRpcResult | null,
    error: res.error ? { message: res.error.message, code: res.error.code } : null,
  }
}

export function useSavePrediction(userId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SavePredictionInput) => {
      if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
        throw new Error('Debes iniciar sesión con tu email para predecir.')
      }

      let { data, error } = await callExtendedSavePredictionRpc(input)

      if (error && isMissingExtendedSaveRpc(error)) {
        if (needsExtendedSave(input)) {
          throw new Error(mapPredictionSaveError(error.message))
        }
        const legacy = await callLegacySavePredictionRpc(input)
        data = legacy.data
        error = legacy.error
      }

      if (error && isMissingLegacySaveRpc(error) && needsExtendedSave(input)) {
        throw new Error(mapPredictionSaveError(error.message))
      }

      if (error) throw new Error(mapPredictionSaveError(error.message))

      const result = data
      if (!result?.ok || !result.prediction) {
        throw new Error(mapPredictionSaveError('save_prediction_empty_response'))
      }

      return result.prediction
    },
    onSuccess: (_data, input) => {
      if (!userId) return
      queryClient.invalidateQueries({ queryKey: worldCupKeys.predictions(userId) })
      queryClient.invalidateQueries({ queryKey: worldCupKeys.match(input.matchId) })
    },
  })
}
