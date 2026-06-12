import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getDefaultScoringDisplay } from '../../hooks/useScoringDisplayConfig.ts'
import { fetchActiveAdminCards, fetchMyNotifications, markNotificationRead } from '../../services/admin/adminService.ts'
import { resolveScoringDisplay } from '../../config/scoringDisplay.ts'
import { resolveTickerContent } from '../../config/tickerContent.ts'
import type { AppNotification } from '../../types/admin.ts'

type TickerItem = {
  id: string
  title: string
  message: string
  isRead: boolean
}

function buildFallbackItems(): TickerItem[] {
  const scoring = getDefaultScoringDisplay()
  const content = resolveTickerContent([], scoring)
  return [
    {
      id: 'welcome',
      title: content.welcomeTitle,
      message: content.welcomeMessage,
      isRead: true,
    },
    {
      id: 'tip',
      title: content.tipTitle,
      message: content.tipMessage,
      isRead: true,
    },
  ]
}

export function NotificationTicker() {
  const [items, setItems] = useState<TickerItem[]>(buildFallbackItems)

  const reload = useCallback(async () => {
    try {
      const [notifications, cards] = await Promise.all([
        fetchMyNotifications().catch(() => [] as AppNotification[]),
        fetchActiveAdminCards().catch(() => []),
      ])

      const scoring = resolveScoringDisplay(cards)
      const content = resolveTickerContent(cards, scoring)

      const fromNotifs: TickerItem[] = notifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
      }))

      const fromCard: TickerItem[] = content.importantActive
        ? [
            {
              id: 'card-important',
              title: content.importantTitle,
              message: content.importantMessage ?? '',
              isRead: true,
            },
          ]
        : []

      const scoringTip: TickerItem = {
        id: 'tip',
        title: content.tipTitle,
        message: content.tipMessage,
        isRead: true,
      }

      const welcome: TickerItem = {
        id: 'welcome',
        title: content.welcomeTitle,
        message: content.welcomeMessage,
        isRead: true,
      }

      const merged = [welcome, scoringTip, ...fromNotifs, ...fromCard]
      setItems(merged.length > 0 ? merged : buildFallbackItems())
    } catch {
      setItems(buildFallbackItems())
    }
  }, [])

  useEffect(() => {
    reload()
    const id = window.setInterval(reload, 60000)
    return () => window.clearInterval(id)
  }, [reload])

  const loopItems = useMemo(() => {
    if (items.length === 0) return buildFallbackItems()
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
          <Bell className="h-4 w-4" />
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
                className={`wc26-notification-ticker__item ${item.isRead ? '' : 'is-unread'} ${item.id === 'tip' ? 'is-scoring-tip' : ''}`}
                onClick={() => handleClick(item)}
              >
                <strong>{item.title}</strong>
                <span className="wc26-notification-ticker__message"> · {item.message}</span>
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
