import { motion } from 'framer-motion'
import type { MatchStage } from '../../../types/worldcup'
import type { PhaseProgress } from '../../../constants/phases'

interface PhaseProgressBarProps {
  progress: PhaseProgress[]
  activePhase?: MatchStage
}

function Round32ScoringHelp() {
  return (
    <div className="wc26-phase-progress__help">
      <div className="wc26-phase-progress__chips" role="list" aria-label="Puntaje en 16avos">
        <span className="wc26-phase-progress__chip" role="listitem">
          <span className="wc26-phase-progress__n wc26-phase-progress__n--r90">5</span>
          <span className="wc26-phase-progress__chip-label">90&apos;</span>
        </span>
        <span className="wc26-phase-progress__chip" role="listitem">
          <span className="wc26-phase-progress__n wc26-phase-progress__n--et">+3</span>
          <span className="wc26-phase-progress__chip-label">alargue</span>
        </span>
        <span className="wc26-phase-progress__chip" role="listitem">
          <span className="wc26-phase-progress__n wc26-phase-progress__n--pen">+2</span>
          <span className="wc26-phase-progress__chip-label">penales</span>
        </span>
        <span className="wc26-phase-progress__chip wc26-phase-progress__chip--max" role="listitem">
          <span className="wc26-phase-progress__n wc26-phase-progress__n--max">10</span>
          <span className="wc26-phase-progress__chip-label">máx</span>
        </span>
      </div>
      <p className="wc26-phase-progress__hint">
        Alargue = solo goles del suplementario · Sin empate en 90&apos;, alcanza el marcador del partido
      </p>
    </div>
  )
}

export function PhaseProgressBar({ progress, activePhase }: PhaseProgressBarProps) {
  const totalMatches = progress.reduce((sum, p) => sum + p.total, 0)
  const totalPredicted = progress.reduce((sum, p) => sum + p.predicted, 0)
  const globalPercent = totalMatches > 0 ? Math.round((totalPredicted / totalMatches) * 100) : 0
  const round32 = progress.find(p => p.stage === 'round32')
  const showKnockoutHelp = activePhase === 'round32' && Boolean(round32?.unlocked)

  return (
    <div className={`wc26-phase-progress${showKnockoutHelp ? ' wc26-phase-progress--with-help' : ''}`}>
      <div className="wc26-phase-progress__header">
        <span className="wc26-phase-progress__title">Progreso mundial</span>
        <span className="wc26-phase-progress__percent">{globalPercent}%</span>
      </div>

      <div className="wc26-phase-progress__bar">
        <motion.div
          className="wc26-phase-progress__fill"
          initial={{ width: 0 }}
          animate={{ width: `${globalPercent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      {showKnockoutHelp && <Round32ScoringHelp />}
    </div>
  )
}
