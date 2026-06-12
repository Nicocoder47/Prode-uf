import { Link } from 'react-router-dom'
import { LayoutGrid, CalendarDays, Target, Shield, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'

const ACTIONS = [
  { to: '/groups', label: 'Grupos', sub: 'Fase de grupos', icon: LayoutGrid, tone: 'blue' },
  { to: '/teams', label: 'Equipos', sub: '48 selecciones', icon: Shield, tone: 'green' },
  { to: '/matches', label: 'Fixture', sub: 'Calendario completo', icon: CalendarDays, tone: 'gold' },
  { to: '/mis-predicciones', label: 'Predicciones', sub: 'Tus pronósticos', icon: Target, tone: 'red' },
] as const

export function QuickActionGrid({ compact = false }: { compact?: boolean }) {
  return (
    <motion.div
      initial={MOTION.stagger.initial}
      animate={MOTION.stagger.animate}
      className="grid grid-cols-2 gap-3"
    >
      {ACTIONS.map(({ to, label, sub, icon: Icon, tone }) => (
        <motion.div key={to} variants={MOTION.enter}>
          <motion.div whileTap={{ scale: 0.96 }} transition={{ duration: 0.15 }}>
            <Link
              to={to}
              className={`wc26-action-premium wc26-action-premium--${tone}${compact ? ' wc26-action-premium--compact' : ''}`}
            >
              <span className="wc26-action-premium__shine" aria-hidden="true" />
              <Icon className="wc26-action-premium__ghost" aria-hidden="true" strokeWidth={1.5} />

              <span className="wc26-action-premium__icon">
                <Icon className="h-5 w-5" strokeWidth={2.5} />
              </span>

              <span className="wc26-action-premium__text">
                <span className="wc26-action-premium__label">{label}</span>
                <span className="wc26-action-premium__sub">{sub}</span>
              </span>

              <span className="wc26-action-premium__arrow" aria-hidden="true">
                <ChevronRight className="h-4 w-4" strokeWidth={2.75} />
              </span>
            </Link>
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  )
}
