import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'

interface HomeActivityCardProps {
  predictionsCount: number
  hits: number
  totalPoints: number
  rank: number | null
}

export function HomeActivityCard({ predictionsCount, hits, totalPoints, rank }: HomeActivityCardProps) {
  const stats = [
    { label: 'Predicciones', value: predictionsCount },
    { label: 'Aciertos', value: hits },
    { label: 'Puntos', value: totalPoints },
    { label: 'Posición', value: rank != null ? `#${rank}` : '—' },
  ]

  return (
    <motion.div {...MOTION.enter} className="wc26-activity-card">
      <p className="wc26-activity-card__title">Tu actividad</p>
      <div className="wc26-activity-card__grid">
        {stats.map(({ label, value }) => (
          <div key={label} className="wc26-activity-card__stat">
            <p className="wc26-activity-card__value">{value}</p>
            <p className="wc26-activity-card__label">{label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
