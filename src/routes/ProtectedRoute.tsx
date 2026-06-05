import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'

export default function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

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
    return <Navigate to="/invite" state={{ from: location }} replace />
  }

  return <Outlet />
}
