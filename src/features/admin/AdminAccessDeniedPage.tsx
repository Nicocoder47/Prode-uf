import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth.tsx'

export default function AdminAccessDeniedPage() {
  const { profile } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712] px-4">
      <div className="mx-auto max-w-lg space-y-4 rounded-[28px] border border-red-400/20 bg-red-500/10 p-8 text-center">
      <h1 className="text-2xl font-extrabold text-white">Acceso restringido</h1>
      <p className="text-sm text-white/70">
        Tu cuenta <strong>{profile?.email}</strong> no tiene permisos de administrador
        {profile?.role ? ` (rol: ${profile.role})` : ''}.
      </p>
      <p className="text-sm text-white/50">
        Solo usuarios con rol <code className="text-amber-200">admin</code> pueden usar el panel.
      </p>
      <Link to="/" className="inline-flex rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/15">
        Volver al prode
      </Link>
      </div>
    </div>
  )
}
