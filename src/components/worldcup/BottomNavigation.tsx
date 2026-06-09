import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Home, Shield, CalendarDays, Target, User, type LucideIcon } from 'lucide-react'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  tone: 'home' | 'teams' | 'play' | 'predictions' | 'profile'
  featured?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home, tone: 'home' },
  { to: '/teams', label: 'Equipos', icon: Shield, tone: 'teams' },
  { to: '/matches', label: 'Jugar', icon: CalendarDays, tone: 'play', featured: true },
  { to: '/predictions', label: 'Predicciones', icon: Target, tone: 'predictions' },
  { to: '/profile', label: 'Perfil', icon: User, tone: 'profile' },
]

const spring = { type: 'spring' as const, stiffness: 460, damping: 32 }

export function BottomNavigation() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.nav
      initial={reduceMotion ? false : { y: 32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...spring, delay: 0.06 }}
      className="wc26-bottom-nav fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Navegación principal"
    >
      <div className="wc26-bottom-nav__backdrop" aria-hidden />
      <div className="wc26-bottom-nav__inner">
        <div className="wc26-bottom-nav__notch" aria-hidden />
        <div className="wc26-bottom-nav__rail" aria-hidden />

        {navItems.map(({ to, label, icon: Icon, tone, featured }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive }) =>
              [
                'wc26-bottom-nav__item',
                `wc26-bottom-nav__item--${tone}`,
                featured ? 'wc26-bottom-nav__item--featured' : '',
                isActive ? 'is-active' : '',
              ].filter(Boolean).join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {featured ? (
                  <div className="wc26-bottom-nav__cta-wrap">
                    <span className="wc26-bottom-nav__cta-pedestal" aria-hidden />
                    {!reduceMotion && (
                      <motion.span
                        className="wc26-bottom-nav__cta-pulse"
                        aria-hidden
                        animate={{
                          scale: isActive ? [1, 1.2, 1] : [1, 1.12, 1],
                          opacity: isActive ? [0.32, 0.58, 0.32] : [0.18, 0.34, 0.18],
                        }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    <motion.span
                      className={`wc26-bottom-nav__cta${isActive ? ' is-active' : ''}`}
                      whileTap={reduceMotion ? undefined : { scale: 0.88 }}
                      animate={{ y: -12, scale: isActive ? 1.05 : 1 }}
                      transition={spring}
                    >
                      <span className="wc26-bottom-nav__cta-shine" aria-hidden />
                      <span className="wc26-bottom-nav__cta-gloss" aria-hidden />
                      <Icon className="wc26-bottom-nav__cta-icon" strokeWidth={2.2} aria-hidden />
                    </motion.span>
                  </div>
                ) : (
                  <>
                    {isActive && (
                      <>
                        <motion.span
                          layoutId="pm-bottom-nav-pill"
                          className="wc26-bottom-nav__pill"
                          transition={spring}
                        />
                        <motion.span
                          layoutId="pm-bottom-nav-indicator"
                          className="wc26-bottom-nav__indicator"
                          transition={spring}
                        />
                      </>
                    )}
                    <motion.span
                      className={`wc26-bottom-nav__icon-shell${isActive ? ' is-active' : ''}`}
                      whileTap={reduceMotion ? undefined : { scale: 0.86 }}
                      animate={{
                        scale: isActive ? 1.06 : 1,
                        y: isActive ? -2 : 0,
                      }}
                      transition={spring}
                    >
                      <Icon className="wc26-bottom-nav__icon" strokeWidth={isActive ? 2.25 : 1.8} aria-hidden />
                    </motion.span>
                  </>
                )}

                <motion.span
                  className={`wc26-bottom-nav__label${featured ? ' wc26-bottom-nav__label--featured' : ''}`}
                  animate={{
                    opacity: isActive ? 1 : featured ? 0.86 : 0.55,
                    y: isActive ? 0 : 1,
                  }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {label}
                </motion.span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </motion.nav>
  )
}
