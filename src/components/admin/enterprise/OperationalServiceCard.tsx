import { Link } from 'react-router-dom'
import { AdminStatusLight } from '../AdminStatusLight.tsx'
import type { EnrichedServiceHealth } from '../../../types/adminOperations.ts'

function formatDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

const RISK_CLASS: Record<EnrichedServiceHealth['risk'], string> = {
  bajo: 'text-emerald-300',
  medio: 'text-amber-300',
  alto: 'text-orange-300',
  critico: 'text-red-300',
}

export function OperationalServiceCard({ service }: { service: EnrichedServiceHealth }) {
  return (
    <article
      className={`admin-ops-service admin-ops-service--${service.status}`}
    >
      <div className="admin-ops-service__head">
        <h3 className="admin-ops-service__title">{service.label}</h3>
        <AdminStatusLight status={service.status} />
      </div>
      <p className="admin-ops-service__desc">{service.description}</p>
      <dl className="admin-ops-service__grid">
        <div>
          <dt>Estado</dt>
          <dd className="uppercase">{service.status}</dd>
        </div>
        <div>
          <dt>Última ejecución</dt>
          <dd>{formatDate(service.lastRun)}</dd>
        </div>
        <div>
          <dt>Respuesta</dt>
          <dd>{service.responseMs != null ? `${service.responseMs} ms` : '—'}</dd>
        </div>
        <div>
          <dt>Riesgo</dt>
          <dd className={RISK_CLASS[service.risk]}>{service.risk.toUpperCase()}</dd>
        </div>
        <div className="admin-ops-service__span">
          <dt>Acción recomendada</dt>
          <dd>{service.suggestedAction}</dd>
        </div>
        <div className="admin-ops-service__span">
          <dt>Historial 24 h</dt>
          <dd>{service.history24h}</dd>
        </div>
        <div className="admin-ops-service__span">
          <dt>Historial 7 días</dt>
          <dd>{service.history7d}</dd>
        </div>
        {service.lastError ? (
          <div className="admin-ops-service__span">
            <dt>Último error</dt>
            <dd className="text-red-300">{service.lastError}</dd>
          </div>
        ) : null}
      </dl>
      {service.actionTo && service.actionLabel ? (
        <Link to={service.actionTo} className="admin-ops-service__cta">
          {service.actionLabel}
        </Link>
      ) : null}
    </article>
  )
}
