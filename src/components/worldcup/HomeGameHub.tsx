import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Medal } from 'lucide-react'
import { groupColor, WC26_GROUP_NAMES } from '../../constants/groups'
import type { Achievement, GroupProgress, StreakInfo } from '../../utils/predictionProgress'
import { TeamCrest } from './TeamCrest'

type HomeContinuePredictingProps = {
  groups: GroupProgress[]
  total: number
}

const GROUP_CARD_WIDTH = 88

export function HomeContinuePredicting({
  groups,
  total,
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
    <section className="wc26-predictions-groups wc26-deferred-section mb-5">
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
                <div key={groupId} className="wc26-group-carousel__item">
                  <Link
                    to={`/matches?group=${groupId}`}
                    className="wc26-group-slide wc26-group-slide--letter-only"
                    style={{ '--group-color': color } as React.CSSProperties}
                  >
                    <span className="wc26-group-slide__badge">Grupo</span>
                    <p className="wc26-group-slide__letter">{groupId}</p>
                  </Link>
                </div>
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

    </section>
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
    <section className="wc26-deferred-section mb-5 space-y-3">
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
