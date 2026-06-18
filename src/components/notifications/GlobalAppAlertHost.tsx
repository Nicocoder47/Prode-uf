import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fetchActiveGlobalAlert } from '../../services/globalAlertService'
import { GLOBAL_ALERT_OPEN_EVENT, GLOBAL_ALERT_REFRESH_EVENT, notifyGlobalAlertRefresh } from '../../utils/globalAlertEvents'
import { dismissGlobalAlert, isGlobalAlertDismissed } from '../../utils/globalAlertSession'
import type { GlobalAppAlert } from '../../types/globalAlert'
import { GlobalAppAlertModal } from './GlobalAppAlertModal'

const SKIP_PATHS = new Set(['/login', '/change-password'])
const LOGIN_RETRY_MS = [0, 350, 1000]

function applyActiveAlert(active: GlobalAppAlert | null) {
  if (!active) {
    return { alert: null, visible: false }
  }
  return {
    alert: active,
    visible: !isGlobalAlertDismissed(active),
  }
}

export function GlobalAppAlertHost() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [alert, setAlert] = useState<GlobalAppAlert | null>(null)
  const [visible, setVisible] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const loginBurstRef = useRef(false)
  const pendingOpenRef = useRef(false)

  const bumpRefresh = useCallback(() => {
    setRefreshToken(token => token + 1)
  }, [])

  useEffect(() => {
    const onRefresh = () => bumpRefresh()
    const onOpen = () => {
      pendingOpenRef.current = true
      if (alert) {
        setVisible(true)
        pendingOpenRef.current = false
        return
      }
      bumpRefresh()
    }
    window.addEventListener(GLOBAL_ALERT_REFRESH_EVENT, onRefresh)
    window.addEventListener(GLOBAL_ALERT_OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener(GLOBAL_ALERT_REFRESH_EVENT, onRefresh)
      window.removeEventListener(GLOBAL_ALERT_OPEN_EVENT, onOpen)
    }
  }, [alert, bumpRefresh])

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN') {
        loginBurstRef.current = true
        bumpRefresh()
      }
    })
    return () => authListener.subscription.unsubscribe()
  }, [bumpRefresh])

  useEffect(() => {
    if (loading || !user) {
      setVisible(false)
      setAlert(null)
      return
    }

    if (SKIP_PATHS.has(location.pathname)) {
      setVisible(false)
      return
    }

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    const loadAlert = async () => {
      try {
        const active = await fetchActiveGlobalAlert()
        if (cancelled) return

        const next = applyActiveAlert(active)
        setAlert(next.alert)
        if (pendingOpenRef.current && active) {
          pendingOpenRef.current = false
          setVisible(true)
        } else {
          setVisible(next.visible)
        }
        return active
      } catch {
        if (!cancelled) {
          setAlert(null)
          setVisible(false)
        }
        return null
      }
    }

    void (async () => {
      const delays = loginBurstRef.current ? LOGIN_RETRY_MS : [0]
      loginBurstRef.current = false

      for (const delay of delays) {
        if (cancelled) return
        if (delay > 0) {
          await new Promise<void>(resolve => {
            timers.push(setTimeout(resolve, delay))
          })
          if (cancelled) return
        }
        const active = await loadAlert()
        if (active) break
      }
    })()

    return () => {
      cancelled = true
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [loading, user, location.pathname, refreshToken])

  if (!visible || !alert) return null

  return createPortal(
    <GlobalAppAlertModal
      alert={alert}
      onDismiss={() => {
        dismissGlobalAlert(alert)
        setVisible(false)
        notifyGlobalAlertRefresh()
      }}
    />,
    document.body,
  )
}
