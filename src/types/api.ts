export type ApiResponse<T> = {
  data: T
  error: Error | null
  lastSyncedAt?: string | null
}

// World Cup 2026 Prediction Types
export type PredictionResult = 'home' | 'draw' | 'away'
export type PredictionStatus = 'pending' | 'locked' | 'resolved'

// Single Source of Truth para predicciones
export type { Prediction as WorldCupPrediction } from './worldcup';

export interface ScoringRules {
  correctResult: number // 3 pts
  correctScore: number // 5 pts
  correctScorer: number // 2 pts
  correctMvp: number // 2 pts
  bonusEliminationGroupStage: number
  bonusEliminationRound16: number
  bonusEliminationQuarterfinals: number
  bonusEliminationSemifinals: number
  bonusEliminationFinal: number
}

export const DEFAULT_SCORING_RULES: ScoringRules = {
  correctResult: 3,
  correctScore: 5,
  correctScorer: 2,
  correctMvp: 2,
  bonusEliminationGroupStage: 0,
  bonusEliminationRound16: 5,
  bonusEliminationQuarterfinals: 10,
  bonusEliminationSemifinals: 15,
  bonusEliminationFinal: 20,
}
