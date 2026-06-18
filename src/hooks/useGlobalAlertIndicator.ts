import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { fetchActiveGlobalAlert } from '../services/globalAlertService'
import { GLOBAL_ALERT_REFRESH_EVENT } from '../utils/globalAlertEvents'
import { isGlobalAlertDismissed } from '../utils/globalAlertSession'
import type { GlobalAppAlert } from '../types/globalAlert'

export function useGlobalAlertIndicator() {
  const { user } = useAuth()
  const [alert, setAlert] = useState<GlobalAppAlert | null>(null)
  const enabled = Boolean(user)

  const reload = useCallback(async () => {
    if (!enabled) {
      setAlert(null)
      return
    }
    try {
      setAlert(await fetchActiveGlobalAlert())
    } catch {
      setAlert(null)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
    const onRefresh = () => {
      void reload()
    }
    window.addEventListener(GLOBAL_ALERT_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(GLOBAL_ALERT_REFRESH_EVENT, onRefresh)
  }, [reload])

  const hasActiveAlert = Boolean(alert)
  const isPending = Boolean(alert && !isGlobalAlertDismissed(alert))

  return { alert, hasActiveAlert, isPending, reload }
}
