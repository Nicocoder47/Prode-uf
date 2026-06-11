import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { TeamCrest } from './TeamCrest'
import { formatCountdownLabel, type WorldCupLiveInsightPayload } from '../../utils/worldCupLiveInsights'
import type { Match } from '../../types/worldcup'
import { teamDisplayName } from '../../utils/teamDisplay'

type LiveInsightCardProps = {
  card: WorldCupLiveInsightPayload
  active?: boolean
  onPredict?: (match: Match) => void
  className?: string
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
        <TeamCrest flag={match.homeTeam.flag} code={match.homeTeam.code} size="md" />
        <span>{match.homeTeam.name}</span>
      </div>
      <span className="wc26-live-card__vs">vs</span>
      <div className="wc26-live-card__team">
        <TeamCrest flag={match.awayTeam.flag} code={match.awayTeam.code} size="md" />
        <span>{match.awayTeam.name}</span>
      </div>
    </div>
  )
}

function TrendBars({
  homeLabel,
  awayLabel,
  homePct,
  drawPct,
  awayPct,
}: {
  homeLabel: string
  awayLabel: string
  homePct: number
  drawPct: number
  awayPct: number
}) {
  return (
    <div className="wc26-live-card__bars">
      <div className="wc26-live-card__bar-row">
        <span>{homeLabel}</span>
        <div className="wc26-live-card__bar">
          <motion.div
            className="wc26-live-card__bar-fill wc26-live-card__bar-fill--home"
            initial={{ width: 0 }}
            animate={{ width: `${homePct}%` }}
            transition={{ duration: 0.45 }}
          />
        </div>
        <strong>{homePct}%</strong>
      </div>
      <div className="wc26-live-card__bar-row">
        <span>Empate</span>
        <div className="wc26-live-card__bar">
          <motion.div
            className="wc26-live-card__bar-fill wc26-live-card__bar-fill--draw"
            initial={{ width: 0 }}
            animate={{ width: `${drawPct}%` }}
            transition={{ duration: 0.45, delay: 0.04 }}
          />
        </div>
        <strong>{drawPct}%</strong>
      </div>
      <div className="wc26-live-card__bar-row">
        <span>{awayLabel}</span>
        <div className="wc26-live-card__bar">
          <motion.div
            className="wc26-live-card__bar-fill wc26-live-card__bar-fill--away"
            initial={{ width: 0 }}
            animate={{ width: `${awayPct}%` }}
            transition={{ duration: 0.45, delay: 0.08 }}
          />
        </div>
        <strong>{awayPct}%</strong>
      </div>
    </div>
  )
}

const TODAY_MATCHES_LIMIT = 4

function TodayMatchesList({ matches, featuredId }: { matches: Match[]; featuredId: string }) {
  if (matches.length === 0) return null

  const visible = matches.slice(0, TODAY_MATCHES_LIMIT)
  const hiddenCount = Math.max(0, matches.length - TODAY_MATCHES_LIMIT)

  return (
    <div className="wc26-live-card__today">
      <p className="wc26-live-card__today-title">Partidos de hoy</p>
      <ul className="wc26-live-card__today-list">
        {visible.map(match => {
          const home = match.homeTeam!
          const away = match.awayTeam!
          const kickoff = fmtKickoff(match.kickoff)
          const isFeatured = match.id === featuredId
          const isLive = match.status === 'live' || match.status === 'halftime'
          const isFinished = match.status === 'finished'
          const hasScore = isFinished || isLive

          return (
            <li
              key={match.id}
              className={`wc26-live-card__today-row${isFeatured ? ' wc26-live-card__today-row--featured' : ''}`}
            >
              <span className="wc26-live-card__today-time">{kickoff.time}</span>
              <div className="wc26-live-card__today-teams">
                <span className="wc26-live-card__today-team">
                  <TeamCrest flag={home.flag} code={home.code} size="xs" />
                  <span>{teamDisplayName(home)}</span>
                </span>
                <span
                  className={`wc26-live-card__today-score${hasScore ? ' wc26-live-card__today-score--set' : ''}${isLive ? ' wc26-live-card__today-score--live' : ''}`}
                >
                  {hasScore ? `${match.homeScore ?? 0}-${match.awayScore ?? 0}` : '—'}
                </span>
                <span className="wc26-live-card__today-team">
                  <span>{teamDisplayName(away)}</span>
                  <TeamCrest flag={away.flag} code={away.code} size="xs" />
                </span>
              </div>
              <span
                className={`wc26-live-card__today-status${isLive ? ' is-live' : ''}${isFinished ? ' is-finished' : ''}`}
              >
                {isLive ? 'Vivo' : isFinished ? 'Fin' : kickoff.time}
              </span>
            </li>
          )
        })}
      </ul>
      {hiddenCount > 0 ? (
        <p className="wc26-live-card__today-more">+{hiddenCount} partido{hiddenCount === 1 ? '' : 's'} más hoy</p>
      ) : null}
    </div>
  )
}

function NextMatchCardBody({
  card,
  onAction,
}: {
  card: Extract<WorldCupLiveInsightPayload, { type: 'next_match' }>
  onAction: (card: WorldCupLiveInsightPayload) => void
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [card.match.id, card.match.kickoff])

  const { time, date } = fmtKickoff(card.match.kickoff)
  const isLive = card.match.status === 'live' || card.match.status === 'halftime'
  const highlight = isLive ? 'En vivo' : formatCountdownLabel(card.match.kickoff, now)

  return (
    <>
      <MatchFlags match={card.match} />
      <p className="wc26-live-card__highlight">{highlight}</p>
      <p className="wc26-live-card__meta">
        {time} · {date}
      </p>
      <TodayMatchesList matches={card.todayMatches} featuredId={card.match.id} />
      {card.cta ? (
        <button type="button" className="wc26-live-card__cta" onClick={() => onAction(card)}>
          {card.cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
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
    case 'next_match':
      return <NextMatchCardBody card={card} onAction={onAction} />
    case 'community_trend': {
      const home = card.match.homeTeam?.name?.split(' ').pop() ?? 'Local'
      const away = card.match.awayTeam?.name?.split(' ').pop() ?? 'Visitante'
      return (
        <>
          <p className="wc26-live-card__highlight">{card.favoriteLabel}</p>
          {card.hasEnoughData ? (
            <TrendBars
              homeLabel={home}
              awayLabel={away}
              homePct={card.homePct}
              drawPct={card.drawPct}
              awayPct={card.awayPct}
            />
          ) : null}
        </>
      )
    }
    case 'ranking_move':
      return (
        <>
          {card.lines.length > 0 ? (
            <ul className="wc26-live-card__lines wc26-live-card__lines--compact">
              {card.lines.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <div className="wc26-live-card__ranking-podium">
            {card.leader ? (
              <div className="wc26-live-card__ranking-spot wc26-live-card__ranking-spot--leader">
                <span className="wc26-live-card__ranking-pos">1°</span>
                <p className="wc26-live-card__ranking-name">{card.leader.name}</p>
                <p className="wc26-live-card__ranking-legajo">Legajo {card.leader.legajo}</p>
                <p className="wc26-live-card__ranking-pts">{card.leader.points} pts</p>
              </div>
            ) : (
              <p className="wc26-live-card__ranking-empty">Esperando movimientos</p>
            )}
            {card.runnerUp ? (
              <div className="wc26-live-card__ranking-spot wc26-live-card__ranking-spot--second">
                <span className="wc26-live-card__ranking-pos">2°</span>
                <p className="wc26-live-card__ranking-name">{card.runnerUp.name}</p>
                <p className="wc26-live-card__ranking-legajo">Legajo {card.runnerUp.legajo}</p>
                <p className="wc26-live-card__ranking-pts">{card.runnerUp.points} pts</p>
              </div>
            ) : null}
          </div>
          {card.cta ? (
            <button type="button" className="wc26-live-card__cta" onClick={() => onAction(card)}>
              {card.cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </>
      )
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
          {card.scorers.map((s, i) => (
            <li key={`${s.name}-${i}`}>
              <span className="wc26-live-card__scorer-rank">{i + 1}</span>
              <span className="wc26-live-card__scorer-name">{s.name}</span>
              <span className="wc26-live-card__scorer-goals">{s.goals}G</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="wc26-live-card__highlight">{card.emptyMessage ?? 'El torneo todavía no comenzó'}</p>
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

  const handleAction = (c: WorldCupLiveInsightPayload) => {
    if (c.cta?.action === 'predict' && c.type === 'next_match') {
      onPredict?.(c.match)
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
    navigate('/matches')
  }

  const typeClass = `wc26-live-card--${card.type}`

  return (
    <article
      className={`wc26-live-card${active ? ' wc26-live-card--active' : ''} ${typeClass}${className ? ` ${className}` : ''}`}
    >
      <div className="wc26-live-card__inner">
        <p className="wc26-live-card__kicker">
          <span aria-hidden="true">{card.emoji}</span> {card.title}
        </p>
        {card.subtitle && card.type !== 'community_trend' ? (
          <p className="wc26-live-card__subtitle">{card.subtitle}</p>
        ) : null}
        <CardBody card={card} onAction={handleAction} />
      </div>
      <div className="wc26-live-card__watermark" aria-hidden="true" />
    </article>
  )
}
