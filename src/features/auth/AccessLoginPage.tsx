import { Navigate } from 'react-router-dom'

/** Entrada auth: redirige al login. */
export default function AccessLoginPage() {
  return <Navigate to="/login" replace />
}
