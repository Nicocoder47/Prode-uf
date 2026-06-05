import type { Match, MatchStatus } from '../../types/worldcup'
import { WC26 } from '../../constants/design'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { MOTION } from '../../constants/design'
import { TeamCrest } from './TeamCrest'

const STATUS: Record<MatchStatus, { label: string; bg: string; color: string }> = {
  scheduled: { label: 'PROGRAMADO', bg: `${WC26.blueBright}18`, color: WC26.blue },
  live: { label: 'EN VIVO', bg: `${WC26.redBright}22`, color: WC26.redBright },
  halftime: { label: 'EN VIVO', bg: `${WC26.redBright}22`, color: WC26.redBright },
  finished: { label: 'FINALIZADO', bg: '#E5E7EB', color: WC26.muted },
  postponed: { label: 'POSPUESTO', bg: `${WC26.orange}18`, color: WC26.orange },
  cancelled: { label: 'CANCELADO', bg: '#E5E7EB', color: WC26.muted },
}

const LOCKED_BADGE = { label: 'LOCKED', bg: 'rgba(212,175,55,0.22)', color: WC26.gold }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function resolveBadge(match: Match) {
  if (match.isLocked && match.status === 'scheduled') return LOCKED_BADGE
  return STATUS[match.status] ?? STATUS.scheduled
}

interface CompactMatchCardProps {
  match: Match
  hasPrediction?: boolean
  onPredict?: () => void
  featured?: boolean
}

export function CompactMatchCard({ match, hasPrediction, onPredict, featured }: CompactMatchCardProps) {
  const home = match.homeTeam
  const away = match.awayTeam
  if (!home || !away) return null

  const st = resolveBadge(match)
  const isLive = match.status === 'live' || match.status === 'halftime'
  const showScore = isLive || match.status === 'finished'
  const canPredict = onPredict && match.status === 'scheduled' && !match.isLocked

  return (
    <motion.article
      initial={MOTION.enter.initial}
      animate={MOTION.enter.animate}
      transition={MOTION.enter.transition}
      whileTap={{ scale: 0.985 }}
      className={`wc26-match-sport ${featured ? 'wc26-match-sport--featured' : ''}`}
    >
      <div className={`wc26-match-sport__bar ${isLive ? 'is-live' : featured ? 'is-featured' : ''}`} />

      <div className="p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-white/60">
            {match.group ? `Grupo ${match.group}` : match.stage}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide ${isLive ? 'wc26-badge-live' : ''}`}
            style={{ backgroundColor: st.bg, color: st.color }}
          >
            {st.label}
          </span>
        </div>

        <Link to={`/matches/${match.id}`} className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <TeamCrest flag={home.flag} code={home.code} size={featured ? 'lg' : 'md'} />
            <p className="truncate text-xs font-extrabold text-white">{home.code}</p>
            {featured && <p className="truncate text-[10px] text-white/60">{home.name}</p>}
          </div>

          <div className="shrink-0 px-2 text-center">
            {showScore ? (
              <p className="font-mono text-xl font-extrabold text-wc26-yellow">
                {match.homeScore ?? 0} - {match.awayScore ?? 0}
              </p>
            ) : (
              <>
                <p className="wc26-match-sport__vs">vs</p>
                <p className="wc26-match-sport__time">{fmtTime(match.kickoff)}</p>
              </>
            )}
            <p className="mt-0.5 text-[9px] font-semibold uppercase text-white/50">{fmtDate(match.kickoff)}</p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <TeamCrest flag={away.flag} code={away.code} size={featured ? 'lg' : 'md'} />
            <p className="truncate text-xs font-extrabold text-white">{away.code}</p>
            {featured && <p className="truncate text-[10px] text-white/60">{away.name}</p>}
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden="true" />
        </Link>

        {canPredict && (
          <motion.button
            type="button"
            onClick={onPredict}
            className={`mt-3 w-full py-3 text-xs ${hasPrediction ? 'wc26-btn-outline' : 'wc26-btn-blue'}`}
            {...MOTION.tap}
          >
            {hasPrediction ? 'Editar predicción' : 'Predecir'}
          </motion.button>
        )}
      </div>
    </motion.article>
  )
}
