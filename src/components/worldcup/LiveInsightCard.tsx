import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildPlayMatchesUrl } from '../../constants/phases'
import { usePlayMatchesHref } from '../../hooks/usePlayMatchesHref'
import { motion } from 'framer-motion'
import { useMotionEnabled } from '../../utils/adaptiveMotion'
import { ArrowRight } from 'lucide-react'
import { TeamCrest } from './TeamCrest'
import { PrizeImageLightbox } from './PrizeImageLightbox'
import type { WorldCupLiveInsightPayload } from '../../utils/worldCupLiveInsights'
import type { Match, Team } from '../../types/worldcup'
import { resolveTeamFlagUrl, teamDisplayName } from '../../utils/teamDisplay'
import type { LiveScorerRow } from '../../utils/worldCupLiveInsights'

type LiveInsightCardProps = {
  card: WorldCupLiveInsightPayload
  active?: boolean
  onPredict?: (match: Match) => void
  className?: string
}

function ScorerRow({ rank, scorer }: { rank: number; scorer: LiveScorerRow }) {
  const flagUrl = resolveTeamFlagUrl(scorer.flag, scorer.flag, scorer.countryCode, scorer.countryCode ?? undefined)
  const rowStyle = flagUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(2, 18, 24, 0.94) 0%, rgba(2, 18, 24, 0.82) 48%, rgba(2, 18, 24, 0.45) 100%), url("${flagUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'right center',
      }
    : undefined

  return (
    <li className="wc26-live-card__scorer-row" style={rowStyle}>
      <span className="wc26-live-card__scorer-rank">{rank}</span>
      <span className="wc26-live-card__scorer-name">{scorer.name}</span>
      <span className="wc26-live-card__scorer-goals">{scorer.goals}G</span>
    </li>
  )
}

function fmtKickoff(iso: string) {
  const d = new Date(iso)
  return {
    time: d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    date: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }),
  }
}

function MatchFlags({ match }: { match: Match }) {
  if (!match.homeTeam || !match.awayTeam) return null
  return (
    <div className="wc26-live-card__teams">
      <div className="wc26-live-card__team">
        <TeamCrest flag={match.homeTeam.flag} code={match.homeTeam.code} countryCode={match.homeTeam.countryCode} size="lg" />
        <span className="wc26-live-card__team-name">{teamDisplayName(match.homeTeam)}</span>
      </div>
      <span className="wc26-live-card__vs">vs</span>
      <div className="wc26-live-card__team">
        <TeamCrest flag={match.awayTeam.flag} code={match.awayTeam.code} countryCode={match.awayTeam.countryCode} size="lg" />
        <span className="wc26-live-card__team-name">{teamDisplayName(match.awayTeam)}</span>
      </div>
    </div>
  )
}

function TrendBarFill({
  pct,
  className,
  delay = 0,
}: {
  pct: number
  className: string
  delay?: number
}) {
  const motionOn = useMotionEnabled()
  if (!motionOn) {
    return <div className={className} style={{ width: `${pct}%` }} />
  }
  return (
    <motion.div
      className={className}
      initial={{ width: 0 }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 0.45, delay }}
    />
  )
}

function TrendBars({
  homeTeam,
  awayTeam,
  homePct,
  drawPct,
  awayPct,
}: {
  homeTeam: Team
  awayTeam: Team
  homePct: number
  drawPct: number
  awayPct: number
}) {
  const homeLabel = teamDisplayName(homeTeam)
  const awayLabel = teamDisplayName(awayTeam)

  return (
    <div className="wc26-live-card__bars">
      <div className="wc26-live-card__bar-row">
        <span className="wc26-live-card__bar-label">
          <TeamCrest flag={homeTeam.flag} code={homeTeam.code} countryCode={homeTeam.countryCode} size="xs" />
          <span>{homeLabel}</span>
        </span>
        <div className="wc26-live-card__bar">
          <TrendBarFill
            pct={homePct}
            className="wc26-live-card__bar-fill wc26-live-card__bar-fill--home"
          />
        </div>
        <strong>{homePct}%</strong>
      </div>
      <div className="wc26-live-card__bar-row">
        <span className="wc26-live-card__bar-label wc26-live-card__bar-label--draw">
          <span className="wc26-live-card__bar-draw-icon" aria-hidden="true">
            ⚖
          </span>
          <span>Empate</span>
        </span>
        <div className="wc26-live-card__bar">
          <TrendBarFill
            pct={drawPct}
            className="wc26-live-card__bar-fill wc26-live-card__bar-fill--draw"
            delay={0.04}
          />
        </div>
        <strong>{drawPct}%</strong>
      </div>
      <div className="wc26-live-card__bar-row">
        <span className="wc26-live-card__bar-label">
          <TeamCrest flag={awayTeam.flag} code={awayTeam.code} countryCode={awayTeam.countryCode} size="xs" />
          <span>{awayLabel}</span>
        </span>
        <div className="wc26-live-card__bar">
          <TrendBarFill
            pct={awayPct}
            className="wc26-live-card__bar-fill wc26-live-card__bar-fill--away"
            delay={0.08}
          />
        </div>
        <strong>{awayPct}%</strong>
      </div>
    </div>
  )
}

const TODAY_MATCHES_LIMIT = 4
const PLAYED_MATCHES_LIMIT = 3

function cardBodyClass(type: WorldCupLiveInsightPayload['type']): string {
  if (type === 'ranking_move') return 'wc26-live-card__body wc26-live-card__body--stretch'
  if (type === 'played_matches' || type === 'next_match') return 'wc26-live-card__body wc26-live-card__body--list'
  if (type === 'community_trend') return 'wc26-live-card__body wc26-live-card__body--trend'
  return 'wc26-live-card__body wc26-live-card__body--center'
}

function isResolvedTeam(team?: Team | null): boolean {
  if (!team) return false
  const code = team.code?.trim().toUpperCase()
  const name = team.name?.trim().toLowerCase()
  return Boolean(code && code !== 'TBD' && name && !name.includes('por definir'))
}

function TodayMatchesList({
  matches,
  featuredId,
  showTitle = true,
  limit = TODAY_MATCHES_LIMIT,
  solo = false,
  variant = 'today',
}: {
  matches: Match[]
  featuredId?: string
  showTitle?: boolean
  limit?: number
  solo?: boolean
  variant?: 'today' | 'played'
}) {
  const resolvedMatches = matches.filter(match => isResolvedTeam(match.homeTeam) && isResolvedTeam(match.awayTeam))
  if (resolvedMatches.length === 0) return null

  const visible = resolvedMatches.slice(0, limit)
  const hiddenCount = Math.max(0, resolvedMatches.length - limit)

  return (
    <div
      className={`wc26-live-card__today${solo ? ' wc26-live-card__today--solo' : ''}${variant === 'played' ? ' wc26-live-card__today--played' : ''}`}
    >
      {showTitle ? <p className="wc26-live-card__today-title">Partidos de hoy</p> : null}
      <ul
        className={`wc26-live-card__today-list${solo ? ' wc26-live-card__today-list--solo' : ''}${variant === 'played' ? ' wc26-live-card__today-list--played' : ''}`}
      >
        {visible.map(match => {
          const home = match.homeTeam!
          const away = match.awayTeam!
          const kickoff = fmtKickoff(match.kickoff)
          const crestSize = variant === 'played' ? 'md' : 'sm'
          const isFeatured = variant === 'today' && Boolean(featuredId && match.id === featuredId)
          const isLive = variant === 'today' && (match.status === 'live' || match.status === 'halftime')
          const isFinished = variant === 'played' || match.status === 'finished'
          const hasScore = variant === 'played' || isFinished || isLive
          const statusLabel =
            variant === 'played' ? 'Fin' : isLive ? 'Vivo' : isFinished ? 'Fin' : 'Hoy'

          return (
            <li
              key={match.id}
              className={`wc26-live-card__today-row${isFeatured ? ' wc26-live-card__today-row--featured' : ''}${variant === 'played' ? ' wc26-live-card__today-row--played' : ''}`}
            >
              <span className="wc26-live-card__today-time">{kickoff.time}</span>
              <div className="wc26-live-card__today-teams">
                <span className="wc26-live-card__today-team">
                  <TeamCrest flag={home.flag} code={home.code} countryCode={home.countryCode} size={crestSize} />
                  <span className="wc26-live-card__today-name">{teamDisplayName(home)}</span>
                </span>
                <span
                  className={`wc26-live-card__today-score${hasScore ? ' wc26-live-card__today-score--set' : ''}${isLive ? ' wc26-live-card__today-score--live' : ''}${variant === 'played' ? ' wc26-live-card__today-score--played' : ''}`}
                >
                  {hasScore ? `${match.homeScore ?? 0}-${match.awayScore ?? 0}` : '—'}
                </span>
                <span className="wc26-live-card__today-team">
                  <span className="wc26-live-card__today-name">{teamDisplayName(away)}</span>
                  <TeamCrest flag={away.flag} code={away.code} countryCode={away.countryCode} size={crestSize} />
                </span>
              </div>
              <span
                className={`wc26-live-card__today-status${isLive ? ' is-live' : ''}${isFinished ? ' is-finished' : ''}`}
              >
                {statusLabel}
              </span>
            </li>
          )
        })}
      </ul>
      {hiddenCount > 0 ? (
        <p className="wc26-live-card__today-more">
          +{hiddenCount} partido{hiddenCount === 1 ? '' : 's'}{' '}
          {variant === 'played' ? 'más' : 'más hoy'}
        </p>
      ) : null}
    </div>
  )
}

function PlayedMatchesCardBody({
  card,
  onAction,
}: {
  card: Extract<WorldCupLiveInsightPayload, { type: 'played_matches' }>
  onAction: (card: WorldCupLiveInsightPayload) => void
}) {
  return (
    <>
      <TodayMatchesList matches={card.matches} showTitle={false} solo limit={PLAYED_MATCHES_LIMIT} variant="played" />
      {card.cta ? (
        <button type="button" className="wc26-live-card__cta" onClick={() => onAction(card)}>
          {card.cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </>
  )
}

function NextMatchCardBody({
  card,
  onAction,
}: {
  card: Extract<WorldCupLiveInsightPayload, { type: 'next_match' }>
  onAction: (card: WorldCupLiveInsightPayload) => void
}) {
  return (
    <>
      <TodayMatchesList matches={card.todayMatches} showTitle={false} solo limit={TODAY_MATCHES_LIMIT} />
      {card.cta ? (
        <button type="button" className="wc26-live-card__cta" onClick={() => onAction(card)}>
          {card.cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </>
  )
}

const PRIZE_IMAGE_SRC = '/ganadores.png'

function HistoricalWinnersCardBody() {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="wc26-live-card__prize-thumb"
        onClick={() => setLightboxOpen(true)}
        aria-label="Ver imagen del premio en pantalla completa"
      >
        <img
          src={PRIZE_IMAGE_SRC}
          alt="Ganadores Premios Cerveceros"
          className="wc26-live-card__prize-thumb-img"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </button>
      <PrizeImageLightbox
        src={PRIZE_IMAGE_SRC}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}

function CardBody({
  card,
  onAction,
}: {
  card: WorldCupLiveInsightPayload
  onAction: (card: WorldCupLiveInsightPayload) => void
}) {
  switch (card.type) {
    case 'played_matches':
      return <PlayedMatchesCardBody card={card} onAction={onAction} />
    case 'next_match':
      return <NextMatchCardBody card={card} onAction={onAction} />
    case 'community_trend': {
      const home = card.match.homeTeam
      const away = card.match.awayTeam
      if (!home || !away) return null

      return (
        <div className="wc26-live-card__trend-body">
          <MatchFlags match={card.match} />
          <p className="wc26-live-card__highlight wc26-live-card__highlight--trend">{card.favoriteLabel}</p>
          {card.hasEnoughData ? (
            <TrendBars
              homeTeam={home}
              awayTeam={away}
              homePct={card.homePct}
              drawPct={card.drawPct}
              awayPct={card.awayPct}
            />
          ) : (
            <p className="wc26-live-card__meta">Todavía no hay suficientes predicciones para este partido.</p>
          )}
        </div>
      )
    }
    case 'ranking_move':
      return <HistoricalWinnersCardBody />
    case 'popular_match':
      return (
        <>
          <MatchFlags match={card.match} />
          <p className="wc26-live-card__highlight">
            {card.emptyMessage ??
              `${card.predictionCount} ${card.predictionCount === 1 ? 'predicción' : 'predicciones'}`}
          </p>
        </>
      )
    case 'top_scorers':
      return card.scorers.length > 0 ? (
        <ol className="wc26-live-card__scorers">
          {card.scorers.map(s => (
            <ScorerRow key={s.id} rank={s.rank} scorer={s} />
          ))}
        </ol>
      ) : (
        <p className="wc26-live-card__highlight">{card.emptyMessage ?? 'Aún no hay goles registrados'}</p>
      )
    case 'your_progress':
      return (
        <>
          {card.subtitle ? <p className="wc26-live-card__meta">{card.subtitle}</p> : null}
          <p className="wc26-live-card__big">
            <strong>{card.predicted}</strong> / {card.total} partidos · {card.percent}%
          </p>
          <p className="wc26-live-card__meta">
            {card.points} pts · {card.rank != null ? `Puesto #${card.rank}` : 'Sin ranking'}
          </p>
          {card.cta ? (
            <button type="button" className="wc26-live-card__cta" onClick={() => onAction(card)}>
              {card.cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </>
      )
    case 'next_reward':
      return (
        <>
          <p className="wc26-live-card__reward">{card.message}</p>
          {card.cta ? (
            <button type="button" className="wc26-live-card__cta" onClick={() => onAction(card)}>
              {card.cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </>
      )
    default:
      return null
  }
}

export function LiveInsightCard({ card, active = false, onPredict, className = '' }: LiveInsightCardProps) {
  const navigate = useNavigate()
  const playHref = usePlayMatchesHref()

  const handleAction = (c: WorldCupLiveInsightPayload) => {
    if (c.cta?.action === 'predict' && c.type === 'next_match' && c.match) {
      if (onPredict) {
        onPredict(c.match)
        return
      }
      navigate(buildPlayMatchesUrl(c.match.stage, c.match.id))
      return
    }
    if (c.cta?.action === 'leaderboard') {
      navigate('/leaderboard')
      return
    }
    if (c.cta?.action === 'login') {
      navigate('/login')
      return
    }
    navigate(playHref)
  }

  const typeClass = `wc26-live-card--${card.type}`

  return (
    <article
      className={`wc26-live-card${active ? ' wc26-live-card--active' : ''} ${typeClass}${className ? ` ${className}` : ''}`}
    >
      <div className="wc26-live-card__inner">
        {card.type === 'ranking_move' ? (
          <HistoricalWinnersCardBody />
        ) : (
          <>
            <p className="wc26-live-card__kicker">
              <span aria-hidden="true">{card.emoji}</span> {card.title}
            </p>
            {card.subtitle && card.type !== 'community_trend' ? (
              <p className="wc26-live-card__subtitle">{card.subtitle}</p>
            ) : null}
            <div className={cardBodyClass(card.type)}>
              <CardBody card={card} onAction={handleAction} />
            </div>
          </>
        )}
      </div>
      <div className="wc26-live-card__watermark" aria-hidden="true" />
    </article>
  )
}
