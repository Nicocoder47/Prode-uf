import { Navigate, useLocation } from 'react-router-dom'

const HASH_ROUTES: Record<string, string> = {
  dashboard: '/admin/dashboard',
  users: '/admin/users',
  activity: '/admin/activity',
  notifications: '/admin/notifications',
  cards: '/admin/cards',
  system: '/admin/system',
}

/** Compatibilidad con URLs legacy `/admin#users`. */
export default function AdminHashRedirect() {
  const location = useLocation()
  const hash = location.hash.replace('#', '').trim()
  if (hash && HASH_ROUTES[hash]) {
    return <Navigate to={HASH_ROUTES[hash]} replace />
  }
  return <Navigate to="/admin/dashboard" replace />
}
