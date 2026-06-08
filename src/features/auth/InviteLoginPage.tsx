import { Navigate } from 'react-router-dom'

/** Legacy route — redirige al login OTP. */
export default function InviteLoginPage() {
  return <Navigate to="/login" replace />
}
