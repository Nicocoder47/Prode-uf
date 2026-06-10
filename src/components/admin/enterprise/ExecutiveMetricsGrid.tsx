import { OperationalMetricCard } from './OperationalMetricCard.tsx'
import type { OperationalMetric } from '../../../types/adminOperations.ts'

export function ExecutiveMetricsGrid({
  title,
  kicker,
  metrics,
}: {
  title: string
  kicker: string
  metrics: OperationalMetric[]
}) {
  return (
    <section className="admin-ops-section">
      <header className="admin-ops-section__head">
        <div>
          <p className="admin-ops-section__kicker">{kicker}</p>
          <h2 className="admin-ops-section__title">{title}</h2>
        </div>
      </header>
      <div className="admin-ops-metrics-grid">
        {metrics.map(m => (
          <OperationalMetricCard key={m.id} metric={m} />
        ))}
      </div>
    </section>
  )
}
