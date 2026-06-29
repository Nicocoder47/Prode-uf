import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNotificationInbox } from '../../hooks/useNotificationInbox.ts'
import { NotificationInboxPanel } from './NotificationInboxPanel.tsx'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const {
    globalAlert,
    hasActiveAlert,
    globalAlertPending,
    items,
    unreadCount,
    markRead,
    dismissGlobal,
  } = useNotificationInbox()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`wc26-header-icon-btn relative${globalAlertPending ? ' is-attention' : hasActiveAlert || unreadCount > 0 ? ' is-live' : ''}`}
        aria-label="Notificaciones"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white${globalAlertPending ? ' is-pulse' : ''}`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationInboxPanel
        open={open}
        onClose={() => setOpen(false)}
        globalAlert={globalAlert}
        hasActiveAlert={hasActiveAlert}
        globalAlertPending={globalAlertPending}
        items={items}
        onDismissGlobal={() => {
          dismissGlobal()
        }}
        onReadNotification={id => {
          void markRead(id)
        }}
        className="wc26-notif-inbox--header"
      />
    </div>
  )
}
