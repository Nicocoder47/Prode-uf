import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  Home,
  Shield,
  ShieldCheck,
  Target,
  Trophy,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../../lib/auth.tsx'

type MenuItem = {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}

const links: MenuItem[] = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/teams', label: 'Equipos', icon: Shield },
  { to: '/matches', label: 'Fixture', icon: CalendarDays },
  { to: '/predictions', label: 'Ranking', icon: Trophy },
  { to: '/mis-predicciones', label: 'Predicciones', icon: Target },
  { to: '/profile', label: 'Mi perfil', icon: User },
  { to: '/notifications', label: 'Notificaciones', icon: Bell },
]

interface MobileQuickMenuProps {
  open: boolean
  onClose: () => void
}

export function MobileQuickMenu({ open, onClose }: MobileQuickMenuProps) {
  const { profile } = useAuth()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const allLinks: MenuItem[] =
    profile?.role === 'admin'
      ? [...links, { to: '/admin', label: 'Panel admin', icon: ShieldCheck }]
      : links

  return (
    <div className="wc26-mobile-menu" role="dialog" aria-modal="true" aria-label="Menú rápido">
      <button type="button" className="wc26-mobile-menu__backdrop" aria-label="Cerrar menú" onClick={onClose} />
      <div className="wc26-mobile-menu__panel">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-extrabold text-white">Menú</p>
          <button type="button" className="wc26-header-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="space-y-1">
          {allLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className="wc26-mobile-menu__link"
            >
              <Icon className="h-5 w-5 text-wc26-yellow" />
              {label}
            </NavLink>
          ))}
        </nav>
        {profile && (
          <p className="mt-4 border-t border-white/10 pt-3 text-xs text-white/50">
            {profile.full_name} · {profile.legajo ?? 'Sin legajo'}
          </p>
        )}
      </div>
    </div>
  )
}
