import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { fetchActiveAdminCards, fetchMyNotifications, markNotificationRead } from '../../services/admin/adminService.ts'
import type { AppNotification } from '../../types/admin.ts'

type TickerItem = {
  id: string
  title: string
  message: string
  isRead: boolean
}

const FALLBACK_ITEMS: TickerItem[] = [
  {
    id: 'welcome',
    title: 'PRODEMUNDIAL 2026',
    message: 'Viví el Mundial · Hacé tus predicciones antes de cada partido',
    isRead: true,
  },
  {
    id: 'tip',
    title: 'Tip',
    message: 'Sumá puntos acertando resultados, goleador y MVP',
    isRead: true,
  },
]

export function NotificationTicker() {
  const [items, setItems] = useState<TickerItem[]>(FALLBACK_ITEMS)

  const reload = useCallback(async () => {
    try {
      const [notifications, cards] = await Promise.all([
        fetchMyNotifications().catch(() => [] as AppNotification[]),
        fetchActiveAdminCards().catch(() => []),
      ])

      const fromNotifs: TickerItem[] = notifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
      }))

      const important = cards.find(c => c.key === 'important_message' && c.value && c.value !== '—')
      const fromCard: TickerItem[] = important
        ? [{ id: 'card-important', title: important.title, message: important.value ?? important.subtitle ?? '', isRead: true }]
        : []

      const merged = [...fromNotifs, ...fromCard]
      setItems(merged.length > 0 ? merged : FALLBACK_ITEMS)
    } catch {
      setItems(FALLBACK_ITEMS)
    }
  }, [])

  useEffect(() => {
    reload()
    const id = window.setInterval(reload, 60000)
    return () => window.clearInterval(id)
  }, [reload])

  const loopItems = useMemo(() => {
    if (items.length === 0) return FALLBACK_ITEMS
    if (items.length === 1) return [...items, ...items, ...items]
    return [...items, ...items]
  }, [items])

  const unread = items.filter(i => !i.isRead).length

  async function handleClick(item: TickerItem) {
    if (!item.isRead && item.id !== 'welcome' && item.id !== 'tip' && item.id !== 'card-important') {
      await markNotificationRead(item.id).catch(() => undefined)
      reload()
    }
  }

  return (
    <div className="wc26-notification-ticker mx-3 mt-2">
      <div className="wc26-notification-ticker__inner">
        <span className="wc26-notification-ticker__badge" aria-hidden>
          <Bell className="h-3.5 w-3.5" />
          {unread > 0 && <span className="wc26-notification-ticker__dot">{unread > 9 ? '9+' : unread}</span>}
        </span>
        <div className="wc26-notification-ticker__viewport">
          <div
            className="wc26-notification-ticker__track"
            style={{ animationDuration: `${Math.max(18, loopItems.length * 6)}s` }}
          >
            {loopItems.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                type="button"
                className={`wc26-notification-ticker__item ${item.isRead ? '' : 'is-unread'}`}
                onClick={() => handleClick(item)}
              >
                <strong>{item.title}</strong>
                <span className="opacity-80"> · {item.message}</span>
              </button>
            ))}
          </div>
        </div>
        <Link to="/notifications" className="wc26-notification-ticker__more" aria-label="Ver todas las notificaciones">
          +
        </Link>
      </div>
    </div>
  )
}
