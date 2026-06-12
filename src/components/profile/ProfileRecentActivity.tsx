import { Link } from 'react-router-dom'
import { AdaptiveSection } from '../../utils/adaptiveMotion'
import { MOTION } from '../../constants/design'
import { ChevronRight } from 'lucide-react'
import { TeamCrest } from '../worldcup/TeamCrest'
import type { Match, Prediction } from '../../types/worldcup'

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'wc26-profile-activity__status--pending' },
  locked: { label: 'Bloqueada', className: 'wc26-profile-activity__status--locked' },
  scored: { label: 'Puntuada', className: 'wc26-profile-activity__status--scored' },
}

function getScore(prediction: Prediction) {
  const home = prediction.predictedHomeScore ?? prediction.exactScore?.home
  const away = prediction.predictedAwayScore ?? prediction.exactScore?.away
  if (home == null || away == null) return '—'
  return `${home} - ${away}`
}

type ProfileRecentActivityProps = {
  predictions: Prediction[]
  matches: Match[]
}

export function ProfileRecentActivity({ predictions, matches }: ProfileRecentActivityProps) {
  const rows = [...predictions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  return (
    <AdaptiveSection motionProps={MOTION.enter} className="wc26-profile-section wc26-deferred-section">
      <div className="wc26-profile-section__header">
        <p className="wc26-profile-section__kicker">Historial</p>
        <h2 className="wc26-profile-section__title">Actividad reciente</h2>
      </div>

      {rows.length === 0 ? (
        <div className="wc26-profile-empty">
          Todavía no hiciste predicciones.{' '}
          <Link to="/matches" className="wc26-profile-empty__link">
            Elegí un partido
          </Link>
        </div>
      ) : (
        <div className="wc26-profile-activity-list">
          {rows.map(prediction => {
            const match = matches.find(m => m.id === prediction.matchId)
            const status = STATUS_META[prediction.status] ?? STATUS_META.pending
            const home = match?.homeTeam
            const away = match?.awayTeam

            return (
              <Link
                key={prediction.id}
                to={match ? `/matches/${match.id}` : '/matches'}
                className="wc26-profile-activity"
              >
                <div className="wc26-profile-activity__teams">
                  {home ? (
                    <TeamCrest flag={home.flag} code={home.code} name={home.name} size="sm" />
                  ) : null}
                  <span className="wc26-profile-activity__score">{getScore(prediction)}</span>
                  {away ? (
                    <TeamCrest flag={away.flag} code={away.code} name={away.name} size="sm" />
                  ) : null}
                </div>
                <div className="wc26-profile-activity__meta">
                  <p className="wc26-profile-activity__match">
                    {home?.name ?? 'Local'} vs {away?.name ?? 'Visitante'}
                  </p>
                  <div className="wc26-profile-activity__footer">
                    <span className={`wc26-profile-activity__status ${status.className}`}>
                      {status.label}
                    </span>
                    {prediction.status === 'scored' ? (
                      <span className="wc26-profile-activity__points">{prediction.points} pts</span>
                    ) : null}
                    <span className="wc26-profile-activity__date">
                      {new Date(prediction.createdAt).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </div>
                <ChevronRight className="wc26-profile-activity__chevron" />
              </Link>
            )
          })}
        </div>
      )}
    </AdaptiveSection>
  )
}
