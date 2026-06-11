import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Info, ShieldAlert } from 'lucide-react'
import { useAdminAlerts } from '../../hooks/useAdminAlerts'
import type { AlertSeverity } from '../../types/adminOperations'

function severityIcon(severity: AlertSeverity) {
  if (severity === 'critical') return ShieldAlert
  if (severity === 'warning') return AlertTriangle
  return Info
}

function severityClass(severity: AlertSeverity) {
  if (severity === 'critical') return 'admin-alerts-bar__item--critical'
  if (severity === 'warning') return 'admin-alerts-bar__item--warning'
  return 'admin-alerts-bar__item--info'
}

export function AdminAlertsBar() {
  const { alerts, isLoading } = useAdminAlerts()

  if (isLoading || alerts.length === 0) return null

  const visible = alerts.slice(0, 4)

  return (
    <div className="admin-alerts-bar" role="region" aria-label="Alertas operativas">
      {visible.map(alert => {
        const Icon = severityIcon(alert.severity)
        return (
          <div key={alert.id} className={`admin-premium-card admin-alerts-bar__item ${severityClass(alert.severity)}`}>
            <Icon className="admin-alerts-bar__icon" strokeWidth={2.25} />
            <div className="admin-alerts-bar__text">
              <p className="admin-alerts-bar__title">{alert.title}</p>
              <p className="admin-alerts-bar__desc">{alert.description}</p>
            </div>
            {alert.actionTo ? (
              <Link to={alert.actionTo} className="admin-alerts-bar__action">
                {alert.actionLabel ?? 'Ver'}
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
