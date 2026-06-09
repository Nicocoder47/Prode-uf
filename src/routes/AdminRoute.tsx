import { Navigate, Outlet } from 'react-router-dom'
import { PUBLIC_DEMO_ACCESS } from '../config/publicAccess.ts'
import { useAuth } from '../lib/auth.tsx'
import AdminAccessDeniedPage from '../features/admin/AdminAccessDeniedPage.tsx'

export default function AdminRoute() {
  const { profile, loading } = useAuth()

  if (PUBLIC_DEMO_ACCESS) {
    return <Outlet />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] text-white">
        <div className="rounded-3xl border border-amber-400/20 bg-black/40 p-8">
          <p className="text-lg font-semibold">Verificando permisos de admin…</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  if (profile.role !== 'admin') {
    return <AdminAccessDeniedPage />
  }

  return <Outlet />
}
