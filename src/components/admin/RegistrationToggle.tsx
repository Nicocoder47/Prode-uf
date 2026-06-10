import { useState } from 'react'
import { PremiumButton } from '../ui/PremiumButton'
import { adminSetRegistrationStatus } from '../../services/admin/adminService'
import { useInvalidateAdmin } from '../../hooks/useAdminQueries'

type Props = {
  enabled: boolean
  suggestClose?: boolean
  onChanged?: () => void
}

export function RegistrationToggle({ enabled, suggestClose, onChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { invalidateAll } = useInvalidateAdmin()

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      await adminSetRegistrationStatus(!enabled)
      invalidateAll()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/50">Control de invitaciones</p>
          <p className="mt-1 text-lg font-extrabold text-white">
            {enabled ? 'Invitaciones abiertas' : 'Invitaciones cerradas'}
          </p>
          {suggestClose && enabled && (
            <p className="mt-1 text-sm text-amber-200">Recomendado: cerrar invitaciones por capacidad beta.</p>
          )}
        </div>
        <PremiumButton
          size="sm"
          variant={enabled ? 'danger' : 'primary'}
          disabled={busy}
          onClick={toggle}
        >
          {enabled ? 'Cerrar invitaciones' : 'Abrir invitaciones'}
        </PremiumButton>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  )
}
