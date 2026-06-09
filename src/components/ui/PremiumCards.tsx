import { motion } from 'framer-motion'
import clsx from 'clsx'

interface MatchCardProps {
  homeTeam: string
  awayTeam: string
  homeScore?: number
  awayScore?: number
  time: string
  status: 'open' | 'live' | 'locking' | 'finished'
  stadium?: string
  homeFlag?: string
  awayFlag?: string
  userPrediction?: string
  isSelected?: boolean
  onClick?: () => void
}

export function MatchCard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  time,
  status,
  stadium,
  homeFlag,
  awayFlag,
  userPrediction,
  isSelected,
  onClick,
}: MatchCardProps) {
  const statusColor = {
    open: 'border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.05)]',
    live: 'border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.10)] shadow-[0_0_40px_rgba(239,68,68,0.18)]',
    locking: 'border-[rgba(245,196,81,0.30)] bg-[rgba(245,196,81,0.10)]',
    finished: 'border-[rgba(148,163,184,0.18)] bg-white/[0.04]',
  }

  const statusLabel = {
    open: 'PRÓXIMO',
    live: 'LIVE',
    locking: 'CIERRE',
    finished: 'FINAL',
  }

  return (
    <motion.div
      whileHover={status !== 'finished' ? { y: -6 } : {}}
      onClick={onClick}
      className={clsx(
        'group cursor-pointer rounded-[28px] border p-5 backdrop-blur-xl transition-all duration-300',
        statusColor[status],
        isSelected && 'ring-2 ring-cyan-400',
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Teams */}
        <div className="flex flex-1 items-center justify-center gap-3 text-center">
          <div className="space-y-1">
            <div className="text-2xl">{homeFlag || '🏟️'}</div>
            <p className="text-sm font-semibold text-white">{homeTeam}</p>
          </div>
          <div className="space-y-1">
            {homeScore !== undefined && awayScore !== undefined ? (
              <motion.div
                className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2 text-2xl font-black text-white"
                animate={status === 'live' ? { scale: [1, 1.04, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {homeScore} - {awayScore}
              </motion.div>
            ) : (
              <p className="text-sm uppercase tracking-[0.35em] text-slate-400">VS</p>
            )}
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{time}</p>
          </div>
          <div className="space-y-1">
            <div className="text-2xl">{awayFlag || '⚽'}</div>
            <p className="text-sm font-semibold text-white">{awayTeam}</p>
          </div>
        </div>

        {/* Prediction status */}
        <div className="flex flex-col items-end gap-2">
          <span
            className={clsx(
              'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase',
              status === 'live'
                ? 'animate-pulse bg-red-500/20 text-red-300'
                : status === 'finished'
                  ? 'bg-slate-700/20 text-slate-300'
                  : 'bg-cyan-500/10 text-cyan-200',
            )}
          >
            {statusLabel[status]}
          </span>
          {userPrediction ? (
            <span className="text-xs font-semibold text-emerald-300">✓ Predicho</span>
          ) : status === 'open' ? (
            <span className="text-xs text-slate-400">Sin predecir</span>
          ) : null}
        </div>
      </div>

      {stadium ? (
        <p className="mt-3 text-xs text-slate-400">📍 {stadium}</p>
      ) : null}
    </motion.div>
  )
}

interface PlayerCardProps {
  name: string
  position: string
  photo?: string
  number?: number
  rating?: number
  goals?: number
  assists?: number
  marketValue?: string
  isSelected?: boolean
  onClick?: () => void
}

export function PlayerCard({
  name,
  position,
  photo,
  number,
  rating,
  goals,
  assists,
  marketValue,
  isSelected,
  onClick,
}: PlayerCardProps) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      onClick={onClick}
      className={clsx(
        'group cursor-pointer rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-all duration-300',
        isSelected && 'border-cyan-400 bg-cyan-500/10 shadow-glow-cyan',
      )}
    >
      <div className="space-y-3">
        {/* Photo / Avatar */}
        <div className="relative h-32 w-full overflow-hidden rounded-[16px] bg-white/[0.04]">
          {photo ? (
            <img src={photo} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-4xl font-bold text-slate-700">
              {number || '👤'}
            </div>
          )}
          {isSelected && (
            <div className="absolute inset-0 flex items-center justify-center bg-cyan-500/30 backdrop-blur-sm">
              <span className="text-3xl">✓</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="font-bold text-white">{name}</p>
          <p className="text-xs text-slate-400">{position}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {rating ? (
            <div className="rounded-lg bg-white/[0.05] px-2 py-1 text-center">
              <p className="text-xs text-slate-400">Rating</p>
              <p className="text-sm font-semibold text-yellow-300">{rating.toFixed(1)}⭐</p>
            </div>
          ) : null}
          {goals !== undefined ? (
            <div className="rounded-lg bg-white/[0.05] px-2 py-1 text-center">
              <p className="text-xs text-slate-400">Goles</p>
              <p className="text-sm font-semibold text-emerald-300">⚽{goals}</p>
            </div>
          ) : null}
          {assists !== undefined ? (
            <div className="rounded-lg bg-white/[0.05] px-2 py-1 text-center">
              <p className="text-xs text-slate-400">Asist</p>
              <p className="text-sm font-semibold text-blue-300">{assists}</p>
            </div>
          ) : null}
        </div>

        {marketValue ? (
          <p className="text-center text-xs text-slate-400">💰 {marketValue}</p>
        ) : null}
      </div>
    </motion.div>
  )
}

interface LeaderboardRowProps {
  rank: number
  name: string
  points: number
  change?: number
  isCurrentUser?: boolean
  streak?: number
  prize?: string
}

export function LeaderboardRow({
  rank,
  name,
  points,
  change,
  isCurrentUser,
  streak,
  prize,
}: LeaderboardRowProps) {
  const getMedalIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return null
  }

  return (
    <motion.div
      layout
      className={clsx(
        'rounded-[24px] border p-4 backdrop-blur-xl transition-all duration-300',
        isCurrentUser
          ? 'border-[rgba(6,182,212,0.45)] bg-[rgba(6,182,212,0.10)] shadow-[0_0_40px_rgba(6,182,212,0.20)]'
          : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] hover:border-white/20',
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] text-lg font-bold">
            {getMedalIcon(rank) || <span className="text-sm text-slate-400">#{rank}</span>}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">{name}</p>
            {streak ? (
              <p className="flex items-center gap-1 text-xs text-emerald-300">
                🔥 {streak} racha
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-lg font-bold text-cyan-200">{points.toLocaleString()}</p>
            <p className="text-xs text-slate-400">puntos</p>
          </div>
          {change ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={clsx(
                'rounded-full px-3 py-1 text-sm font-semibold',
                change > 0
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : change < 0
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-slate-700/20 text-slate-300',
              )}
            >
              {change > 0 ? '↑' : change < 0 ? '↓' : '='} {Math.abs(change)}
            </motion.div>
          ) : null}
          {prize ? (
            <div className="rounded-full bg-amber-500/20 px-3 py-1 text-sm font-semibold text-amber-300">
              {prize}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}
