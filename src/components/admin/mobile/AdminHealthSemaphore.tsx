import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { HealthStatus } from '../../../types/admin'

type Props = {
  status: HealthStatus
  redCount: number
  yellowCount: number
}

const LABELS: Record<HealthStatus, string> = {
  green: 'Sistema OK',
  yellow: 'Revisión necesaria',
  red: 'Problema crítico',
}

const ICONS = {
  green: CheckCircle2,
  yellow: AlertTriangle,
  red: XCircle,
}

export function AdminHealthSemaphore({ status, redCount, yellowCount }: Props) {
  const Icon = ICONS[status]
  const label = LABELS[status]

  return (
    <section className={`admin-health-semaphore admin-health-semaphore--${status}`}>
      <Icon className="admin-health-semaphore__icon" strokeWidth={2} />
      <div>
        <p className="admin-health-semaphore__label">{label}</p>
        <p className="admin-health-semaphore__detail">
          {redCount > 0 && `${redCount} crítico(s)`}
          {redCount > 0 && yellowCount > 0 && ' · '}
          {yellowCount > 0 && `${yellowCount} en revisión`}
          {redCount === 0 && yellowCount === 0 && 'Todos los servicios operativos'}
        </p>
      </div>
      <Link to="/admin/operations" className="admin-health-semaphore__cta md:hidden">
        Revisar alertas
      </Link>
    </section>
  )
}
