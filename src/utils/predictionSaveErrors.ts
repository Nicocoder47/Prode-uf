import type { PenaltyWinnerPick } from '../constants/knockoutScoring'

export interface SavePredictionInput {
  matchId: string
  homeScore: number
  awayScore: number
  etHomeScore?: number | null
  etAwayScore?: number | null
  penaltyWinner?: PenaltyWinnerPick | null
}

export function needsExtendedSave(input: SavePredictionInput): boolean {
  return (
    input.etHomeScore != null ||
    input.etAwayScore != null ||
    input.penaltyWinner != null
  )
}

function isMissingSaveRpc(error: { message?: string; code?: string | null }): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('function public.save_prediction') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  )
}

export function isMissingExtendedSaveRpc(error: { message?: string; code?: string | null }): boolean {
  return isMissingSaveRpc(error)
}

export function isMissingLegacySaveRpc(error: { message?: string; code?: string | null }): boolean {
  return isMissingSaveRpc(error)
}

/** Traduce errores de Supabase/RPC a mensajes claros en español. */
export function mapPredictionSaveError(message: string): string {
  const lower = message.toLowerCase()

  if (isMissingSaveRpc({ message })) {
    if (
      lower.includes('p_et_score') ||
      lower.includes('p_penalty_winner') ||
      lower.includes('integer, integer, integer')
    ) {
      return 'El servidor aún no tiene activo el guardado con alargue y penales. Aplicá la última migración en Supabase o guardá un resultado sin empate en 90 minutos.'
    }
    return 'El servidor de predicciones no está actualizado. Contactá al administrador o intentá más tarde.'
  }
  if (lower.includes('predicted_et_score') || lower.includes('predicted_penalty_winner')) {
    return 'Falta aplicar la migración de alargue y penales en Supabase. Avisale al administrador.'
  }
  if (lower.includes('not_authenticated')) {
    return 'Debes iniciar sesión con tu email para predecir.'
  }
  if (lower.includes('account_inactive')) {
    return 'Tu cuenta está deshabilitada. No podés predecir.'
  }
  if (lower.includes('password_change_required')) {
    return 'Debés cambiar tu contraseña antes de predecir.'
  }
  if (lower.includes('predictions_closed') || lower.includes('kickoff') || lower.includes('kick_off')) {
    return 'Las predicciones están cerradas para este partido.'
  }
  if (lower.includes('prediction_locked')) {
    return 'Esta predicción ya está cerrada y no se puede modificar.'
  }
  if (lower.includes('match_not_found') || lower.includes('match_id_required')) {
    return 'No encontramos este partido. Recargá la página e intentá de nuevo.'
  }
  if (lower.includes('knockout_et_required')) {
    return 'Completá el marcador del alargue (solo tiempo suplementario).'
  }
  if (lower.includes('knockout_penalty_winner_required') || lower.includes('knockout_penalty_winner_invalid')) {
    return 'Elegí quién clasifica por penales.'
  }
  if (lower.includes('invalid_scores') || lower.includes('knockout_et_invalid')) {
    return 'Marcador inválido. Usá enteros entre 0 y 99.'
  }
  if (lower.includes('network') || lower.includes('fetch failed')) {
    return 'No hay conexión. Revisá tu internet e intentá de nuevo.'
  }
  if (lower.includes('save_prediction_empty_response')) {
    return 'No se pudo guardar la predicción. Intentá de nuevo en unos segundos.'
  }

  return 'No se pudo guardar la predicción. Intentá de nuevo en unos segundos.'
}
