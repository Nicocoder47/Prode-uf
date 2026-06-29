import { useMemo } from 'react'
import { buildPlayMatchesUrl, resolveDefaultPlayPhase } from '../constants/phases'
import { useWorldCupMatches } from '../useWorldCupData'

/** URL de Jugar según fase actual del torneo (16avos si grupos terminaron). */
export function usePlayMatchesHref(): string {
  const { data: matches = [] } = useWorldCupMatches()
  return useMemo(
    () => buildPlayMatchesUrl(resolveDefaultPlayPhase(matches)),
    [matches],
  )
}
