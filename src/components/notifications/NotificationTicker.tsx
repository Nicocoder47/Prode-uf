import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getDefaultScoringDisplay } from '../../hooks/useScoringDisplayConfig.ts'
import { useNotificationInbox } from '../../hooks/useNotificationInbox.ts'
import { fetchActiveAdminCards } from '../../services/admin/adminService.ts'
import { resolveScoringDisplay } from '../../config/scoringDisplay.ts'
import { resolveTickerContent } from '../../config/tickerContent.ts'
import { NotificationInboxPanel } from './NotificationInboxPanel.tsx'

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
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<TickerItem[]>(buildFallbackItems)
  const {
    globalAlert,
    hasActiveAlert,
    globalAlertPending,
    items: inboxItems,
    unreadCount,
    markRead,
    dismissGlobal,
  } = useNotificationInbox()

  const reloadTicker = useCallback(async () => {
    try {
      const cards = await fetchActiveAdminCards().catch(() => [])
      const scoring = resolveScoringDisplay(cards)
      const content = resolveTickerContent(cards, scoring)

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

      const merged = [welcome, scoringTip, ...fromCard]
      setItems(merged.length > 0 ? merged : buildFallbackItems())
    } catch {
      setItems(buildFallbackItems())
    }
  }, [])

  useEffect(() => {
    void reloadTicker()
    const id = window.setInterval(() => {
      void reloadTicker()
    }, 60000)
    return () => window.clearInterval(id)
  }, [reloadTicker])

  const displayItems = useMemo(() => {
    if (!hasActiveAlert || !globalAlert) return items

    const globalItem: TickerItem = {
      id: 'global-alert',
      title: globalAlert.title || globalAlert.kicker,
      message: globalAlert.message || 'Tocá la campana para leer el aviso',
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

  const tickerUnread = displayItems.filter(i => !i.isRead && !i.isGlobalAlert).length
  const badgeCount =
    unreadCount > 0 ? (unreadCount > 9 ? '9+' : String(unreadCount)) : globalAlertPending ? '!' : null

  return (
    <div className="wc26-notification-ticker mx-3 mt-2">
      <div
        className={`wc26-notification-ticker__inner${globalAlertPending ? ' has-unread-alert' : hasActiveAlert || tickerUnread > 0 ? ' has-unread' : ''}`}
      >
        <button
          type="button"
          className={`wc26-notification-ticker__badge${globalAlertPending ? ' is-attention' : hasActiveAlert || unreadCount > 0 ? ' is-live' : ''}`}
          aria-label="Notificaciones"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
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
                onClick={() => setOpen(true)}
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

      <NotificationInboxPanel
        open={open}
        onClose={() => setOpen(false)}
        globalAlert={globalAlert}
        hasActiveAlert={hasActiveAlert}
        globalAlertPending={globalAlertPending}
        items={inboxItems}
        onDismissGlobal={dismissGlobal}
        onReadNotification={id => {
          void markRead(id)
        }}
        className="wc26-notif-inbox--ticker"
      />
    </div>
  )
}
