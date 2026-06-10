import { Link } from 'react-router-dom'
import type { OperationalRecommendation } from '../../../types/adminOperations.ts'

const PRIORITY_CLASS: Record<OperationalRecommendation['priority'], string> = {
  low: 'admin-ops-rec--low',
  medium: 'admin-ops-rec--medium',
  high: 'admin-ops-rec--high',
}

export function OperationsRecommendationBar({ items }: { items: OperationalRecommendation[] }) {
  if (items.length === 0) return null

  return (
    <section className="admin-ops-recs">
      <p className="admin-ops-recs__kicker">Motor de decisiones</p>
      <h2 className="admin-ops-recs__title">Recomendaciones del sistema</h2>
      <ul className="admin-ops-recs__list">
        {items.map(rec => (
          <li key={rec.id} className={`admin-ops-rec ${PRIORITY_CLASS[rec.priority]}`}>
            <span className="admin-ops-rec__dot" aria-hidden="true" />
            <p className="admin-ops-rec__msg">{rec.message}</p>
            {rec.actionTo && rec.actionLabel ? (
              <Link to={rec.actionTo} className="admin-ops-rec__cta">
                {rec.actionLabel}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
