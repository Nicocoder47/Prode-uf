// World Cup Match Card - For fixture display

import { motion } from 'framer-motion'
import { COLORS } from '../../constants/design'
import type { Match, MatchStatus } from '../../types/worldcup'

interface MatchCardProps {
  match: Match
  onPredictClick?: () => void
  hasPrediction?: boolean
}

const getStatusBadge = (status: MatchStatus) => {
  const badges = {
    scheduled: { label: 'Programado', color: COLORS.lightGray, textColor: '#000' },
    live: { label: '🔴 EN VIVO', color: COLORS.secondary, textColor: '#fff' },
    halftime: { label: 'Descanso', color: COLORS.secondary, textColor: '#fff' },
    finished: { label: 'Finalizado', color: COLORS.darkGray, textColor: '#fff' },
    postponed: { label: 'Pospuesto', color: COLORS.darkGray, textColor: '#fff' },
  }
  return badges[status]
}

const formatTime = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-AR', {
    month: 'short',
    day: 'numeric',
  })
}

export function MatchCard({
  match,
  onPredictClick,
  hasPrediction = false,
}: MatchCardProps) {
  const homeTeam = match.homeTeam
  const awayTeam = match.awayTeam
  const statusBadge = getStatusBadge(match.status)
  const isLive = match.status === 'live' || match.status === 'halftime'
  const isFinished = match.status === 'finished'

  if (!homeTeam || !awayTeam) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!isFinished ? { scale: 1.02 } : {}}
      className="relative overflow-hidden rounded-xl border transition-all"
      style={{
        backgroundColor: COLORS.cardDark,
        borderColor: isLive ? COLORS.secondary : `${COLORS.lightGray}30`,
      }}
    >
      {/* Live pulse background */}
      {isLive && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: `${COLORS.secondary}15` }}
        />
      )}

      <div className="relative z-10 p-4">
        {/* Header with status and date */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="text-xs font-semibold px-2 py-1 rounded-full"
            style={{
              backgroundColor: statusBadge.color,
              color: statusBadge.textColor,
            }}
          >
            {statusBadge.label}
          </span>
          <span className="text-xs text-white/60">
            {formatDate(match.date)} • {formatTime(match.date)}
          </span>
        </div>

        {/* Match content */}
        <div className="flex items-center justify-between gap-3 mb-4">
          {/* Home team */}
          <motion.div className="flex-1 flex flex-col items-center">
            <div className="text-3xl mb-2">{homeTeam.flag}</div>
            <div className="text-sm font-bold text-white text-center">
              {homeTeam.code}
            </div>
          </motion.div>

          {/* Score */}
          <div className="flex flex-col items-center gap-2">
            {isFinished ? (
              <div className="flex items-center gap-2">
                <span
                  className="text-3xl font-bold"
                  style={{ color: COLORS.trophy }}
                >
                  {match.homeScore}
                </span>
                <span className="text-white/40">-</span>
                <span
                  className="text-3xl font-bold"
                  style={{ color: COLORS.trophy }}
                >
                  {match.awayScore}
                </span>
              </div>
            ) : isLive ? (
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">
                  {match.homeScore || '0'} - {match.awayScore || '0'}
                </div>
                <div className="text-xs text-white/60">minuto</div>
              </div>
            ) : (
              <div className="text-center text-white/60">vs</div>
            )}
          </div>

          {/* Away team */}
          <motion.div className="flex-1 flex flex-col items-center">
            <div className="text-3xl mb-2">{awayTeam.flag}</div>
            <div className="text-sm font-bold text-white text-center">
              {awayTeam.code}
            </div>
          </motion.div>
        </div>

        {/* Prediction status */}
        {hasPrediction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 p-2 rounded bg-green-500/20 border border-green-500/40 flex items-center gap-2"
          >
            <span className="text-lg">✓</span>
            <span className="text-xs text-white">Predicción registrada</span>
          </motion.div>
        )}

        {/* Action buttons */}
        {!isFinished && (
          <div className="flex gap-2">
            {onPredictClick && (
              <button
                onClick={onPredictClick}
                className="flex-1 py-2 rounded-lg font-semibold transition-all text-sm"
                style={{
                  backgroundColor: hasPrediction ? `${COLORS.primary}40` : COLORS.primary,
                  color: '#fff',
                  border: hasPrediction ? `1px solid ${COLORS.primary}` : 'none',
                }}
              >
                {hasPrediction ? 'Editar' : 'Predecir'}
              </button>
            )}
            <button
              className="flex-1 py-2 rounded-lg font-semibold transition-all text-sm border"
              style={{
                backgroundColor: 'transparent',
                color: COLORS.lightGray,
                borderColor: `${COLORS.lightGray}40`,
              }}
            >
              Detalles
            </button>
          </div>
        )}

        {isFinished && (
          <button
            className="w-full py-2 rounded-lg font-semibold transition-all text-sm"
            style={{
              backgroundColor: `${COLORS.lightGray}20`,
              color: COLORS.lightGray,
              border: `1px solid ${COLORS.lightGray}40`,
            }}
          >
            Ver resultado
          </button>
        )}
      </div>
    </motion.div>
  )
}
