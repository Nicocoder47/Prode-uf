import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Crown, Trophy } from 'lucide-react'
import { MOTION } from '../../constants/design'
import type { LeaderboardEntry } from '../../types/worldcup'

type HomeRankingGridProps = {
  entries: LeaderboardEntry[]
  currentUserId?: string
  isLoading?: boolean
  maxRows?: number
}

const PODIUM_ORDER = [2, 1, 3] as const

const PODIUM_ELITE_LABEL: Record<number, string> = {
  1: 'Líder',
  2: 'Plata',
  3: 'Bronce',
}

function displayName(entry: LeaderboardEntry): string {
  return entry.profile?.fullName?.trim() || `Jugador #${entry.rank}`
}

function rankTone(rank: number) {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return 'default'
}

export function HomeRankingGrid({
  entries,
  currentUserId,
  isLoading = false,
  maxRows = 5,
}: HomeRankingGridProps) {
  const rows = entries.slice(0, maxRows)
  const top3ByRank = new Map(rows.filter(r => (r.rank ?? 0) <= 3).map(entry => [entry.rank, entry]))
  const podiumEntries = PODIUM_ORDER.map(rank => top3ByRank.get(rank)).filter(
    (entry): entry is LeaderboardEntry => entry != null,
  )

  return (
    <motion.section {...MOTION.enter} className="wc26-home-ranking mb-5">
      <div className="wc26-home-ranking__header">
        <div className="flex items-center gap-2.5">
          <span className="wc26-home-ranking__icon" aria-hidden>
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <p className="wc26-home-ranking__kicker">Lo más importante</p>
            <h2 className="wc26-home-ranking__title">Ranking de jugadores</h2>
          </div>
        </div>
        <Link to="/leaderboard" className="wc26-home-ranking__link">
          Ver todo
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="wc26-home-ranking__panel wc26-home-ranking__empty">Cargando ranking…</div>
      ) : rows.length === 0 ? (
        <div className="wc26-home-ranking__panel wc26-home-ranking__empty">
          El ranking aparece cuando se sumen los primeros puntos.
        </div>
      ) : (
        <>
          {podiumEntries.length > 0 && (
            <motion.div
              initial={MOTION.stagger.initial}
              animate={MOTION.stagger.animate}
              className="wc26-home-ranking__podium"
            >
              {podiumEntries.map(entry => {
                const tone = rankTone(entry.rank)
                const isMe = entry.userId === currentUserId
                const name = displayName(entry)
                const isLeader = entry.rank === 1

                return (
                  <motion.div
                    key={entry.userId}
                    variants={MOTION.enterScale}
                    className={`wc26-home-ranking__podium-card wc26-home-ranking__podium-card--${tone}${isMe ? ' is-me' : ''}`}
                  >
                    {isLeader ? (
                      <span className="wc26-home-ranking__podium-crown" aria-hidden>
                        <Crown className="h-5 w-5" strokeWidth={2.2} />
                      </span>
                    ) : null}

                    <div className="wc26-home-ranking__podium-rank-hero">
                      <span className="wc26-home-ranking__podium-rank-num" aria-label={`Puesto ${entry.rank}`}>
                        {entry.rank}
                      </span>
                      <span className="wc26-home-ranking__podium-elite">
                        {PODIUM_ELITE_LABEL[entry.rank] ?? `#${entry.rank}`}
                      </span>
                    </div>

                    <p className="wc26-home-ranking__podium-name" title={name}>
                      {name}
                    </p>
                    <span className="wc26-home-ranking__podium-legajo">
                      Leg. {entry.profile?.legajo ?? '—'}
                    </span>
                    <p className="wc26-home-ranking__podium-points">
                      <strong>{entry.points}</strong>
                      <span>pts</span>
                    </p>
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          <div className="wc26-home-ranking__panel">
            <div className="wc26-home-ranking__grid wc26-home-ranking__grid--head">
              <span>#</span>
              <span>Jugador</span>
              <span>Legajo</span>
              <span>Pts</span>
            </div>

            <div className="wc26-home-ranking__body">
              {rows.map(entry => {
                const isMe = entry.userId === currentUserId
                const tone = rankTone(entry.rank)
                const name = displayName(entry)

                return (
                  <div
                    key={entry.userId}
                    className={`wc26-home-ranking__grid wc26-home-ranking__row wc26-home-ranking__row--${tone}${isMe ? ' is-me' : ''}`}
                  >
                    <span className="wc26-home-ranking__pos">#{entry.rank}</span>
                    <span className="wc26-home-ranking__player-name" title={name}>
                      {name}
                    </span>
                    <span className="wc26-home-ranking__legajo">{entry.profile?.legajo ?? '—'}</span>
                    <span className="wc26-home-ranking__points">{entry.points}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </motion.section>
  )
}
