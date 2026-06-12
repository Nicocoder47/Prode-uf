import type { Match, MatchStatus } from '../../types/worldcup'
import { CalendarDays, Check, Circle, Clock, MapPin, Pencil } from 'lucide-react'
import { TeamCrest } from './TeamCrest'
import { teamDisplayName } from '../../utils/teamDisplay'

const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: 'Programado',
  live: 'En juego',
  halftime: 'Entretiempo',
  finished: 'Finalizado',
  postponed: 'Pospuesto',
  cancelled: 'Cancelado',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).toUpperCase()
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDayHeader(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function venueInfo(match: Match) {
  const stadium = match.stadium?.trim() || null
  const city = match.city?.trim() || null
  return { stadium, city }
}

interface CompactMatchCardProps {
  match: Match
  hasPrediction?: boolean
  predictedHome?: number | null
  predictedAway?: number | null
  onPredict?: () => void
  featured?: boolean
  showDayHeader?: boolean
  compact?: boolean
}

function ScoreBox({ value, variant = 'pick' }: { value?: number | null; variant?: 'pick' | 'final' }) {
  const cls = [
    'wc26-fixture-row-card__score-box',
    variant === 'final' ? 'wc26-fixture-row-card__score-box--final' : '',
    value == null ? 'wc26-fixture-row-card__score-box--empty' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return <span className={cls}>{value != null ? value : '—'}</span>
}

export function CompactMatchCard({
  match,
  hasPrediction,
  predictedHome,
  predictedAway,
  onPredict,
  featured,
  showDayHeader,
  compact = true,
}: CompactMatchCardProps) {
  const home = match.homeTeam
  const away = match.awayTeam
  if (!home || !away) return null

  const homeName = teamDisplayName(home)
  const awayName = teamDisplayName(away)
  const isLive = match.status === 'live' || match.status === 'halftime'
  const isFinished = match.status === 'finished'
  const canPredict = !!onPredict && match.status === 'scheduled' && !match.isLocked
  const predicted = hasPrediction ?? (predictedHome != null && predictedAway != null)
  const pickHome = predictedHome ?? null
  const pickAway = predictedAway ?? null
  const { stadium, city } = venueInfo(match)
  const statusLabel = match.isLocked && match.status === 'scheduled' ? 'Cerrado' : STATUS_LABEL[match.status]

  const cardClass = [
    'wc26-fixture-row-card',
    compact ? 'wc26-fixture-row-card--compact' : '',
    featured ? 'wc26-fixture-row-card--featured' : '',
    predicted ? 'wc26-fixture-row-card--predicted' : '',
    isLive ? 'wc26-fixture-row-card--live' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={cardClass}>
      {showDayHeader ? <p className="wc26-fixture-row-card__day">{fmtDayHeader(match.kickoff)}</p> : null}

      <div className="wc26-fixture-row-card__chips">
        <span className="wc26-fixture-row-card__chip wc26-fixture-row-card__chip--strong">
          <CalendarDays className="h-3 w-3" aria-hidden="true" />
          {fmtDate(match.kickoff)}
        </span>
        <span className="wc26-fixture-row-card__chip wc26-fixture-row-card__chip--strong">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {fmtTime(match.kickoff)}
        </span>
      </div>

      {(stadium || city) && (
        <div className="wc26-fixture-row-card__venue">
          <MapPin className="wc26-fixture-row-card__venue-icon" aria-hidden="true" />
          <div className="wc26-fixture-row-card__venue-copy">
            {stadium ? (
              <span className="wc26-fixture-row-card__venue-stadium">{stadium}</span>
            ) : null}
            {city ? <span className="wc26-fixture-row-card__venue-city">{city}</span> : null}
          </div>
        </div>
      )}

      {isLive ? (
        <div className="wc26-fixture-row-card__live">
          <div className="wc26-fixture-row-card__live-head">
            <span />
            <span>Tu pick</span>
            <span>Final</span>
          </div>
          <div className="wc26-fixture-row-card__live-row">
            <div className="wc26-fixture-row-card__live-team">
              <TeamCrest flag={home.flag} code={home.code} name={homeName} size="xs" />
              <span>{homeName}</span>
            </div>
            <span className="wc26-fixture-row-card__live-pick">{pickHome ?? '—'}</span>
            <span className="wc26-fixture-row-card__live-final">{match.homeScore ?? 0}</span>
          </div>
          <div className="wc26-fixture-row-card__live-row">
            <div className="wc26-fixture-row-card__live-team">
              <TeamCrest flag={away.flag} code={away.code} name={awayName} size="xs" />
              <span>{awayName}</span>
            </div>
            <span className="wc26-fixture-row-card__live-pick">{pickAway ?? '—'}</span>
            <span className="wc26-fixture-row-card__live-final">{match.awayScore ?? 0}</span>
          </div>
          <p className="wc26-fixture-row-card__live-status">
            <Circle className="h-2 w-2 fill-current" />
            En juego
          </p>
        </div>
      ) : (
        <div className="wc26-fixture-row-card__match">
          <div className="wc26-fixture-row-card__side wc26-fixture-row-card__side--home">
            <TeamCrest flag={home.flag} code={home.code} name={homeName} size="xs" />
            <span className="wc26-fixture-row-card__name">{homeName}</span>
          </div>

          <div className="wc26-fixture-row-card__scores">
            <ScoreBox
              value={isFinished ? (match.homeScore ?? 0) : predicted ? pickHome : null}
              variant={isFinished ? 'final' : 'pick'}
            />
            <span className="wc26-fixture-row-card__dash">-</span>
            <ScoreBox
              value={isFinished ? (match.awayScore ?? 0) : predicted ? pickAway : null}
              variant={isFinished ? 'final' : 'pick'}
            />
          </div>

          <div className="wc26-fixture-row-card__side wc26-fixture-row-card__side--away">
            <span className="wc26-fixture-row-card__name">{awayName}</span>
            <TeamCrest flag={away.flag} code={away.code} name={awayName} size="xs" />
          </div>
        </div>
      )}

      <div
        className={[
          'wc26-fixture-row-card__foot',
          isFinished && !canPredict ? 'wc26-fixture-row-card__foot--centered' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isFinished ? (
          <span className="wc26-fixture-row-card__status wc26-fixture-row-card__status--finished">
            {statusLabel}
          </span>
        ) : (
          <div className="wc26-fixture-row-card__foot-left">
            {predicted && !isLive ? (
              <span className="wc26-fixture-row-card__saved-text">
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                Predicción guardada
              </span>
            ) : (
              <span className={`wc26-fixture-row-card__status wc26-fixture-row-card__status--${match.status}`}>
                {statusLabel}
              </span>
            )}
          </div>
        )}

        {canPredict ? (
          <div className="wc26-fixture-row-card__foot-actions">
            <button type="button" className="wc26-fixture-row-card__action" onClick={onPredict}>
              <Pencil className="h-3 w-3" aria-hidden="true" />
              {predicted ? 'Modificar' : 'Predecir'}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function groupMatchesByDay(matches: Match[]): { label: string; matches: Match[] }[] {
  const map = new Map<string, Match[]>()
  for (const match of matches) {
    const key = new Date(match.kickoff).toDateString()
    const list = map.get(key) ?? []
    list.push(match)
    map.set(key, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([, dayMatches]) => ({
      label: fmtDayHeader(dayMatches[0].kickoff),
      matches: dayMatches.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()),
    }))
}
