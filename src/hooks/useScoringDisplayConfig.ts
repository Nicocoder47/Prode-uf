import { useQuery } from '@tanstack/react-query'
import { DEFAULT_SCORING_DISPLAY, resolveScoringDisplay } from '../config/scoringDisplay.ts'
import { fetchActiveAdminCards } from '../services/admin/adminService.ts'

export const scoringDisplayKeys = {
  all: ['scoring-display'] as const,
  config: () => [...scoringDisplayKeys.all, 'config'] as const,
}

const FALLBACK_CONFIG = resolveScoringDisplay([])

export function useScoringDisplayConfig() {
  return useQuery({
    queryKey: scoringDisplayKeys.config(),
    queryFn: async () => {
      const cards = await fetchActiveAdminCards()
      return resolveScoringDisplay(cards)
    },
    staleTime: 60_000,
    placeholderData: FALLBACK_CONFIG,
  })
}

export function getDefaultScoringDisplay() {
  return {
    exactPts: DEFAULT_SCORING_DISPLAY.exactPts,
    resultPts: DEFAULT_SCORING_DISPLAY.resultPts,
    tickerTipMessage: resolveScoringDisplay([]).tickerTipMessage,
  }
}
