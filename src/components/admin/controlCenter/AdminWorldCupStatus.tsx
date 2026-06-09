import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { AdminControlGlass } from './AdminControlGlass'

type WorldCupStatusProps = {
  registered: number
  active: number
  predictions: number
  scheduled: number
  finished: number
  openTickets: number
}

export function AdminWorldCupStatus({
  registered,
  active,
  predictions,
  scheduled,
  finished,
  openTickets,
}: WorldCupStatusProps) {
  const stats = [
    { label: 'Usuarios registrados', value: registered },
    { label: 'Usuarios activos', value: active, highlight: true },
    { label: 'Predicciones totales', value: predictions },
    { label: 'Partidos programados', value: scheduled },
    { label: 'Partidos finalizados', value: finished },
    { label: 'Tickets abiertos', value: openTickets, alert: openTickets > 0 },
  ]

  return (
    <AdminControlGlass
      kicker="Mundial 2026"
      title="World Cup Status"
      description="Estado operativo del torneo en tiempo real"
      action={
        <div className="admin-control-status-badge">
          <Trophy className="h-4 w-4 text-[#F8B91E]" aria-hidden="true" />
          Control Center
        </div>
      }
      className="admin-control-glass--hero"
    >
      <div className="admin-control-status-grid">
        {stats.map(stat => (
          <div
            key={stat.label}
            className={`admin-control-stat${stat.highlight ? ' admin-control-stat--gold' : ''}${stat.alert ? ' admin-control-stat--alert' : ''}`}
          >
            <p className="admin-control-stat__value">{stat.value.toLocaleString('es-AR')}</p>
            <p className="admin-control-stat__label">{stat.label}</p>
          </div>
        ))}
      </div>
      <p className="admin-control-status-foot">
        Centro de control sin backend adicional — datos vía <code>admin_get_dashboard</code> y soporte.
      </p>
    </AdminControlGlass>
  )
}

export function AdminAttentionPanel({
  items,
}: {
  items: Array<{ id: string; level: 'error' | 'warning'; message: string; ctaLabel: string; ctaTo: string }>
}) {
  return (
    <AdminControlGlass
      kicker="Prioridad"
      title="Requieren atención"
      description="Acciones sugeridas para el operador"
    >
      {items.length === 0 ? (
        <p className="admin-control-empty">Todo en orden. No hay alertas activas.</p>
      ) : (
        <ul className="admin-control-attention-list">
          {items.map(item => (
            <li key={item.id} className={`admin-control-attention admin-control-attention--${item.level}`}>
              <span className="admin-control-attention__dot" aria-hidden="true">
                {item.level === 'error' ? '🔴' : '🟡'}
              </span>
              <div className="admin-control-attention__body">
                <p className="admin-control-attention__message">{item.message}</p>
                <Link to={item.ctaTo} className="admin-control-attention__cta">
                  {item.ctaLabel}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminControlGlass>
  )
}
