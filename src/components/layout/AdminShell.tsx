import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Bell,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useAuth } from '../../lib/auth.tsx'
import { signOut } from '../../lib/authActions.ts'
import { AdminMigrationBanner } from '../../features/admin/AdminMigrationBanner.tsx'

const nav = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Usuarios', icon: Users },
  { to: '/admin/activity', label: 'Actividad', icon: Activity },
  { to: '/admin/notifications', label: 'Notificaciones', icon: Bell },
  { to: '/admin/system', label: 'Sistema', icon: Server },
  { to: '/admin/support', label: 'Soporte', icon: LifeBuoy },
  { to: '/admin/cards', label: 'Cards', icon: CreditCard },
] as const

function navClassName(isActive: boolean, base: string) {
  return isActive ? `${base} is-active` : base
}

export function AdminShell() {
  const { profile } = useAuth()

  return (
    <div className="admin-shell min-h-screen bg-[#030712] text-white">
      <div className="admin-shell-glow pointer-events-none fixed inset-0" aria-hidden />

      <header className="admin-shell-header sticky top-0 z-40 border-b border-amber-400/15 bg-[rgba(3,7,18,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="admin-shell-badge grid h-11 w-11 place-items-center rounded-2xl">
              <ShieldCheck className="h-6 w-6 text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-amber-300/90">
                Centro de control
              </p>
              <h1 className="truncate text-lg font-extrabold text-white md:text-xl">
                Panel Admin PRODEMUNDIAL
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200 sm:inline">
              {profile?.full_name ?? 'Admin'}
            </span>
            <Link to="/" className="admin-shell-btn admin-shell-btn--ghost">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Volver al juego</span>
            </Link>
            <button type="button" className="admin-shell-btn admin-shell-btn--danger" onClick={() => signOut()}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 md:grid-cols-[240px_1fr] md:px-8">
        <aside className="admin-shell-sidebar hidden md:block">
          <p className="mb-3 px-2 text-[10px] font-extrabold uppercase tracking-widest text-white/40">
            Secciones
          </p>
          <nav className="space-y-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => navClassName(isActive, 'admin-shell-nav-btn')}
              >
                <Icon className="h-4 w-4 text-amber-300/80" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <nav className="flex gap-2 overflow-x-auto pb-1 md:hidden">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => navClassName(isActive, 'admin-shell-chip')}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 space-y-4 md:col-start-2">
          <AdminMigrationBanner />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
