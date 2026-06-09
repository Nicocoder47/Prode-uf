import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import type { ProfileCompetitiveStats } from '../../utils/predictionProgress'

function formatNumber(value: number) {
  return value.toLocaleString('es-AR')
}

const ITEMS: { key: keyof ProfileCompetitiveStats; label: string }[] = [
  { key: 'totalPoints', label: 'Puntos' },
  { key: 'predictionsCount', label: 'Predicciones' },
  { key: 'hits', label: 'Aciertos' },
  { key: 'exactHits', label: 'Exactas' },
  { key: 'drawHits', label: 'Empates' },
  { key: 'misses', label: 'Errores' },
]

export function ProfileCompetitiveSummary({ stats }: { stats: ProfileCompetitiveStats }) {
  return (
    <motion.section {...MOTION.enter} className="wc26-profile-section">
      <div className="wc26-profile-section__header">
        <p className="wc26-profile-section__kicker">Competencia</p>
        <h2 className="wc26-profile-section__title">Resumen competitivo</h2>
      </div>

      <motion.div
        initial={MOTION.stagger.initial}
        animate={MOTION.stagger.animate}
        className="wc26-profile-stats-grid"
      >
        {ITEMS.map(({ key, label }) => (
          <motion.div key={key} variants={MOTION.enter} className="wc26-profile-stat-card">
            <p className="wc26-profile-stat-card__value">{formatNumber(stats[key] as number)}</p>
            <p className="wc26-profile-stat-card__label">{label}</p>
          </motion.div>
        ))}
        <motion.div variants={MOTION.enter} className="wc26-profile-stat-card wc26-profile-stat-card--accent">
          <p className="wc26-profile-stat-card__value">
            {stats.accuracy != null ? `${stats.accuracy}%` : '—'}
          </p>
          <p className="wc26-profile-stat-card__label">Precisión</p>
        </motion.div>
      </motion.div>
    </motion.section>
  )
}
