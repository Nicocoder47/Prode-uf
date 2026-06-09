import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Activity, Bell, CreditCard, LayoutDashboard, Users } from 'lucide-react'
import { getAdminDataMode } from '../../services/admin/adminService.ts'
import AdminActivityPage from './AdminActivityPage.tsx'
import AdminCardsPage from './AdminCardsPage.tsx'
import AdminDashboardPage from './AdminDashboardPage.tsx'
import AdminNotificationsPage from './AdminNotificationsPage.tsx'
import AdminUsersPage from './AdminUsersPage.tsx'

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function AdminUnifiedPage() {
  const location = useLocation()
  const [mode, setMode] = useState<'rpc' | 'fallback'>('rpc')

  useEffect(() => {
    setMode(getAdminDataMode())
  }, [location.pathname, location.hash])
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '')
      window.setTimeout(() => scrollToSection(id), 150)
    }
  }, [location.hash])

  return (
    <div className="space-y-8 pb-8">
      {mode === 'fallback' && (
        <div className="admin-migration-banner">
          <strong>Modo básico activo.</strong> Usuarios y KPIs funcionan. Para activity logs, notificaciones y cards
          completas, aplicá la migración SQL con <code>npm run db:push:cloud</code> (requiere{' '}
          <code>SUPABASE_DB_PASSWORD</code> en <code>.env.cloud</code>).
        </div>
      )}

      <section id="dashboard" className="scroll-mt-24 admin-section-card space-y-4">        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <LayoutDashboard className="h-5 w-5 text-wc26-yellow" />
          <h2 className="text-xl font-extrabold text-white">Dashboard</h2>
        </div>
        <AdminDashboardPage />
      </section>

      <section id="users" className="scroll-mt-24 admin-section-card space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Users className="h-5 w-5 text-wc26-yellow" />
          <h2 className="text-xl font-extrabold text-white">Usuarios</h2>
        </div>
        <AdminUsersPage />
      </section>

      <section id="activity" className="scroll-mt-24 admin-section-card space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Activity className="h-5 w-5 text-wc26-yellow" />
          <h2 className="text-xl font-extrabold text-white">Actividad</h2>
        </div>
        <AdminActivityPage />
      </section>

      <section id="notifications" className="scroll-mt-24 admin-section-card space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Bell className="h-5 w-5 text-wc26-yellow" />
          <h2 className="text-xl font-extrabold text-white">Notificaciones</h2>
        </div>
        <AdminNotificationsPage />
      </section>

      <section id="cards" className="scroll-mt-24 admin-section-card space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <CreditCard className="h-5 w-5 text-wc26-yellow" />
          <h2 className="text-xl font-extrabold text-white">Cards del home</h2>
        </div>
        <AdminCardsPage />
      </section>
    </div>
  )
}
