import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import type { AdminUserPredictionRow } from '../../../types/admin'
import { AdminUserPredictionCard } from './AdminUserPredictionCard'

type FilterId = '' | 'pending' | 'locked' | 'scored'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: '', label: 'Todas' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'locked', label: 'Bloqueadas' },
  { id: 'scored', label: 'Puntuadas' },
]

type Props = {
  predictions: AdminUserPredictionRow[]
}

export function AdminUserPredictionsTab({ predictions }: Props) {
  const [filter, setFilter] = useState<FilterId>('')

  const filtered = useMemo(() => {
    if (!filter) return predictions
    return predictions.filter(p => {
      const s = p.status === 'locked' ? 'locked' : p.status === 'scored' ? 'scored' : 'pending'
      return s === filter
    })
  }, [predictions, filter])

  if (predictions.length === 0) {
    return (
      <div className="admin-pred-empty">
        <div className="admin-pred-empty__icon" aria-hidden>
          <Target className="h-8 w-8 text-amber-300/70" strokeWidth={1.75} />
        </div>
        <p className="admin-pred-empty__title">Este usuario todavía no realizó predicciones.</p>
        <p className="admin-pred-empty__hint">Cuando cargue pronósticos aparecerán acá con estado y puntos.</p>
      </div>
    )
  }

  return (
    <div className="admin-pred-tab">
      <div className="admin-pred-tab__filters" role="tablist" aria-label="Filtrar predicciones">
        {FILTERS.map(f => (
          <button
            key={f.id || 'all'}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`admin-pred-tab__filter${filter === f.id ? ' is-active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="admin-pred-tab__no-results">Sin predicciones para este filtro.</p>
      ) : (
        <div className="admin-pred-tab__list">
          {filtered.map(p => (
            <AdminUserPredictionCard key={p.id} prediction={p} />
          ))}
        </div>
      )}
    </div>
  )
}
