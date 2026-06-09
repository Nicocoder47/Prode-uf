import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Bell,
  CreditCard,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useAuth } from '../../lib/auth.tsx'
import { signOut } from '../../lib/authActions.ts'

const nav = [
  { hash: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { hash: 'users', label: 'Usuarios', icon: Users },
  { hash: 'activity', label: 'Actividad', icon: Activity },
  { hash: 'notifications', label: 'Notificaciones', icon: Bell },
  { hash: 'cards', label: 'Cards', icon: CreditCard },
]

export function AdminShell() {
  const { profile } = useAuth()
  const location = useLocation()

  function goSection(hash: string) {
    if (location.pathname === '/admin') {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.replaceState(null, '', `/admin#${hash}`)
    } else {
      window.location.href = `/admin#${hash}`
    }
  }

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
            {nav.map(({ hash, label, icon: Icon }) => (
              <button
                key={hash}
                type="button"
                onClick={() => goSection(hash)}
                className="admin-shell-nav-btn"
              >
                <Icon className="h-4 w-4 text-amber-300/80" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <nav className="flex gap-2 overflow-x-auto pb-1 md:hidden">
          {nav.map(({ hash, label, icon: Icon }) => (
            <button key={hash} type="button" onClick={() => goSection(hash)} className="admin-shell-chip">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
