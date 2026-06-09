import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'

interface HomeActivityCardProps {
  predictionsCount: number
  pendingPredictions: number
  hits: number
  totalPoints: number
  rank: number | null
}

export function HomeActivityCard({
  predictionsCount,
  pendingPredictions,
  hits,
  totalPoints,
  rank,
}: HomeActivityCardProps) {
  const stats = [
    { label: 'Pendientes', value: pendingPredictions },
    { label: 'Puntos', value: totalPoints },
    { label: 'Aciertos', value: hits },
    { label: 'Posición', value: rank != null ? `#${rank}` : '—' },
  ]

  return (
    <motion.section {...MOTION.enter} className="wc26-activity-card mb-5">
      <div className="wc26-activity-card__header">
        <p className="wc26-activity-card__title">Tu actividad</p>
        <p className="wc26-activity-card__meta">
          {predictionsCount} prediccion{predictionsCount === 1 ? '' : 'es'} hechas
        </p>
      </div>
      <motion.div
        initial={MOTION.stagger.initial}
        animate={MOTION.stagger.animate}
        className="wc26-activity-card__grid"
      >
        {stats.map(({ label, value }) => (
          <motion.div key={label} variants={MOTION.enter} className="wc26-activity-card__stat">
            <p className="wc26-activity-card__value">{value}</p>
            <p className="wc26-activity-card__label">{label}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  )
}
