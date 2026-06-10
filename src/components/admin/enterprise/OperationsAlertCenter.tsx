import { OperationalAlertCard } from './OperationalAlertCard.tsx'
import type { OperationalAlert } from '../../../types/adminOperations.ts'

export function OperationsAlertCenter({ alerts }: { alerts: OperationalAlert[] }) {
  const critical = alerts.filter(a => a.severity === 'critical').length
  const warning = alerts.filter(a => a.severity === 'warning').length

  return (
    <section className="admin-ops-section">
      <header className="admin-ops-section__head">
        <div>
          <p className="admin-ops-section__kicker">Centro de alertas</p>
          <h2 className="admin-ops-section__title">Alertas operativas</h2>
        </div>
        <div className="admin-ops-section__badges">
          {critical > 0 ? <span className="admin-ops-pill admin-ops-pill--critical">{critical} críticas</span> : null}
          {warning > 0 ? <span className="admin-ops-pill admin-ops-pill--warning">{warning} warnings</span> : null}
        </div>
      </header>
      <div className="admin-ops-alerts-grid">
        {alerts.map(alert => (
          <OperationalAlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </section>
  )
}
