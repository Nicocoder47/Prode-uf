import type { ReactNode } from 'react'
import { NavLink, useLocation, Link } from 'react-router-dom'
import { Home, ShieldCheck, Shield, Play, Trophy, User } from 'lucide-react'
import { NotificationBell } from '../notifications/NotificationBell.tsx'
import { NotificationTicker } from '../notifications/NotificationTicker.tsx'
import { useAuth } from '../../lib/auth.tsx'
import { BottomNavigation } from '../worldcup/BottomNavigation'
import { SeccionalLogo } from './SeccionalLogo'
import { MobileTopHeader } from './MobileTopHeader'
import { usePlayMatchesHref } from '../../hooks/usePlayMatchesHref'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/teams', label: 'Equipos', icon: Shield },
  { to: '/matches', label: 'JUGAR', icon: Play, featured: true },
  { to: '/predictions', label: 'Ranking', icon: Trophy },
  { to: '/profile', label: 'Perfil', icon: User },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const location = useLocation()
  const playHref = usePlayMatchesHref()
  const isFixture = location.pathname === '/matches' || location.pathname.startsWith('/matches/')
  const isHome = location.pathname === '/'
  const navItemsToShow = profile?.role === 'admin' ? navItems : navItems.filter(item => item.to !== '/admin')

  return (
    <div className="wc26-screen text-wc26-text">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col md:max-w-[1700px] md:px-6 md:py-4 lg:px-8">
        {!isHome && (
          <MobileTopHeader
            variant={isFixture ? 'fixture' : 'default'}
            className={`mx-1 mb-1 mt-[max(0.75rem,env(safe-area-inset-top))] md:hidden ${
              isFixture ? 'border border-amber-400/20' : ''
            }`}
          />
        )}

        {!isHome && (
          <div className="mb-2 md:hidden">
            <NotificationTicker />
          </div>
        )}

        <header className="mb-4 hidden rounded-[32px] wc26-glass p-5 md:block">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SeccionalLogo size="md" />
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-wc26-yellow">PRODEMUNDIAL 2026</p>
                <h1 className="text-xl font-extrabold text-white lg:text-2xl">Viví el Mundial. Jugá el Prode.</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Link to="/profile" className="wc26-chip-light !px-4 !py-2">
                <User className="h-4 w-4" /> {profile?.full_name ?? 'Perfil'}
              </Link>
            </div>
          </div>
        </header>

        <nav className="wc26-nav-desktop mb-4 hidden gap-1 rounded-[28px] p-2 md:flex">
          {navItemsToShow.map(({ to, label, icon: Icon, featured }) => (
            <NavLink
              key={to}
              to={featured ? playHref : to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'wc26-nav-desktop__link inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-2 py-2.5 text-xs font-extrabold',
                  featured
                    ? isActive
                      ? 'wc26-nav-desktop__link--featured wc26-nav-desktop__link--featured-active'
                      : 'wc26-nav-desktop__link--featured'
                    : isActive
                      ? 'wc26-nav-desktop__link--active'
                      : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {featured ? 'JUGAR' : label}
            </NavLink>
          ))}
        </nav>

        <main
          className={`flex-1 md:px-0 md:pb-6 ${
            isHome
              ? 'px-0 pb-[calc(8.5rem+env(safe-area-inset-bottom))]'
              : 'px-2 pb-[calc(8.35rem+env(safe-area-inset-bottom))]'
          }`}
        >
          {children}
        </main>

        <BottomNavigation />
      </div>
    </div>
  )
}
