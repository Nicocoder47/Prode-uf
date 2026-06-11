import { Link } from 'react-router-dom'
import { CalendarDays, Radio, Target, Trophy } from 'lucide-react'
import type { AdminDashboard, AdminScoringCenter } from '../../types/admin'
import type { Match } from '../../types/worldcup'

type Props = {
  dashboard?: AdminDashboard | null
  scoring?: AdminScoringCenter | null
  matches?: Match[]
}

function isToday(iso: string | null | undefined) {
  if (!iso) return false
  return new Date(iso).toDateString() === new Date().toDateString()
}

export function AdminMatchDayCard({ dashboard, scoring, matches = [] }: Props) {
  const todayMatches = matches.filter(m => isToday(m.kickoff ?? m.date))
  const liveMatches = matches.filter(m => m.status === 'live' || m.status === 'halftime')
  const finishedUnscored =
    scoring?.matches.filter(m => m.status === 'finished' && m.scoring_status === 'pending_scoring') ?? []
  const predictionsToday = dashboard?.total_predictions ?? 0
  const orphanCount = scoring?.orphan_scored?.count ?? 0
  const pendingScoring = scoring?.summary.pending_scoring ?? 0

  if (todayMatches.length === 0 && liveMatches.length === 0 && finishedUnscored.length === 0) {
    return null
  }

  return (
    <section className="admin-match-day-card">
      <div className="admin-match-day-card__header">
        <CalendarDays className="h-5 w-5 text-amber-300" />
        <div>
          <p className="admin-match-day-card__kicker">Operación en vivo</p>
          <h2 className="admin-match-day-card__title">Día de partido</h2>
        </div>
      </div>

      <div className="admin-match-day-card__stats">
        <div className="admin-match-day-card__stat">
          <span className="admin-match-day-card__stat-value">{todayMatches.length}</span>
          <span className="admin-match-day-card__stat-label">Hoy</span>
        </div>
        <div className="admin-match-day-card__stat">
          <span className="admin-match-day-card__stat-value">{liveMatches.length}</span>
          <span className="admin-match-day-card__stat-label">En vivo</span>
        </div>
        <div className="admin-match-day-card__stat">
          <span className="admin-match-day-card__stat-value">{finishedUnscored.length}</span>
          <span className="admin-match-day-card__stat-label">Sin scoring</span>
        </div>
        <div className="admin-match-day-card__stat">
          <span className="admin-match-day-card__stat-value">{predictionsToday}</span>
          <span className="admin-match-day-card__stat-label">Pred. totales</span>
        </div>
      </div>

      {(orphanCount > 0 || pendingScoring > 0) && (
        <p className="admin-match-day-card__alert">
          {pendingScoring > 0 && `${pendingScoring} partido(s) pendientes de puntuar. `}
          {orphanCount > 0 && `${orphanCount} predicción(es) huérfana(s).`}
        </p>
      )}

      <div className="admin-match-day-card__actions">
        <Link to="/admin/scoring" className="admin-match-day-card__btn">
          <Target className="h-4 w-4" />
          Ir a Scoring
        </Link>
        <Link to="/admin/health" className="admin-match-day-card__btn admin-match-day-card__btn--ghost">
          <Radio className="h-4 w-4" />
          Salud
        </Link>
        <Link to="/admin/notifications" className="admin-match-day-card__btn admin-match-day-card__btn--ghost">
          <Trophy className="h-4 w-4" />
          Notificar
        </Link>
      </div>
    </section>
  )
}
