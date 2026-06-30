import type { AdminUserPredictionRow } from '../../../types/admin'
import { buildAdminPredictionBreakdown } from '../../../utils/adminPredictionDisplay'

type Props = {
  prediction: AdminUserPredictionRow
  compact?: boolean
}

function hitClass(hit: boolean | null): string {
  if (hit === true) return 'admin-pred-breakdown__cell--hit'
  if (hit === false) return 'admin-pred-breakdown__cell--miss'
  return 'admin-pred-breakdown__cell--na'
}

export function AdminPredictionBreakdown({ prediction, compact = false }: Props) {
  const breakdown = buildAdminPredictionBreakdown(prediction)

  if (compact) {
    return (
      <div className="admin-pred-breakdown admin-pred-breakdown--compact">
        {breakdown.parts.map(part => (
          <div key={part.key} className={`admin-pred-breakdown__row ${hitClass(part.hit)}`}>
            <span className="admin-pred-breakdown__label">{part.label}</span>
            <span className="admin-pred-breakdown__pred">{part.predicted}</span>
            {part.actual != null && (
              <span className="admin-pred-breakdown__actual">Real {part.actual}</span>
            )}
            {prediction.status === 'scored' && part.hit != null && (
              <span className="admin-pred-breakdown__pts">+{part.points}</span>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="admin-pred-breakdown">
      <div className="admin-pred-breakdown__head" aria-hidden>
        <span />
        <span>Pronóstico</span>
        <span>Real</span>
        <span>Pts</span>
      </div>
      {breakdown.parts.map(part => (
        <div key={part.key} className={`admin-pred-breakdown__row ${hitClass(part.hit)}`}>
          <span className="admin-pred-breakdown__label">{part.label}</span>
          <span className="admin-pred-breakdown__pred">{part.predicted}</span>
          <span className="admin-pred-breakdown__actual">{part.actual ?? '—'}</span>
          <span className="admin-pred-breakdown__pts">
            {prediction.status === 'scored' && part.hit != null
              ? `+${part.points}/${part.maxPoints}`
              : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}
