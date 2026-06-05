import type { ReactNode } from 'react'
import { NavLink, useLocation, Link } from 'react-router-dom'
import { Bell, CalendarDays, Home, ShieldCheck, Shield, Target, Trophy, User } from 'lucide-react'
import { useAuth } from '../../lib/auth.tsx'
import { BottomNavigation } from '../worldcup/BottomNavigation'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home, tone: 'home' },
  { to: '/teams', label: 'Equipos', icon: Shield, tone: 'teams' },
  { to: '/matches', label: 'Fixture', icon: CalendarDays, tone: 'fixture', featured: true },
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
        <header
          className={`mx-1 mb-3 mt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between rounded-[28px] wc26-glass px-4 py-3 md:hidden ${
            isFixture ? 'border border-amber-400/20' : ''
          } ${isHome ? 'hidden' : ''}`}
        >
          <div>
            <p className="text-sm font-extrabold tracking-tight text-white">PRODEMUNDIAL</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
              {isFixture ? 'Centro del juego' : 'Mundial 2026'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="wc26-header-icon-btn" aria-label="Notificaciones">
              <Bell className="h-4 w-4" />
            </button>
            <Link to="/profile" className="wc26-header-icon-btn" aria-label="Perfil">
              <User className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <header className="mb-4 hidden rounded-[32px] wc26-glass p-5 md:block">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-wc26-green600 to-wc26-green800 text-white shadow-wc26-float">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-wc26-yellow">PRODEMUNDIAL 2026</p>
                <h1 className="text-xl font-extrabold text-white lg:text-2xl">Viví el Mundial. Jugá el Prode.</h1>
              </div>
            </div>
            <Link to="/profile" className="wc26-chip-light !px-4 !py-2">
              <User className="h-4 w-4" /> {profile?.full_name ?? 'Perfil'}
            </Link>
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
                      ? 'wc26-nav-fixture-active scale-[1.03] text-[#1a1200] shadow-lg'
                      : 'bg-gradient-to-b from-[#F5C451] to-[#FFD700] text-[#1a1200] shadow-md hover:brightness-105'
                    : isActive
                      ? 'bg-gradient-to-b from-wc26-green600 to-wc26-green800 text-white shadow-lg'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main
          className={`flex-1 md:px-0 md:pb-6 ${
            isHome
              ? 'px-0 pb-[calc(7rem+env(safe-area-inset-bottom))]'
              : 'px-2 pb-[calc(6.75rem+env(safe-area-inset-bottom))]'
          }`}
        >
          {children}
        </main>

        <BottomNavigation />
      </div>
    </div>
  )
}
