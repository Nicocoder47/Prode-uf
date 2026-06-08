import { Navigate, Outlet } from 'react-router-dom'
import { PUBLIC_DEMO_ACCESS } from '../config/publicAccess.ts'
import { useAuth } from '../lib/auth.tsx'

export default function AdminRoute() {
  const { profile, loading } = useAuth()

  if (PUBLIC_DEMO_ACCESS) {
    return <Outlet />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stadiumNavy text-white">
        <div className="rounded-3xl border border-white/10 bg-surfaceNavy/90 p-8 shadow-glow-cyan">
          <p className="text-lg font-semibold">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  if (profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
