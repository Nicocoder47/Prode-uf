import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PUBLIC_DEMO_ACCESS } from '../config/publicAccess.ts'
import { useAuth } from '../lib/auth.tsx'

export default function ProtectedRoute() {
  const { session, loading, profile } = useAuth()
  const location = useLocation()

  if (PUBLIC_DEMO_ACCESS) {
    return <Outlet />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wc26-cream text-wc26-dark">
        <div className="wc26-card p-8">
          <p className="text-lg font-semibold">Cargando sesión...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const onChangePassword = location.pathname === '/change-password'
  const mustChange = profile?.must_change_password === true

  if (!loading && profile && mustChange && !onChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  if (!loading && profile && !mustChange && onChangePassword) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
