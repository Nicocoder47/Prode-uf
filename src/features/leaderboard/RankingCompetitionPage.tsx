import { Link } from 'react-router-dom'
import { AdaptiveDiv } from '../../utils/adaptiveMotion'
import { Crown, Trophy, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useLeaderboard } from '../../useWorldCupData'
import { MOTION } from '../../constants/design'
import type { LeaderboardEntry } from '../../types/worldcup'
import { formatRankMovement } from '../../utils/leaderboardMovement'
import { useLeaderboardMovements } from '../../hooks/useLeaderboardMovements'

const TOP_N = 25
const PODIUM_ORDER = [2, 1, 3] as const

function displayName(entry: LeaderboardEntry): string {
  return entry.profile?.fullName?.trim() || `Jugador #${entry.rank}`
}

function rankTone(rank: number) {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return 'default'
}

function MovementBadge({ delta }: { delta: number | null | undefined }) {
  if (delta == null) {
    return (
      <span className="wc26-ranking-board__move wc26-ranking-board__move--new" title="Nuevo en el ranking">
        NEW
      </span>
    )
  }
  if (delta > 0) {
    return (
      <span className="wc26-ranking-board__move wc26-ranking-board__move--up">
        <TrendingUp className="h-3 w-3" aria-hidden />
        {formatRankMovement(delta)}
      </span>
    )
  }
  if (delta < 0) {
    return (
      <span className="wc26-ranking-board__move wc26-ranking-board__move--down">
        <TrendingDown className="h-3 w-3" aria-hidden />
        {formatRankMovement(delta)}
      </span>
    )
  }
  return (
    <span className="wc26-ranking-board__move wc26-ranking-board__move--flat">
      <Minus className="h-3 w-3" aria-hidden />
      0
    </span>
  )
}

export default function RankingCompetitionPage() {
  const { user } = useAuth()
  const { data: leaderboard = [], isLoading } = useLeaderboard()

  const movements = useLeaderboardMovements(leaderboard)

  const top25 = leaderboard.slice(0, TOP_N)
  const me = user?.id ? leaderboard.find(e => e.userId === user.id) : undefined
  const leader = leaderboard[0]
  const top3 = PODIUM_ORDER.map(rank => top25.find(e => e.rank === rank)).filter(
    (e): e is LeaderboardEntry => e != null,
  )

  return (
    <div className="wc26-ranking-board space-y-4 pb-4">
      <header className="wc26-ranking-board__header">
        <h1 className="wc26-ranking-board__title">Ranking</h1>
        <p className="wc26-ranking-board__subtitle">Top {TOP_N}</p>
      </header>

      <div className="wc26-ranking-board__stats wc26-ranking-board__stats--duo">
        <div className="wc26-ranking-board__stat">
          <p className="wc26-ranking-board__stat-label">Tu puesto</p>
          <p className="wc26-ranking-board__stat-value wc26-ranking-board__stat-value--gold">
            {me ? `#${me.rank}` : '—'}
          </p>
        </div>
        <div className="wc26-ranking-board__stat">
          <p className="wc26-ranking-board__stat-label">Líder</p>
          <p className="wc26-ranking-board__stat-value wc26-ranking-board__stat-value--green">
            {leader ? `${leader.points} pts` : '—'}
          </p>
        </div>
      </div>

      {me && (
        <Link to="/profile" className="wc26-ranking-board__me-snippet">
          <span className="wc26-ranking-board__me-rank">#{me.rank}</span>
          <div className="min-w-0 flex-1">
            <p className="wc26-ranking-board__me-label">Tu posición</p>
            <p className="wc26-ranking-board__me-name">{displayName(me)}</p>
          </div>
          <div className="text-right">
            <p className="wc26-ranking-board__me-points">{me.points} pts</p>
            <MovementBadge delta={movements.get(me.userId)} />
          </div>
        </Link>
      )}

      {isLoading && (
        <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">Cargando ranking…</p>
      )}

      {!isLoading && top25.length === 0 && (
        <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">
          El ranking se activa cuando se puntúen las primeras predicciones.
        </p>
      )}

      {!isLoading && top3.length > 0 && (
        <AdaptiveDiv
          motionProps={MOTION.enter}
          className="wc26-ranking-board__podium wc26-deferred-section"
          aria-label="Podio top 3"
        >
          {top3.map(entry => {
            const tone = rankTone(entry.rank)
            const isLeader = entry.rank === 1
            return (
              <div
                key={entry.userId}
                className={`wc26-ranking-board__podium-card wc26-ranking-board__podium-card--${tone}`}
              >
                {isLeader ? (
                  <span className="wc26-ranking-board__podium-crown" aria-hidden>
                    <Crown className="h-4 w-4" />
                  </span>
                ) : null}
                <span className="wc26-ranking-board__podium-num">{entry.rank}</span>
                <p className="wc26-ranking-board__podium-name">{displayName(entry)}</p>
                <p className="wc26-ranking-board__podium-pts">{entry.points} pts</p>
                <MovementBadge delta={movements.get(entry.userId)} />
              </div>
            )
          })}
        </AdaptiveDiv>
      )}

      {!isLoading && top25.length > 0 && (
        <div className="wc26-ranking-board__panel wc26-deferred-section">
          <div className="wc26-ranking-board__panel-head">
            <Trophy className="h-4 w-4 text-[#F8B91E]" aria-hidden />
            <span>Tabla de posiciones</span>
          </div>

          <div className="wc26-ranking-board__grid wc26-ranking-board__grid--head">
            <span>#</span>
            <span>Mov</span>
            <span>Jugador</span>
            <span>Pts</span>
          </div>

          <ol className="wc26-ranking-board__list">
            {top25.map(entry => {
              const tone = rankTone(entry.rank)
              const isMe = entry.userId === user?.id
              return (
                <li
                  key={entry.userId}
                  className={`wc26-ranking-board__grid wc26-ranking-board__row wc26-ranking-board__row--${tone}${isMe ? ' is-me' : ''}`}
                >
                  <span className={`wc26-ranking-board__pos${tone !== 'default' ? ` wc26-ranking-board__pos--${tone}` : ''}`}>
                    {entry.rank === 1 ? <Crown className="h-3.5 w-3.5 shrink-0" /> : null}
                    <span className="wc26-ranking-board__pos-num">{entry.rank}</span>
                  </span>
                  <MovementBadge delta={movements.get(entry.userId)} />
                  <div className="wc26-ranking-board__player">
                    <span className="wc26-ranking-board__player-name">{displayName(entry)}</span>
                    <span className="wc26-ranking-board__player-legajo">
                      Leg. {entry.profile?.legajo ?? '—'}
                    </span>
                  </div>
                  <span className="wc26-ranking-board__points">{entry.points}</span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <p className="wc26-ranking-board__footnote text-center text-[11px] text-white/40">
        Movimiento vs. tu última visita o la última actualización del ranking.
      </p>
    </div>
  )
}
