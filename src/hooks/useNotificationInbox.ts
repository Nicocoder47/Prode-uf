import { useCallback, useEffect, useState } from 'react'
import { fetchMyNotifications, markNotificationRead } from '../services/admin/adminService'
import { notifyGlobalAlertRefresh } from '../utils/globalAlertEvents'
import { dismissGlobalAlert } from '../utils/globalAlertSession'
import type { AppNotification } from '../types/admin'
import { useGlobalAlertIndicator } from './useGlobalAlertIndicator'

export function useNotificationInbox() {
  const { alert: globalAlert, hasActiveAlert, isPending: globalAlertPending, reload: reloadGlobal } =
    useGlobalAlertIndicator()
  const [items, setItems] = useState<AppNotification[]>([])

  const reloadNotifications = useCallback(() => {
    return fetchMyNotifications()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const reload = useCallback(async () => {
    await Promise.all([reloadNotifications(), reloadGlobal()])
  }, [reloadGlobal, reloadNotifications])

  useEffect(() => {
    void reload()
    const id = window.setInterval(() => {
      void reload()
    }, 60000)
    return () => window.clearInterval(id)
  }, [reload])

  const unreadNotifications = items.filter(n => !n.is_read).length
  const unreadCount = unreadNotifications + (globalAlertPending ? 1 : 0)

  async function markRead(id: string) {
    await markNotificationRead(id)
    await reloadNotifications()
  }

  function dismissGlobal() {
    if (!globalAlert) return
    dismissGlobalAlert(globalAlert)
    notifyGlobalAlertRefresh()
  }

  return {
    globalAlert,
    hasActiveAlert,
    globalAlertPending,
    items,
    unreadCount,
    unreadNotifications,
    reload,
    markRead,
    dismissGlobal,
  }
}
