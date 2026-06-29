import { NavLink } from 'react-router-dom'
import { Home, Shield, Play, Trophy, User, type LucideIcon } from 'lucide-react'
import { usePlayMatchesHref } from '../../hooks/usePlayMatchesHref'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  featured?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/teams', label: 'Equipos', icon: Shield },
  { to: '/matches', label: 'JUGAR', icon: Play, featured: true },
  { to: '/predictions', label: 'Ranking', icon: Trophy },
  { to: '/profile', label: 'Perfil', icon: User },
]

export function BottomNavigation() {
  const playHref = usePlayMatchesHref()

  return (
    <nav
      className="wc26-bottom-nav fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Navegación principal"
    >
      <div className="wc26-bottom-nav__backdrop" aria-hidden />
      <div className="wc26-bottom-nav__inner">
        <div className="wc26-bottom-nav__notch" aria-hidden />
        <div className="wc26-bottom-nav__rail" aria-hidden />

        {navItems.map(({ to, label, icon: Icon, featured }) => (
          <NavLink
            key={to}
            to={featured ? playHref : to}
            end={to === '/'}
            aria-label={featured ? 'Jugar — centro de partidos' : label}
            className={({ isActive }) =>
              [
                'wc26-bottom-nav__item',
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
                    <span className={`wc26-bottom-nav__cta${isActive ? ' is-active' : ''}`}>
                      <span className="wc26-bottom-nav__cta-gloss" aria-hidden />
                      <Icon
                        className="wc26-bottom-nav__cta-icon"
                        strokeWidth={2.5}
                        fill={isActive ? 'currentColor' : 'rgba(16, 24, 32, 0.22)'}
                        aria-hidden
                      />
                    </span>
                  </div>
                ) : (
                  <span className="wc26-bottom-nav__icon-slot" aria-hidden>
                    <Icon
                      className={`wc26-bottom-nav__icon${isActive ? ' is-active' : ''}`}
                      strokeWidth={isActive ? 2.35 : 2}
                      aria-hidden
                    />
                  </span>
                )}

                <span
                  className={`wc26-bottom-nav__label${featured ? ' wc26-bottom-nav__label--featured' : ''}${isActive ? ' is-active' : ''}`}
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
