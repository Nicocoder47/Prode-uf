import type { ReactNode } from 'react'
import { NavLink, useLocation, Link } from 'react-router-dom'
import { CalendarDays, Home, ShieldCheck, Shield, Target, User } from 'lucide-react'
import { NotificationBell } from '../notifications/NotificationBell.tsx'
import { NotificationTicker } from '../notifications/NotificationTicker.tsx'
import { useAuth } from '../../lib/auth.tsx'
import { BottomNavigation } from '../worldcup/BottomNavigation'
import { SeccionalLogo } from './SeccionalLogo'
import { MobileTopHeader } from './MobileTopHeader'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home, tone: 'home' },
  { to: '/teams', label: 'Equipos', icon: Shield, tone: 'teams' },
  { to: '/matches', label: 'Jugar', icon: CalendarDays, tone: 'fixture', featured: true },
  { to: '/predictions', label: 'Predicciones', icon: Target, tone: 'predictions' },
  { to: '/profile', label: 'Perfil', icon: User, tone: 'profile' },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, tone: 'admin' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const location = useLocation()
  const isFixture = location.pathname === '/matches' || location.pathname.startsWith('/matches/')
  const isHome = location.pathname === '/'
  const navItemsToShow = profile?.role === 'admin' ? navItems : navItems.filter(item => item.to !== '/admin')

  return (
    <div className="wc26-screen text-wc26-text">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col md:max-w-[1700px] md:px-6 md:py-4 lg:px-8">
        {!isHome && (
          <MobileTopHeader
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

        <nav className="mb-4 hidden gap-1 rounded-[28px] wc26-glass p-2 md:flex">
          {navItemsToShow.map(({ to, label, icon: Icon, featured }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-2 py-2.5 text-xs font-extrabold transition ${
                  featured
                    ? isActive
                      ? 'wc26-nav-fixture-active scale-[1.03] shadow-lg'
                      : 'bg-gradient-to-b from-[#F5C451] to-[#e8b84a] text-[#0c1220] shadow-md hover:brightness-105'
                    : isActive
                      ? 'bg-gradient-to-b from-[#123B7A] to-[#08142A] text-white shadow-lg ring-1 ring-[#F5C451]/25'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {featured ? 'Jugar' : label}
            </NavLink>
          ))}
        </nav>

        <main
          className={`flex-1 md:px-0 md:pb-6 ${
            isHome
              ? 'px-0 pb-[calc(8rem+env(safe-area-inset-bottom))]'
              : 'px-2 pb-[calc(7.75rem+env(safe-area-inset-bottom))]'
          }`}
        >
          {children}
        </main>

        <BottomNavigation />
      </div>
    </div>
  )
}
