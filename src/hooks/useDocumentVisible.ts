import { useEffect, useState } from 'react'

/** true cuando la pestaña/documento está visible (document.visibilityState === 'visible'). */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  )

  useEffect(() => {
    const handler = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  return visible
}

/**
 * Devuelve el intervalo de polling solo con la pestaña visible.
 * Con Realtime desactivado, TanStack Query refetch al volver al foco (refetchOnWindowFocus).
 */
export function usePollingInterval(intervalMs: number | false): number | false {
  const visible = useDocumentVisible()
  if (!intervalMs) return false
  return visible ? intervalMs : false
}
