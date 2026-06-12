import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CreditCard,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  MessageSquareText,
  MoreHorizontal,
  Radar,
  Server,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react'

export type AdminNavItem = {
  to: string
  label: string
  icon: LucideIcon
  searchTerms?: string[]
}

export const ADMIN_MOBILE_PRIMARY: AdminNavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, searchTerms: ['inicio', 'operaciones', 'kpi'] },
  { to: '/admin/users', label: 'Usuarios', icon: Users, searchTerms: ['identidad', 'miembros'] },
  { to: '/admin/scoring', label: 'Scoring', icon: Target, searchTerms: ['puntuar', 'partidos'] },
  { to: '/admin/health', label: 'Salud', icon: HeartPulse, searchTerms: ['sistema', 'health'] },
]

export const ADMIN_MOBILE_MORE: AdminNavItem[] = [
  { to: '/admin/operations', label: 'Operaciones', icon: Radar },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/system', label: 'Sistema', icon: Server },
  { to: '/admin/beta-capacity', label: 'Beta / Capacidad', icon: Gauge },
  { to: '/admin/support', label: 'Soporte', icon: LifeBuoy },
  { to: '/admin/activity', label: 'Actividad', icon: Activity },
  { to: '/admin/notifications', label: 'Notificaciones', icon: Bell },
  { to: '/admin/ticker-content', label: 'Textos del ticker', icon: MessageSquareText, searchTerms: ['ticker', 'tip', 'bienvenida', 'mensaje', 'contenido'] },
  { to: '/admin/scoring-display', label: 'Puntos y ticker', icon: Trophy, searchTerms: ['puntos', 'exacto', 'resultado', 'ticker'] },
  { to: '/admin/cards', label: 'Cards', icon: CreditCard },
  { to: '/admin/live-cards', label: 'Mundial Vivo', icon: Sparkles },
  { to: '/admin/ranking-lore', label: 'Lore ranking', icon: BookOpen, searchTerms: ['narrativa', 'ranking', 'lore'] },
]

export const ADMIN_MOBILE_MORE_TRIGGER: AdminNavItem = {
  to: '#more',
  label: 'Más',
  icon: MoreHorizontal,
}

export const ADMIN_ALL_NAV: AdminNavItem[] = [...ADMIN_MOBILE_PRIMARY, ...ADMIN_MOBILE_MORE]
