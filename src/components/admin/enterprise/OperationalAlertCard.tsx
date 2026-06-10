import { Link } from 'react-router-dom'
import type { OperationalAlert } from '../../../types/adminOperations.ts'

const SEVERITY_CLASS: Record<OperationalAlert['severity'], string> = {
  info: 'admin-ops-alert--info',
  success: 'admin-ops-alert--success',
  warning: 'admin-ops-alert--warning',
  critical: 'admin-ops-alert--critical',
}

const SEVERITY_LABEL: Record<OperationalAlert['severity'], string> = {
  info: 'INFO',
  success: 'OK',
  warning: 'WARNING',
  critical: 'CRITICAL',
}

export function OperationalAlertCard({ alert }: { alert: OperationalAlert }) {
  return (
    <article className={`admin-ops-alert ${SEVERITY_CLASS[alert.severity]}`}>
      <div className="admin-ops-alert__head">
        <span className="admin-ops-alert__badge">{SEVERITY_LABEL[alert.severity]}</span>
        <time className="admin-ops-alert__time" dateTime={alert.timestamp}>
          {new Date(alert.timestamp).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
        </time>
      </div>
      <h3 className="admin-ops-alert__title">{alert.title}</h3>
      <p className="admin-ops-alert__desc">{alert.description}</p>
      <dl className="admin-ops-alert__meta">
        <div>
          <dt>Causa</dt>
          <dd>{alert.cause}</dd>
        </div>
        <div>
          <dt>Impacto</dt>
          <dd>{alert.impact}</dd>
        </div>
        <div>
          <dt>Acción sugerida</dt>
          <dd>{alert.suggestedAction}</dd>
        </div>
      </dl>
      {alert.actionTo && alert.actionLabel ? (
        <Link to={alert.actionTo} className="admin-ops-alert__cta">
          {alert.actionLabel}
        </Link>
      ) : null}
    </article>
  )
}
