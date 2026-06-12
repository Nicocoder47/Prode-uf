import { useEffect, useMemo, useState } from 'react'
import { buildMatchCountdown } from '../utils/predictionProgress'
import type { Match } from '../types/worldcup'

/** Countdown de un partido aislado — tick cada 1 s sin afectar al padre. */
export function useMatchCountdown(match: Match | null | undefined) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!match) return
    const id = window.setInterval(() => setTick(t => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [match?.id, match?.kickoff])

  return useMemo(() => buildMatchCountdown(match ?? null), [match, tick])
}
