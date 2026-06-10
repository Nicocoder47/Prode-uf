import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PremiumButton } from '../../components/ui/PremiumButton'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { completePasswordChange } from '../../services/admin/adminService'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { normalizeDni } from '../../utils/registration'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const dni = profile?.dni ? normalizeDni(profile.dni) : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (dni && password === dni) {
      setError('La nueva contraseña no puede ser igual a tu DNI.')
      return
    }

    setBusy(true)
    try {
      const { error: authErr } = await supabase.auth.updateUser({ password })
      if (authErr) throw authErr
      await completePasswordChange()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-wc26-cream px-4">
      <PremiumCard title="Cambiar contraseña" description="Por seguridad, actualizá tu contraseña antes de continuar." className="w-full max-w-md">
        <p className="mb-4 text-sm text-white/70">
          Cuenta: {user?.email ?? profile?.email}
        </p>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Nueva contraseña (mín. 8)"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Confirmar contraseña"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <PremiumButton type="submit" disabled={busy} className="w-full">
            {busy ? 'Guardando…' : 'Guardar y continuar'}
          </PremiumButton>
        </form>
      </PremiumCard>
    </div>
  )
}
