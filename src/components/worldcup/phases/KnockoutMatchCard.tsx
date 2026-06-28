import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Calendar, MapPin, Clock, Check, Lock } from 'lucide-react'
import { TeamCrest } from '../TeamCrest'
import type { Match, Prediction } from '../../../types/worldcup'

interface KnockoutMatchCardProps {
  match: Match
  prediction?: Prediction | null
  onPredict: (match: Match) => void
}

function useCountdown(kickoff: string) {
  return useMemo(() => {
    const diff = new Date(kickoff).getTime() - Date.now()
    if (diff <= 0) return null
    const days = Math.floor(diff / 86_400_000)
    const hours = Math.floor((diff % 86_400_000) / 3_600_000)
    const minutes = Math.floor((diff % 3_600_000) / 60_000)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }, [kickoff])
}

export function KnockoutMatchCard({ match, prediction, onPredict }: KnockoutMatchCardProps) {
  const countdown = useCountdown(match.kickoff)
  const home = match.homeTeam
  const away = match.awayTeam
  const isTbd = !home || !away ||
    home.code?.toUpperCase() === 'TBD' ||
    away.code?.toUpperCase() === 'TBD'

  const isAvailable = match.status === 'scheduled' && !match.isLocked && !isTbd
  const isPredicted = !!prediction
  const isFinished = match.status === 'finished'
  const isLocked = match.isLocked || (match.status === 'scheduled' && new Date(match.kickoff) <= new Date())

  const statusLabel = isFinished
    ? 'Finalizado'
    : isPredicted
      ? 'Predicho'
      : isLocked
        ? 'Bloqueado'
        : isTbd
          ? 'Por definir'
          : 'Disponible'

  const statusClass = isFinished
    ? 'wc26-ko-card__status--finished'
    : isPredicted
      ? 'wc26-ko-card__status--predicted'
      : isLocked
        ? 'wc26-ko-card__status--locked'
        : isTbd
          ? 'wc26-ko-card__status--tbd'
          : 'wc26-ko-card__status--available'

  return (
    <motion.div
      className="wc26-ko-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`wc26-ko-card__status ${statusClass}`}>
        {isPredicted && <Check className="h-3 w-3" />}
        {isLocked && !isFinished && !isPredicted && <Lock className="h-3 w-3" />}
        {statusLabel}
      </div>

      <div className="wc26-ko-card__teams">
        <div className="wc26-ko-card__team">
          {home && !isTbd ? (
            <>
              <TeamCrest flag={home.flag} code={home.code} name={home.name} size="lg" />
              <span className="wc26-ko-card__team-name">{home.name || home.code}</span>
            </>
          ) : (
            <>
              <div className="wc26-ko-card__tbd-crest" />
              <span className="wc26-ko-card__team-name wc26-ko-card__team-name--tbd">Por definir</span>
            </>
          )}
          {isFinished && match.homeScore != null && (
            <span className="wc26-ko-card__score">{match.homeScore}</span>
          )}
        </div>

        <div className="wc26-ko-card__vs">
          {isFinished ? (
            <span className="text-[10px] font-bold text-white/40">FT</span>
          ) : countdown ? (
            <span className="wc26-ko-card__countdown">{countdown}</span>
          ) : (
            <span className="text-xs font-bold text-white/50">VS</span>
          )}
        </div>

        <div className="wc26-ko-card__team">
          {away && !isTbd ? (
            <>
              <TeamCrest flag={away.flag} code={away.code} name={away.name} size="lg" />
              <span className="wc26-ko-card__team-name">{away.name || away.code}</span>
            </>
          ) : (
            <>
              <div className="wc26-ko-card__tbd-crest" />
              <span className="wc26-ko-card__team-name wc26-ko-card__team-name--tbd">Por definir</span>
            </>
          )}
          {isFinished && match.awayScore != null && (
            <span className="wc26-ko-card__score">{match.awayScore}</span>
          )}
        </div>
      </div>

      <div className="wc26-ko-card__info">
        <span className="wc26-ko-card__info-item">
          <Calendar className="h-3 w-3" />
          {new Date(match.kickoff).toLocaleDateString('es-AR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </span>
        {match.stadium && (
          <span className="wc26-ko-card__info-item">
            <MapPin className="h-3 w-3" />
            {match.stadium}
          </span>
        )}
        {countdown && (
          <span className="wc26-ko-card__info-item wc26-ko-card__info-item--countdown">
            <Clock className="h-3 w-3" />
            {countdown}
          </span>
        )}
      </div>

      {isAvailable && !isPredicted && (
        <button
          type="button"
          onClick={() => onPredict(match)}
          className="wc26-ko-card__predict-btn"
        >
          Predecir
        </button>
      )}

      {isAvailable && isPredicted && (
        <button
          type="button"
          onClick={() => onPredict(match)}
          className="wc26-ko-card__predict-btn wc26-ko-card__predict-btn--edit"
        >
          Editar predicción
        </button>
      )}
    </motion.div>
  )
}
