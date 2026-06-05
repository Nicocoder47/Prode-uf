import { NavLink } from 'react-router-dom'
import { Home, Shield, CalendarDays, Target, User } from 'lucide-react'
import { motion } from 'framer-motion'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home, tone: 'home' as const },
  { to: '/teams', label: 'Equipos', icon: Shield, tone: 'teams' as const },
  { to: '/matches', label: 'Fixture', icon: CalendarDays, tone: 'fixture' as const, featured: true },
  { to: '/predictions', label: 'Predicciones', icon: Target, tone: 'predictions' as const },
  { to: '/profile', label: 'Perfil', icon: User, tone: 'profile' as const },
]

export function BottomNavigation() {
  return (
    <nav className="wc26-bottom-nav fixed inset-x-0 bottom-0 z-50 md:hidden" aria-label="Navegación principal">
      <div className="wc26-bottom-nav__inner mx-auto flex max-w-[430px] items-end justify-around px-1 pb-1 pt-2">
        {navItems.map(({ to, label, icon: Icon, tone, featured }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `wc26-bottom-nav__item wc26-bottom-nav__item--${tone} relative flex flex-col items-center ${
                featured ? 'wc26-bottom-nav__item--featured' : ''
              } ${isActive ? 'is-active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !featured && (
                  <motion.span
                    layoutId="bottom-nav-active"
                    className="wc26-bottom-nav__pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                {isActive && featured && (
                  <motion.span
                    layoutId="bottom-nav-fixture-glow"
                    className="wc26-bottom-nav__fixture-glow"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <motion.span
                  className={`relative z-10 grid place-items-center ${featured ? 'wc26-bottom-nav__fixture-icon' : 'h-7 w-7'}`}
                  animate={{ scale: isActive ? (featured ? 1.05 : 1.08) : featured ? 1 : 1, y: isActive ? -1 : 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <Icon
                    className={featured ? 'h-7 w-7' : 'h-[21px] w-[21px]'}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </motion.span>
                <span
                  className={`relative z-10 mt-0.5 leading-none tracking-wide ${
                    featured ? 'text-[10px] font-black' : 'text-[9px] font-extrabold'
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
