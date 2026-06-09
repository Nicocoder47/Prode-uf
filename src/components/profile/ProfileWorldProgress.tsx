import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'

type ProfileWorldProgressProps = {
  predicted: number
  total: number
}

export function ProfileWorldProgress({ predicted, total }: ProfileWorldProgressProps) {
  const percent = total > 0 ? Math.round((predicted / total) * 100) : 0

  return (
    <motion.section {...MOTION.enter} className="wc26-profile-section">
      <div className="wc26-profile-section__header">
        <p className="wc26-profile-section__kicker">Mundial 2026</p>
        <h2 className="wc26-profile-section__title">Progreso del Mundial</h2>
      </div>

      <div className="wc26-profile-progress-card">
        <div className="wc26-profile-progress-card__row">
          <span className="wc26-profile-progress-card__count">
            {predicted} / {total}
          </span>
          <span className="wc26-profile-progress-card__percent">{percent}%</span>
        </div>
        <div className="wc26-profile-progress-card__track">
          <motion.div
            className="wc26-profile-progress-card__fill"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <p className="wc26-profile-progress-card__hint">
          Partidos predichos del fixture disponible
        </p>
        <Link to="/matches" className="wc26-profile-cta wc26-profile-cta--secondary">
          Completar mis predicciones
        </Link>
      </div>
    </motion.section>
  )
}
