import { motion } from 'framer-motion'
import type { PhaseProgress } from '../../../constants/phases'

interface PhaseProgressBarProps {
  progress: PhaseProgress[]
}

export function PhaseProgressBar({ progress }: PhaseProgressBarProps) {
  const totalMatches = progress.reduce((sum, p) => sum + p.total, 0)
  const totalPredicted = progress.reduce((sum, p) => sum + p.predicted, 0)
  const globalPercent = totalMatches > 0 ? Math.round((totalPredicted / totalMatches) * 100) : 0

  return (
    <div className="wc26-phase-progress">
      <div className="wc26-phase-progress__header">
        <span className="wc26-phase-progress__title">Tu progreso del Mundial</span>
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

      <div className="wc26-phase-progress__phases">
        {progress.map(p => (
          <div key={p.stage} className="wc26-phase-progress__phase-item">
            <span className="wc26-phase-progress__phase-label">{p.label}</span>
            <span className={`wc26-phase-progress__phase-count ${p.predicted > 0 && p.predicted >= p.total ? 'wc26-phase-progress__phase-count--complete' : ''}`}>
              {p.unlocked ? `${p.predicted}/${p.total}` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
