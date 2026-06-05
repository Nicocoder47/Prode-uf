// Premium Match Card - AAA Quality Design

import { motion } from 'framer-motion'
import type { Match, MatchStatus } from '../../types/worldcup'
import { COLORS } from '../../constants/design'
import { Clock, MapPin, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

interface MatchCardPremiumProps {
  match: Match
  onPredictClick?: () => void
  hasPrediction?: boolean
  isPredicting?: boolean
  featured?: boolean
}

function TeamFlagDisplay({ flag, code }: { flag: string; code: string }) {
  if (flag?.startsWith('http')) {
    return <img src={flag} alt={code} loading="lazy" decoding="async" className="h-12 w-16 object-contain" />
  }
  return <span className="text-5xl">{flag || '🏳️'}</span>
}

const getStatusBadge = (status: MatchStatus) => {
  const badges = {
    scheduled: { label: 'PROGRAMADO', color: COLORS.lightGray, textColor: '#000' },
    live: { label: '● EN VIVO', color: COLORS.secondary, textColor: '#fff' },
    halftime: { label: 'DESCANSO', color: COLORS.secondary, textColor: '#fff' },
    finished: { label: 'FINALIZADO', color: COLORS.darkGray, textColor: '#fff' },
    postponed: { label: 'POSPUESTO', color: COLORS.darkGray, textColor: '#fff' },
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

export function MatchCardPremium({
  match,
  onPredictClick,
  hasPrediction = false,
  isPredicting = false,
  featured = false,
}: MatchCardPremiumProps) {
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
      whileHover={!isFinished ? { scale: 1.01, y: -3 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`wc26-match-premium relative cursor-pointer overflow-hidden ${featured ? 'md:p-2' : ''} ${isLive ? 'ring-1 ring-red-500/40' : ''}`}
    >
      {/* Live pulse background */}
      {isLive && (
        <>
          <motion.div
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: `${COLORS.secondary}15` }}
          />
          <motion.div
            animate={{
              boxShadow: [
                `inset 0 0 0 1px ${COLORS.secondary}80`,
                `inset 0 0 0 2px ${COLORS.secondary}40`,
                `inset 0 0 0 1px ${COLORS.secondary}80`,
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-2xl pointer-events-none"
          />
        </>
      )}

      <div className="relative z-10 p-5 md:p-6 space-y-4">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <motion.span
            className="text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest"
            style={{
              backgroundColor: statusBadge.color,
              color: statusBadge.textColor,
            }}
          >
            {statusBadge.label}
          </motion.span>
          <div className="flex items-center gap-1 text-xs text-white/60 font-medium">
            <Clock className="w-3 h-3" />
            {formatTime(match.kickoff)}
          </div>
        </div>

        {/* Teams Row - Premium */}
        <div className="flex items-stretch justify-between gap-3 py-4">
          {/* Home Team */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            className="flex-1 flex flex-col items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: isLive ? `${homeTeam.primaryColor}20` : 'transparent',
              borderTop: `3px solid ${homeTeam.primaryColor}`,
            }}
          >
            <div className="text-5xl"><TeamFlagDisplay flag={homeTeam.flag} code={homeTeam.code} /></div>
            <div className="text-xs font-black text-white uppercase tracking-wider">
              {homeTeam.code}
            </div>
          </motion.button>

          {/* Score - Center */}
          <div className="flex flex-col items-center justify-center px-3 min-w-20">
            {isFinished ? (
              <div
                className="flex items-baseline gap-1 font-black text-4xl"
                style={{ color: COLORS.trophy }}
              >
                <span>{match.homeScore || '0'}</span>
                <span className="text-lg text-white/40">:</span>
                <span>{match.awayScore || '0'}</span>
              </div>
            ) : isLive ? (
              <div className="text-center">
                <div
                  className="font-black text-3xl mb-1"
                  style={{ color: COLORS.trophy }}
                >
                  {match.homeScore || '0'}-{match.awayScore || '0'}
                </div>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-xs font-black text-red-500 flex items-center gap-1 justify-center"
                >
                  <Zap className="w-3 h-3" />
                  45'
                </motion.div>
              </div>
            ) : (
              <div className="text-white/30 font-black">VS</div>
            )}
          </div>

          {/* Away Team */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            className="flex-1 flex flex-col items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: isLive ? `${awayTeam.primaryColor}20` : 'transparent',
              borderTop: `3px solid ${awayTeam.primaryColor}`,
            }}
          >
            <div className="text-5xl"><TeamFlagDisplay flag={awayTeam.flag} code={awayTeam.code} /></div>
            <div className="text-xs font-black text-white uppercase tracking-wider">
              {awayTeam.code}
            </div>
          </motion.button>
        </div>

        {/* Stadium Info */}
        {(match.stadium || match.city) && (
          <div className="flex items-center gap-2 text-xs text-white/60 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{[match.stadium, match.city].filter(Boolean).join(' • ')}</span>
            {match.group && <span className="ml-auto text-worldcup-gold font-bold">Grupo {match.group}</span>}
          </div>
        )}

        {/* Prediction Status Badge */}
        {hasPrediction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 rounded-lg text-center border"
            style={{
              backgroundColor: `${COLORS.accent}20`,
              borderColor: COLORS.accent,
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">✓</span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Ya predijiste
              </span>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        {!isFinished && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onPredictClick}
              disabled={isPredicting}
              className="col-span-1 py-3 rounded-lg font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50"
              style={{
                backgroundColor: hasPrediction ? `${COLORS.primary}40` : COLORS.secondary,
                color: '#fff',
                border: hasPrediction ? `1px solid ${COLORS.primary}` : 'none',
              }}
            >
              {isPredicting ? '⏳' : hasPrediction ? 'Editar' : '⚽ Predecir'}
            </motion.button>
            <Link
              to={`/matches/${match.id}`}
              className="col-span-1 py-3 rounded-lg font-black text-sm uppercase tracking-wider transition-all border text-center"
              style={{
                backgroundColor: 'transparent',
                color: COLORS.lightGray,
                borderColor: `${COLORS.lightGray}40`,
              }}
            >
              📊 Info
            </Link>
          </div>
        )}

        {isFinished && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 rounded-lg font-black text-sm uppercase tracking-wider border transition-all"
            style={{
              backgroundColor: `${COLORS.lightGray}20`,
              color: COLORS.lightGray,
              borderColor: `${COLORS.lightGray}40`,
            }}
          >
            Ver Resultado
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
