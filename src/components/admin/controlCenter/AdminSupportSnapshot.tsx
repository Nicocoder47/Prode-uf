import { Link } from 'react-router-dom'
import { LifeBuoy } from 'lucide-react'
import { AdminControlGlass } from './AdminControlGlass'

type AdminSupportSnapshotProps = {
  open: number
  inReview: number
  resolved: number
}

export function AdminSupportSnapshot({ open, inReview, resolved }: AdminSupportSnapshotProps) {
  const stats = [
    { label: 'Abiertos', value: open, tone: open > 0 ? 'alert' : 'neutral' },
    { label: 'En revisión', value: inReview, tone: inReview > 0 ? 'warn' : 'neutral' },
    { label: 'Resueltos', value: resolved, tone: 'ok' },
  ] as const

  return (
    <AdminControlGlass
      kicker="Usuarios"
      title="Soporte"
      description="Resumen de consultas del Centro de Soporte"
      action={
        <Link to="/admin/support" className="admin-control-link">
          <LifeBuoy className="h-4 w-4" />
          /admin/support
        </Link>
      }
    >
      <div className="admin-control-support-grid">
        {stats.map(stat => (
          <div key={stat.label} className={`admin-control-support-stat admin-control-support-stat--${stat.tone}`}>
            <p className="admin-control-support-stat__value">{stat.value}</p>
            <p className="admin-control-support-stat__label">{stat.label}</p>
          </div>
        ))}
      </div>
    </AdminControlGlass>
  )
}
