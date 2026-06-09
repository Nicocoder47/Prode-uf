import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { MOTION } from '../../constants/design'
import { TeamCrest } from './TeamCrest'
import type { WorldCupLiveInsightPayload } from '../../utils/worldCupLiveInsights'
import type { Match } from '../../types/worldcup'

type WorldCupLiveCarouselProps = {
  cards: WorldCupLiveInsightPayload[]
  onPredict?: (match: Match) => void
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

function CardBody({
  card,
  onAction,
}: {
  card: WorldCupLiveInsightPayload
  onAction: (card: WorldCupLiveInsightPayload) => void
}) {
  switch (card.type) {
    case 'next_match': {
      const { time, date } = fmtKickoff(card.match.kickoff)
      return (
        <>
          <MatchFlags match={card.match} />
          <p className="wc26-live-card__highlight">{card.countdownLabel}</p>
          <p className="wc26-live-card__meta">
            {time} · {date}
          </p>
          {card.cta ? (
            <button type="button" className="wc26-live-card__cta" onClick={() => onAction(card)}>
              {card.cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </>
      )
    }
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
          <ul className="wc26-live-card__lines">
            {card.lines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
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

export function WorldCupLiveCarousel({ cards, onPredict }: WorldCupLiveCarouselProps) {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const pauseRef = useRef(false)

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollRef.current
      if (!el) return
      const child = el.children[index] as HTMLElement | undefined
      child?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
      setActive(index)
    },
    [reduceMotion],
  )

  useEffect(() => {
    if (cards.length <= 1 || reduceMotion) return
    const id = window.setInterval(() => {
      if (pauseRef.current) return
      setActive(prev => {
        const next = (prev + 1) % cards.length
        scrollToIndex(next)
        return next
      })
    }, 5500)
    return () => window.clearInterval(id)
  }, [cards.length, reduceMotion, scrollToIndex])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el || el.children.length === 0) return
    const center = el.scrollLeft + el.clientWidth / 2
    let closest = 0
    let minDist = Infinity
    Array.from(el.children).forEach((child, i) => {
      const node = child as HTMLElement
      const childCenter = node.offsetLeft + node.offsetWidth / 2
      const dist = Math.abs(center - childCenter)
      if (dist < minDist) {
        minDist = dist
        closest = i
      }
    })
    setActive(closest)
  }

  const handleAction = (card: WorldCupLiveInsightPayload) => {
    if (card.cta?.action === 'predict' && card.type === 'next_match') {
      onPredict?.(card.match)
      return
    }
    if (card.cta?.action === 'leaderboard') {
      navigate('/leaderboard')
      return
    }
    if (card.cta?.action === 'login') {
      navigate('/login')
      return
    }
    navigate('/matches')
  }

  if (cards.length === 0) return null

  return (
    <motion.section {...MOTION.enter} className="wc26-live-carousel mb-5">
      <div className="wc26-live-carousel__head">
        <div>
          <p className="wc26-live-carousel__title">🔥 MUNDIAL EN VIVO</p>
          <p className="wc26-live-carousel__sub">Datos reales · se actualiza cada 30 min</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="wc26-live-carousel__track"
        onScroll={handleScroll}
        onTouchStart={() => {
          pauseRef.current = true
        }}
        onTouchEnd={() => {
          window.setTimeout(() => {
            pauseRef.current = false
          }, 4000)
        }}
        onMouseEnter={() => {
          pauseRef.current = true
        }}
        onMouseLeave={() => {
          pauseRef.current = false
        }}
      >
        {cards.map((card, index) => (
          <article
            key={card.id}
            className={`wc26-live-card${index === active ? ' wc26-live-card--active' : ''}`}
          >
            <p className="wc26-live-card__kicker">
              <span aria-hidden="true">{card.emoji}</span> {card.title}
            </p>
            {card.subtitle && card.type !== 'community_trend' ? (
              <p className="wc26-live-card__subtitle">{card.subtitle}</p>
            ) : null}
            <CardBody card={card} onAction={handleAction} />
          </article>
        ))}
      </div>

      <div className="wc26-live-carousel__dots" aria-hidden="true">
        {cards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            className={`wc26-live-carousel__dot${i === active ? ' wc26-live-carousel__dot--active' : ''}`}
            onClick={() => scrollToIndex(i)}
            aria-label={`Tarjeta ${i + 1}`}
          />
        ))}
      </div>
    </motion.section>
  )
}
