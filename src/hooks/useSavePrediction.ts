import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import type { PredictionResult } from '../types/worldcup'
import { validatePredictionCoherence } from '../utils/predictionValidation'
import { worldCupKeys } from '../useWorldCupData'

export interface SavePredictionInput {
  matchId: string
  result: PredictionResult
  homeScore: number
  awayScore: number
  firstScorerId?: string | null
  mvpId?: string | null
}

export function useSavePrediction(userId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SavePredictionInput) => {
      if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
        throw new Error('Debes iniciar sesión con tu email para predecir.')
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('is_active, deleted_at')
        .eq('id', userId)
        .single()

      if (profileErr) {
        if (profileErr.message.includes('deleted_at')) {
          const { data: activeOnly, error: activeErr } = await supabase
            .from('profiles')
            .select('is_active')
            .eq('id', userId)
            .single()
          if (activeErr) throw activeErr
          if (activeOnly.is_active === false) {
            throw new Error('Tu cuenta está deshabilitada. No podés predecir.')
          }
        } else {
          throw profileErr
        }
      } else if (profile.deleted_at || profile.is_active === false) {
        throw new Error('Tu cuenta está deshabilitada. No podés predecir.')
      }

      const coherenceError = validatePredictionCoherence(input.result, input.homeScore, input.awayScore)
      if (coherenceError) throw new Error(coherenceError)

      const { data: match, error: matchErr } = await supabase
        .from('matches')
        .select('status,is_locked,kick_off')
        .eq('id', input.matchId)
        .single()

      if (matchErr) throw matchErr
      if (match.is_locked || match.status !== 'scheduled') {
        throw new Error('Las predicciones están cerradas para este partido.')
      }
      if (match.kick_off && new Date(match.kick_off) <= new Date()) {
        throw new Error('El plazo para predecir este partido ya cerró (inicio del partido).')
      }

      const { data, error } = await supabase
        .from('predictions')
        .upsert(
          {
            user_id: userId,
            match_id: input.matchId,
            predicted_winner: input.result,
            predicted_score_home: input.homeScore,
            predicted_score_away: input.awayScore,
            predicted_first_scorer: input.firstScorerId || null,
            predicted_mvp: input.mvpId || null,
            status: 'pending',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,match_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, input) => {
      if (!userId) return
      queryClient.invalidateQueries({ queryKey: worldCupKeys.predictions(userId) })
      queryClient.invalidateQueries({ queryKey: worldCupKeys.match(input.matchId) })
      queryClient.invalidateQueries({ queryKey: worldCupKeys.matches() })
    },
  })
}
