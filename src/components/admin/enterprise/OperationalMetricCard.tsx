import { Link } from 'react-router-dom'
import { AdminStatusLight } from '../AdminStatusLight.tsx'
import type { OperationalMetric } from '../../../types/adminOperations.ts'

export function OperationalMetricCard({ metric }: { metric: OperationalMetric }) {
  return (
    <article className="admin-ops-metric">
      <div className="admin-ops-metric__head">
        <p className="admin-ops-metric__label">{metric.label}</p>
        <AdminStatusLight status={metric.state} />
      </div>
      <p className="admin-ops-metric__value">{metric.value}</p>
      {metric.trend ? <p className="admin-ops-metric__trend">{metric.trend}</p> : null}
      <p className="admin-ops-metric__explanation">{metric.explanation}</p>
      <p className="admin-ops-metric__action">
        <span className="admin-ops-metric__action-label">Acción:</span> {metric.suggestedAction}
      </p>
      <footer className="admin-ops-metric__foot">
        <time className="admin-ops-metric__time" dateTime={metric.updatedAt}>
          {new Date(metric.updatedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
        </time>
        {metric.actionTo && metric.actionLabel ? (
          <Link to={metric.actionTo} className="admin-ops-metric__cta">
            {metric.actionLabel}
          </Link>
        ) : null}
      </footer>
    </article>
  )
}
