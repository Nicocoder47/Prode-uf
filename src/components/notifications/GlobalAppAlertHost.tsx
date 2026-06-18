import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { fetchActiveGlobalAlert } from '../../services/globalAlertService'
import { dismissGlobalAlert, isGlobalAlertDismissed } from '../../utils/globalAlertSession'
import type { GlobalAppAlert } from '../../types/globalAlert'
import { GlobalAppAlertModal } from './GlobalAppAlertModal'

export function GlobalAppAlertHost() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [alert, setAlert] = useState<GlobalAppAlert | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (loading || !user) {
      setVisible(false)
      return
    }

    if (location.pathname === '/change-password') {
      setVisible(false)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const active = await fetchActiveGlobalAlert()
        if (cancelled || !active) {
          if (!cancelled) setVisible(false)
          return
        }
        setAlert(active)
        setVisible(!isGlobalAlertDismissed(active))
      } catch {
        if (!cancelled) setVisible(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loading, user, location.pathname, location.key])

  if (!visible || !alert) return null

  return (
    <GlobalAppAlertModal
      alert={alert}
      onDismiss={() => {
        dismissGlobalAlert(alert)
        setVisible(false)
      }}
    />
  )
}
