import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PremiumNavIcon, PremiumPlayIcon, type PremiumNavIconName } from './PremiumNavIcons'

const navItems: {
  to: string
  label: string
  icon: PremiumNavIconName
  tone: 'home' | 'teams' | 'fixture' | 'predictions' | 'profile'
  featured?: boolean
}[] = [
  { to: '/', label: 'Inicio', icon: 'home', tone: 'home' },
  { to: '/teams', label: 'Equipos', icon: 'teams', tone: 'teams' },
  { to: '/matches', label: 'Iniciar', icon: 'fixture', tone: 'fixture', featured: true },
  { to: '/predictions', label: 'Predic.', icon: 'predictions', tone: 'predictions' },
  { to: '/profile', label: 'Perfil', icon: 'profile', tone: 'profile' },
]

export function BottomNavigation() {
  return (
    <motion.nav
      initial={{ y: 28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 32, delay: 0.08 }}
      className="wc26-bottom-nav fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Navegación principal"
    >
      <div className="wc26-bottom-nav__inner">
        {navItems.map(({ to, label, icon, tone, featured }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `wc26-bottom-nav__item wc26-bottom-nav__item--${tone} ${
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

                {featured ? (
                  <div className="wc26-bottom-nav__featured">
                    <motion.span
                      className="wc26-bottom-nav__fixture-ring"
                      aria-hidden="true"
                      animate={{
                        scale: isActive ? [1, 1.12, 1] : [1, 1.06, 1],
                        opacity: isActive ? [0.55, 0.85, 0.55] : [0.35, 0.55, 0.35],
                      }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.span
                      className={`wc26-bottom-nav__fixture-icon${isActive ? ' is-active' : ''}`}
                      whileTap={{ scale: 0.9 }}
                      animate={{
                        y: -4,
                        scale: isActive ? 1.07 : 1,
                      }}
                      transition={{ type: 'spring', stiffness: 480, damping: 28 }}
                    >
                      <span className="wc26-bottom-nav__fixture-shine" aria-hidden="true" />
                      <span className="wc26-bottom-nav__fixture-gloss" aria-hidden="true" />
                      <PremiumPlayIcon active={isActive} className="relative z-[1]" />
                    </motion.span>
                  </div>
                ) : (
                  <motion.span
                    className={`wc26-bottom-nav__icon-shell${isActive ? ' is-active' : ''}`}
                    whileTap={{ scale: 0.88 }}
                    animate={{
                      scale: isActive ? 1.06 : 1,
                      y: isActive ? -2 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="bottom-nav-dot"
                        className="wc26-bottom-nav__dot"
                        transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                      />
                    )}
                    <PremiumNavIcon name={icon} active={isActive} className="wc26-bottom-nav__svg" />
                  </motion.span>
                )}

                <motion.span
                  className={`wc26-bottom-nav__label${featured ? ' wc26-bottom-nav__label--featured' : ''}`}
                  animate={{
                    opacity: isActive ? 1 : featured ? 0.88 : 0.65,
                    y: isActive ? 0 : 1,
                  }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
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
