import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getDefaultScoringDisplay } from '../../hooks/useScoringDisplayConfig.ts'
import { useGlobalAlertIndicator } from '../../hooks/useGlobalAlertIndicator.ts'
import { fetchActiveAdminCards, fetchMyNotifications, markNotificationRead } from '../../services/admin/adminService.ts'
import { resolveScoringDisplay } from '../../config/scoringDisplay.ts'
import { resolveTickerContent } from '../../config/tickerContent.ts'
import { requestOpenGlobalAlert } from '../../utils/globalAlertEvents.ts'
import type { AppNotification } from '../../types/admin.ts'

type TickerItem = {
  id: string
  title: string
  message: string
  isRead: boolean
  isGlobalAlert?: boolean
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
  const { alert: globalAlert, hasActiveAlert, isPending: globalAlertPending } = useGlobalAlertIndicator()

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

  const displayItems = useMemo(() => {
    if (!hasActiveAlert || !globalAlert) return items

    const globalItem: TickerItem = {
      id: 'global-alert',
      title: globalAlert.title || globalAlert.kicker,
      message: globalAlert.message || 'Tocá la campana para leer el aviso completo',
      isRead: !globalAlertPending,
      isGlobalAlert: true,
    }

    return [globalItem, ...items.filter(item => item.id !== 'global-alert')]
  }, [globalAlert, globalAlertPending, hasActiveAlert, items])

  const loopItems = useMemo(() => {
    if (displayItems.length === 0) return buildFallbackItems()
    if (displayItems.length === 1) return [...displayItems, ...displayItems, ...displayItems]
    return [...displayItems, ...displayItems]
  }, [displayItems])

  const unread = displayItems.filter(i => !i.isRead).length
  const badgeCount = unread > 0 ? (unread > 9 ? '9+' : String(unread)) : globalAlertPending ? '!' : null

  async function handleClick(item: TickerItem) {
    if (item.isGlobalAlert) {
      requestOpenGlobalAlert()
      return
    }
    if (!item.isRead && item.id !== 'welcome' && item.id !== 'tip' && item.id !== 'card-important') {
      await markNotificationRead(item.id).catch(() => undefined)
      reload()
    }
  }

  function handleBellClick() {
    if (hasActiveAlert) {
      requestOpenGlobalAlert()
      return
    }
    if (unread > 0) {
      const nextUnread = displayItems.find(item => !item.isRead && !item.isGlobalAlert)
      if (nextUnread) void handleClick(nextUnread)
    }
  }

  return (
    <div className="wc26-notification-ticker mx-3 mt-2">
      <div
        className={`wc26-notification-ticker__inner${globalAlertPending ? ' has-unread-alert' : hasActiveAlert || unread > 0 ? ' has-unread' : ''}`}
      >
        <button
          type="button"
          className={`wc26-notification-ticker__badge${globalAlertPending ? ' is-attention' : hasActiveAlert ? ' is-live' : ''}`}
          aria-label={
            hasActiveAlert
              ? globalAlertPending
                ? 'Aviso importante sin leer. Tocá para abrir.'
                : 'Aviso importante. Tocá para volver a leer.'
              : 'Notificaciones'
          }
          onClick={handleBellClick}
        >
          <Bell className="h-4 w-4" />
          {badgeCount ? (
            <span className={`wc26-notification-ticker__dot${globalAlertPending ? ' is-pulse' : ''}`}>{badgeCount}</span>
          ) : null}
        </button>
        <div className="wc26-notification-ticker__viewport">
          <div
            className="wc26-notification-ticker__track"
            style={{ animationDuration: `${Math.max(18, loopItems.length * 6)}s` }}
          >
            {loopItems.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                type="button"
                className={`wc26-notification-ticker__item ${item.isRead ? '' : 'is-unread'} ${item.id === 'tip' ? 'is-scoring-tip' : ''} ${item.isGlobalAlert ? 'is-global-alert' : ''}`}
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
