import { useEffect, useState } from 'react'

const HOME_PHASE_TICK_MS = 10_000

/**
 * Reloj lento para resolver fase del próximo partido en Home (~10 s).
 * El countdown visual va en WorldCupHero con tick de 1 s aislado.
 */
export function useHomePhaseClock() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), HOME_PHASE_TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  return now
}
