import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Home, Shield, Play, Trophy, User, type LucideIcon } from 'lucide-react'

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
  { to: '/matches', label: 'JUGAR', icon: Play, tone: 'play', featured: true },
  { to: '/predictions', label: 'Ranking', icon: Trophy, tone: 'predictions' },
  { to: '/profile', label: 'Perfil', icon: User, tone: 'profile' },
]

const spring = { type: 'spring' as const, stiffness: 480, damping: 34 }

export function BottomNavigation() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.nav
      initial={reduceMotion ? false : { y: 36, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...spring, delay: 0.05 }}
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
            aria-label={featured ? 'Jugar — centro de partidos' : label}
            className={({ isActive }) =>
              [
                'wc26-bottom-nav__item',
                `wc26-bottom-nav__item--${tone}`,
                featured ? 'wc26-bottom-nav__item--featured' : '',
                isActive ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')
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
                          scale: isActive ? [1, 1.22, 1] : [1, 1.14, 1],
                          opacity: isActive ? [0.35, 0.62, 0.35] : [0.2, 0.38, 0.2],
                        }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    <motion.span
                      className={`wc26-bottom-nav__cta${isActive ? ' is-active' : ''}`}
                      whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                      whileHover={reduceMotion ? undefined : { scale: 1.05, y: -16 }}
                      animate={{ y: -16, scale: isActive ? 1.08 : 1 }}
                      transition={spring}
                    >
                      <span className="wc26-bottom-nav__cta-shine" aria-hidden />
                      <span className="wc26-bottom-nav__cta-gloss" aria-hidden />
                      <Icon
                        className="wc26-bottom-nav__cta-icon"
                        strokeWidth={2.5}
                        fill={isActive ? 'currentColor' : 'rgba(16, 24, 32, 0.22)'}
                        aria-hidden
                      />
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
                      whileTap={reduceMotion ? undefined : { scale: 0.88 }}
                      whileHover={reduceMotion ? undefined : { scale: 1.04, y: -2 }}
                      animate={{
                        scale: isActive ? 1.07 : 1,
                        y: isActive ? -2 : 0,
                      }}
                      transition={spring}
                    >
                      <Icon className="wc26-bottom-nav__icon" strokeWidth={isActive ? 2.3 : 1.85} aria-hidden />
                    </motion.span>
                  </>
                )}

                <motion.span
                  className={`wc26-bottom-nav__label${featured ? ' wc26-bottom-nav__label--featured' : ''}`}
                  animate={{
                    opacity: isActive ? 1 : featured ? 0.94 : 0.62,
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

