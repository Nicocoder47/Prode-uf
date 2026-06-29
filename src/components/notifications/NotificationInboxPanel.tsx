import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { GlobalAppAlert } from '../../types/globalAlert'
import type { AppNotification } from '../../types/admin'

type NotificationInboxPanelProps = {
  open: boolean
  onClose: () => void
  globalAlert: GlobalAppAlert | null
  hasActiveAlert: boolean
  globalAlertPending: boolean
  items: AppNotification[]
  onDismissGlobal: () => void
  onReadNotification: (id: string) => void
  className?: string
}

export function NotificationInboxPanel({
  open,
  onClose,
  globalAlert,
  hasActiveAlert,
  globalAlertPending,
  items,
  onDismissGlobal,
  onReadNotification,
  className = '',
}: NotificationInboxPanelProps) {
  if (!open) return null

  const hasContent = hasActiveAlert || items.length > 0

  return (
    <div className={`wc26-notif-inbox ${className}`} role="dialog" aria-label="Notificaciones">
      <div className="wc26-notif-inbox__header">
        <p className="wc26-notif-inbox__title">Notificaciones</p>
        <div className="wc26-notif-inbox__actions">
          <Link to="/notifications" className="wc26-notif-inbox__link" onClick={onClose}>
            Ver todas
          </Link>
          <button type="button" className="wc26-notif-inbox__close" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="wc26-notif-inbox__body">
        {!hasContent ? (
          <p className="wc26-notif-inbox__empty">No tenés notificaciones nuevas.</p>
        ) : (
          <>
            {hasActiveAlert && globalAlert ? (
              <article
                className={`wc26-notif-inbox__card wc26-notif-inbox__card--global${globalAlertPending ? ' is-unread' : ''}`}
              >
                <p className="wc26-notif-inbox__kicker">{globalAlert.kicker}</p>
                <h3 className="wc26-notif-inbox__card-title">{globalAlert.title}</h3>
                {globalAlert.message ? <p className="wc26-notif-inbox__card-message">{globalAlert.message}</p> : null}
                {globalAlertPending ? (
                  <button type="button" className="wc26-notif-inbox__cta" onClick={onDismissGlobal}>
                    Entendido
                  </button>
                ) : null}
              </article>
            ) : null}

            {items.slice(0, 8).map(n => (
              <button
                key={n.id}
                type="button"
                className={`wc26-notif-inbox__card wc26-notif-inbox__card--item${n.is_read ? '' : ' is-unread'}`}
                onClick={() => {
                  if (!n.is_read) onReadNotification(n.id)
                }}
              >
                <h3 className="wc26-notif-inbox__card-title">{n.title}</h3>
                <p className="wc26-notif-inbox__card-message">{n.message}</p>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
