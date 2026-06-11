import { AlertTriangle } from 'lucide-react'
import type { AdminUserPredictionRow } from '../../../types/admin'

type PredictionStatus = 'pending' | 'locked' | 'scored'

const STATUS_BADGE: Record<PredictionStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'admin-pred-card__badge--pending' },
  locked: { label: 'Bloqueada', className: 'admin-pred-card__badge--locked' },
  scored: { label: 'Puntuada', className: 'admin-pred-card__badge--scored' },
}

const MATCH_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Programado',
  live: 'En vivo',
  halftime: 'Entretiempo',
  finished: 'Finalizado',
  postponed: 'Postergado',
  cancelled: 'Cancelado',
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function normalizeStatus(status: string): PredictionStatus {
  if (status === 'locked') return 'locked'
  if (status === 'scored') return 'scored'
  return 'pending'
}

function statusMessage(status: PredictionStatus) {
  if (status === 'pending') return 'Pendiente de jugarse'
  if (status === 'locked') return 'Predicción bloqueada'
  return null
}

type Props = {
  prediction: AdminUserPredictionRow
}

export function AdminUserPredictionCard({ prediction: p }: Props) {
  const status = normalizeStatus(p.status)
  const badge = STATUS_BADGE[status]
  const message = statusMessage(status)
  const matchLabel = MATCH_STATUS_LABEL[p.match_status] ?? p.match_status
  const isOrphan = status === 'scored' && p.match_status !== 'finished'
  const scoredAt = status === 'scored' ? (p.scored_at ?? p.updated_at) : null

  return (
    <article className={`admin-pred-card admin-pred-card--${status}`}>
      <div className="admin-pred-card__head">
        <div className="min-w-0">
          <h3 className="admin-pred-card__match">
            {p.home_team ?? '?'} <span className="text-white/35">vs</span> {p.away_team ?? '?'}
          </h3>
          <p className="admin-pred-card__date">{formatDate(p.kick_off)}</p>
        </div>
        <span className={`admin-pred-card__badge ${badge.className}`}>{badge.label}</span>
      </div>

      <div className="admin-pred-card__grid">
        <div>
          <span className="admin-pred-card__label">Estado partido</span>
          <span className="admin-pred-card__value">{matchLabel}</span>
        </div>
        <div>
          <span className="admin-pred-card__label">Predicción</span>
          <span className="admin-pred-card__value admin-pred-card__value--mono">
            {p.predicted_score_home ?? '—'} - {p.predicted_score_away ?? '—'}
          </span>
        </div>
        <div>
          <span className="admin-pred-card__label">Resultado real</span>
          <span className="admin-pred-card__value admin-pred-card__value--mono">
            {p.result_home != null ? `${p.result_home} - ${p.result_away}` : '—'}
          </span>
        </div>
        {scoredAt && (
          <div className="admin-pred-card__span">
            <span className="admin-pred-card__label">Puntuada el</span>
            <span className="admin-pred-card__value">{formatDate(scoredAt)}</span>
          </div>
        )}
      </div>

      {message && <p className="admin-pred-card__message">{message}</p>}
      {status === 'scored' && (
        <p className="admin-pred-card__message admin-pred-card__message--scored">Puntos: {p.points}</p>
      )}
      {isOrphan && (
        <p className="admin-pred-card__orphan" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Revisar: predicción puntuada en partido no finalizado
        </p>
      )}
    </article>
  )
}
