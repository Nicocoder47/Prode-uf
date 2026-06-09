import { NavLink, Outlet } from 'react-router-dom'
import { Activity, Bell, CreditCard, LayoutDashboard, Users } from 'lucide-react'

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Usuarios', icon: Users },
  { to: '/admin/activity', label: 'Actividad', icon: Activity },
  { to: '/admin/notifications', label: 'Notificaciones', icon: Bell },
  { to: '/admin/cards', label: 'Cards', icon: CreditCard },
]

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-wc26-yellow">Administración</p>
        <h1 className="text-2xl font-extrabold text-white">Panel PRODEMUNDIAL</h1>
        <p className="mt-1 text-sm text-white/60">Supabase-only · sin backend Express</p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-extrabold transition ${
                isActive
                  ? 'bg-gradient-to-b from-wc26-green600 to-wc26-green800 text-white shadow-lg'
                  : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
