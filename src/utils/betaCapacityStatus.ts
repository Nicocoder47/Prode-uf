/**
 * Compat scripts legacy — delega en beta300Capacity.
 */
export {
  evaluateBeta300 as evaluateBetaCapacity,
  estimateConcurrentUsers as estimateConcurrentPeak,
  BETA300_STATUS_LABELS as SEMAPHORE_LABELS,
  type Beta300Status as CapacitySemaphore,
  type Beta300Evaluation as BetaCapacityEvaluation,
  type Beta300Input as BetaCapacityInput,
} from './beta300Capacity'
