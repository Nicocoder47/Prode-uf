import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flame, Medal, Target } from 'lucide-react'
import { MOTION } from '../../constants/design'
import { groupColor, WC26_GROUP_NAMES } from '../../constants/groups'
import type { Match } from '../../types/worldcup'
import type { Achievement, GroupProgress, StreakInfo } from '../../utils/predictionProgress'
import { MAX_POINTS_PER_MATCH } from '../../utils/predictionProgress'
import { TeamCrest } from './TeamCrest'

type HomeContinuePredictingProps = {
  groups: GroupProgress[]
  matches: Match[]
  predictionSet: Set<string>
  predicted: number
  total: number
  remainingPoints: number
}

const GROUP_CARD_WIDTH = 88

export function HomeContinuePredicting({
  groups,
  predicted,
  total,
  remainingPoints,
}: HomeContinuePredictingProps) {
  const knownIds = new Set(groups.map(g => g.groupId))
  const carouselGroups = WC26_GROUP_NAMES.filter(id => knownIds.has(id))
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  if (carouselGroups.length === 0 && total <= 0) return null

  const handleScroll = () => {
    const track = trackRef.current
    if (!track) return
    const cardWidth = GROUP_CARD_WIDTH + 10
    const index = Math.round(track.scrollLeft / cardWidth)
    if (index !== active) setActive(Math.min(index, carouselGroups.length - 1))
  }

  return (
    <section className="wc26-predictions-groups mb-5">
      <div className="wc26-predictions-groups__header">
        <p className="wc26-section-title !mb-1">Tus predicciones</p>
        <p className="wc26-predictions-groups__sub">Fase de grupos</p>
      </div>

      {carouselGroups.length > 0 && (
        <>
          <div ref={trackRef} onScroll={handleScroll} className="wc26-group-carousel wc26-group-carousel--centered">
            {carouselGroups.map(groupId => {
              const color = groupColor(groupId)

              return (
                <motion.div key={groupId} {...MOTION.enter} className="wc26-group-carousel__item">
                  <Link
                    to={`/matches?group=${groupId}`}
                    className="wc26-group-slide wc26-group-slide--letter-only"
                    style={{ '--group-color': color } as React.CSSProperties}
                  >
                    <span className="wc26-group-slide__badge">Grupo</span>
                    <p className="wc26-group-slide__letter">{groupId}</p>
                  </Link>
                </motion.div>
              )
            })}
          </div>

          {carouselGroups.length > 1 && (
            <div className="wc26-group-carousel__dots">
              {carouselGroups.map((groupId, i) => (
                <span key={groupId} className={`wc26-carousel-dot ${i === active ? 'is-active' : ''}`} />
              ))}
            </div>
          )}
        </>
      )}

      <HomeGlobalProgressBar
        predicted={predicted}
        total={total}
        remainingPoints={remainingPoints}
        nested
      />
    </section>
  )
}

export function HomePersonalRank({
  rank,
  points,
  totalPlayers,
}: {
  rank: number | null
  points: number
  totalPlayers: number
}) {
  if (rank == null && totalPlayers === 0) return null

  return (
    <motion.section {...MOTION.enter} className="mb-5">
      <Link to="/leaderboard" className="wc26-rank-snippet block">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-wc26-gold to-amber-600 text-lg font-black text-[#1a1200] shadow-lg">
            #{rank ?? '—'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/50">Tu posición</p>
            <p className="text-base font-extrabold text-white">{points} puntos</p>
            {totalPlayers > 0 && (
              <p className="text-xs text-white/55">
                de {totalPlayers} jugador{totalPlayers === 1 ? '' : 'es'}
              </p>
            )}
          </div>
          <Target className="h-5 w-5 shrink-0 text-wc26-yellow" />
        </div>
      </Link>
    </motion.section>
  )
}

export function HomeGlobalProgressBar({
  predicted,
  total,
  remainingPoints,
  nested = false,
}: {
  predicted: number
  total: number
  remainingPoints: number
  nested?: boolean
}) {
  if (total <= 0) return null
  const pct = Math.round((predicted / total) * 100)
  return (
    <div className={`wc26-world-progress text-center ${nested ? 'wc26-world-progress--nested' : 'mb-5'}`}>
      <div className="mb-2 flex items-center justify-center gap-3">
        <p className="text-xs font-extrabold uppercase tracking-wider text-white/60">Progreso mundial</p>
        <p className="text-xs font-black text-wc26-yellow">{pct}%</p>
      </div>
      <p className="mb-3 text-sm font-bold text-white">
        {total} partidos · {predicted} completados
      </p>
      <div className="mx-auto mb-2 h-2 max-w-xs overflow-hidden rounded-full bg-white/10">
        <div
          className="wc26-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] font-semibold text-white/55">
        Hasta {remainingPoints} pts posibles en partidos abiertos ({MAX_POINTS_PER_MATCH} pts c/u)
      </p>
    </div>
  )
}

export function HomeGamificationPanel({
  achievements,
  streaks,
}: {
  achievements: Achievement[]
  streaks: StreakInfo
}) {
  const unlocked = achievements.filter(a => a.unlocked)
  if (unlocked.length === 0 && streaks.predictionStreak < 3 && streaks.dayStreak < 3) return null

  return (
    <section className="mb-5 space-y-3">
      {(streaks.predictionStreak >= 3 || streaks.dayStreak >= 3) && (
        <div className="wc26-streak-card">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-400" />
            <p className="text-sm font-extrabold text-white">Rachas activas</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
            {streaks.predictionStreak >= 3 && (
              <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-orange-200">
                {streaks.predictionStreak} predicciones seguidas
              </span>
            )}
            {streaks.dayStreak >= 3 && (
              <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-sky-200">
                {streaks.dayStreak} días seguidos
              </span>
            )}
          </div>
        </div>
      )}

      {unlocked.length > 0 && (
        <div className="wc26-achievements-card">
          <div className="mb-2 flex items-center gap-2">
            <Medal className="h-4 w-4 text-wc26-yellow" />
            <p className="text-xs font-extrabold uppercase tracking-wider text-white/60">Logros</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unlocked.map(a => (
              <span
                key={a.id}
                className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-extrabold text-amber-100"
              >
                {a.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function GroupTeamFlags({
  teams,
  premium = false,
  compact = false,
}: {
  teams: { flag?: string | null; code?: string; name?: string }[]
  premium?: boolean
  compact?: boolean
}) {
  if (teams.length === 0) return null

  if (compact) {
    return (
      <div className="wc26-fixture-teams-grid">
        {teams.slice(0, 4).map(team => (
          <div key={team.code ?? team.name} className="wc26-fixture-team-row">
            <span className="wc26-fixture-team-row__flag">
              <TeamCrest flag={team.flag} code={team.code} name={team.name} size="xs" premium={premium} />
            </span>
            <span className="wc26-fixture-team-row__name">{team.name || team.code}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="wc26-fixture-teams-list">
      {teams.slice(0, 4).map(team => (
        <div key={team.code ?? team.name} className="wc26-fixture-team-row">
          <span className="wc26-fixture-team-row__flag">
            <TeamCrest flag={team.flag} code={team.code} name={team.name} size="sm" premium={premium} />
          </span>
          <span className="wc26-fixture-team-row__name">{team.name || team.code}</span>
        </div>
      ))}
    </div>
  )
}
