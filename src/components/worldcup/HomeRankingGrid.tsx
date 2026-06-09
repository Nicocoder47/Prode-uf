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

function splitName(fullName?: string) {
  const parts = (fullName ?? 'Jugador').trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first: parts[0] ?? 'Jugador', last: '—' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
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
    (entry): entry is LeaderboardEntry => entry != null
  )

  return (
    <motion.section {...MOTION.enter} className="wc26-home-ranking mb-5">
      <div className="wc26-home-ranking__header">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#F8B91E]" />
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
                const { first, last } = splitName(entry.profile?.fullName)
                const tone = rankTone(entry.rank)
                const isMe = entry.userId === currentUserId

                return (
                  <motion.div
                    key={entry.userId}
                    variants={MOTION.enterScale}
                    className={`wc26-home-ranking__podium-card wc26-home-ranking__podium-card--${tone}${isMe ? ' is-me' : ''}`}
                  >
                    <span className="wc26-home-ranking__podium-rank">
                      {entry.rank === 1 ? <Crown className="h-4 w-4" /> : null}#{entry.rank}
                    </span>
                    <p className="wc26-home-ranking__podium-name">{first}</p>
                    <p className="wc26-home-ranking__podium-last">{last}</p>
                    <p className="wc26-home-ranking__podium-legajo">{entry.profile?.legajo ?? '—'}</p>
                    <p className="wc26-home-ranking__podium-points">{entry.points} pts</p>
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          <div className="wc26-home-ranking__panel">
            <div className="wc26-home-ranking__grid wc26-home-ranking__grid--head">
              <span>#</span>
              <span>Nombre</span>
              <span>Apellido</span>
              <span>Legajo</span>
              <span>Pts</span>
            </div>

            <div className="wc26-home-ranking__body">
              {rows.map(entry => {
                const { first, last } = splitName(entry.profile?.fullName)
                const isMe = entry.userId === currentUserId
                const tone = rankTone(entry.rank)

                return (
                  <div
                    key={entry.userId}
                    className={`wc26-home-ranking__grid wc26-home-ranking__row wc26-home-ranking__row--${tone}${isMe ? ' is-me' : ''}`}
                  >
                    <span className="wc26-home-ranking__pos">#{entry.rank}</span>
                    <span className="wc26-home-ranking__first">{first}</span>
                    <span className="wc26-home-ranking__last">{last}</span>
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
