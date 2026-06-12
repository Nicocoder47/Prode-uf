import { Link } from 'react-router-dom'
import { CalendarDays, LogOut, Target, Trophy } from 'lucide-react'
import { MOTION } from '../../constants/design'
import { AdaptiveButton, AdaptiveSection } from '../../utils/adaptiveMotion'

type ProfileQuickActionsProps = {
  onSignOut: () => void
}

const ACTIONS = [
  { to: '/mis-predicciones', label: 'Mis Predicciones', icon: Target },
  { to: '/leaderboard', label: 'Ranking', icon: Trophy },
  { to: '/matches', label: 'Partidos', icon: CalendarDays },
] as const

export function ProfileQuickActions({ onSignOut }: ProfileQuickActionsProps) {
  return (
    <AdaptiveSection motionProps={MOTION.enter} className="wc26-profile-section">
      <div className="wc26-profile-section__header">
        <p className="wc26-profile-section__kicker">Accesos</p>
        <h2 className="wc26-profile-section__title">Acciones rápidas</h2>
      </div>

      <div className="wc26-profile-actions">
        {ACTIONS.map(({ to, label, icon: Icon }) => (
          <div key={to}>
            <Link to={to} className="wc26-profile-action">
              <Icon className="h-4 w-4 text-[#F8B91E]" />
              {label}
            </Link>
          </div>
        ))}
        <AdaptiveButton
          type="button"
          onClick={onSignOut}
          className="wc26-profile-action wc26-profile-action--danger"
          motionProps={MOTION.tap}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </AdaptiveButton>
      </div>
    </AdaptiveSection>
  )
}
