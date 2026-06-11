import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completePasswordChange } from '../../services/admin/adminService'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { normalizeDni } from '../../utils/registration'
import { AuthField, AuthShell } from './AuthShell.tsx'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { profile, user, loading, refreshProfile } = useAuth()
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
      await refreshProfile()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !profile) {
    return (
      <AuthShell>
        <p className="wc26-login-muted text-sm">Cargando tu cuenta…</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h2 className="wc26-login-heading mb-1">Cambiar contraseña</h2>
      <p className="wc26-login-muted mb-4 text-sm">
        Por seguridad, actualizá tu contraseña antes de continuar.
      </p>
      <p className="wc26-login-muted mb-4 text-sm">
        Cuenta: {user?.email ?? profile?.email}
      </p>

      <form className="space-y-2" onSubmit={handleSubmit}>
        <AuthField label="Nueva contraseña (mín. 8)" id="new-password" required>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            className="wc26-login-input"
            placeholder="Nueva contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </AuthField>

        <AuthField label="Confirmar contraseña" id="confirm-password" required>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            className="wc26-login-input"
            placeholder="Repetí la contraseña"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </AuthField>

        {error ? (
          <p className="rounded-2xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <button type="submit" className="wc26-login-primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </form>
    </AuthShell>
  )
}
