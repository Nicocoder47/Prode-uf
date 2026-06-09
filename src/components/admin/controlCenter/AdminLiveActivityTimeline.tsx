import { formatRelativeMinutes, minutesSince, type LiveFeedItem } from '../../../utils/adminControlCenter'
import { AdminControlGlass } from './AdminControlGlass'

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AdminLiveActivityTimeline({ items }: { items: LiveFeedItem[] }) {
  return (
    <AdminControlGlass
      kicker="En vivo"
      title="Actividad reciente"
      description="Últimos 20 eventos — registros, logins, predicciones, tickets"
    >
      {items.length === 0 ? (
        <p className="admin-control-empty">Sin actividad reciente.</p>
      ) : (
        <ol className="admin-control-timeline">
          {items.map((item, index) => (
            <li key={item.id} className="admin-control-timeline__item">
              <span className="admin-control-timeline__rail" aria-hidden="true">
                <span className={`admin-control-timeline__dot${index === 0 ? ' is-live' : ''}`} />
              </span>
              <div className="admin-control-timeline__content">
                <div className="admin-control-timeline__top">
                  <span className="admin-control-timeline__type">{item.type}</span>
                  <span className="admin-control-timeline__time">
                    {formatRelativeMinutes(minutesSince(item.createdAt))}
                  </span>
                </div>
                <p className="admin-control-timeline__title">{item.title}</p>
                <p className="admin-control-timeline__subtitle">{item.subtitle}</p>
                <p className="admin-control-timeline__meta">{formatDate(item.createdAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </AdminControlGlass>
  )
}
