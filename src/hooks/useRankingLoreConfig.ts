import { useQuery } from '@tanstack/react-query'
import { DEFAULT_RANKING_LORE, resolveRankingLore } from '../config/rankingLore.ts'
import { fetchActiveAdminCards } from '../services/admin/adminService.ts'

export const rankingLoreKeys = {
  all: ['ranking-lore'] as const,
  config: () => [...rankingLoreKeys.all, 'config'] as const,
}

export function useRankingLoreConfig() {
  return useQuery({
    queryKey: rankingLoreKeys.config(),
    queryFn: async () => {
      const cards = await fetchActiveAdminCards()
      return resolveRankingLore(cards)
    },
    staleTime: 60_000,
    placeholderData: DEFAULT_RANKING_LORE,
  })
}
