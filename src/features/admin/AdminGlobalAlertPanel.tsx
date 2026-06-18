import { useEffect, useState } from 'react'
import { PremiumButton } from '../../components/ui/PremiumButton'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { useAppToast } from '../../components/ui/ToastProvider'
import { fetchAdminGlobalAlert, adminUpsertGlobalAlert } from '../../services/globalAlertService'
import type { GlobalAppAlert } from '../../types/globalAlert'

const EMPTY: GlobalAppAlert = {
  kicker: 'Aviso importante',
  title: '',
  message: '',
  is_active: false,
  updated_at: new Date(0).toISOString(),
}

export function AdminGlobalAlertPanel() {
  const { showToast } = useAppToast()
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kicker, setKicker] = useState(EMPTY.kicker)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchAdminGlobalAlert()
        if (cancelled) return
        setKicker(data.kicker)
        setTitle(data.title)
        setMessage(data.message)
        setIsActive(data.is_active)
        setUpdatedAt(data.updated_at)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la alerta global')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const saved = await adminUpsertGlobalAlert({
        kicker,
        title,
        message,
        isActive,
      })
      setKicker(saved.kicker)
      setTitle(saved.title)
      setMessage(saved.message)
      setIsActive(saved.is_active)
      setUpdatedAt(saved.updated_at)
      showToast(isActive ? 'Alerta global activada' : 'Alerta global guardada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PremiumCard
      title="Alerta global destacada"
      description="Modal interno visible al iniciar sesión. No es push externa."
    >
      {loading ? (
        <p className="text-white/60">Cargando…</p>
      ) : (
        <form className="admin-global-alert-form space-y-3" onSubmit={handleSave}>
          <div className="admin-global-alert-form__status">
            <span className={`admin-global-alert-form__badge${isActive ? ' is-active' : ''}`}>
              {isActive ? 'Activa' : 'Desactivada'}
            </span>
            {updatedAt ? (
              <span className="text-xs text-white/45">
                Actualizada {new Date(updatedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            ) : null}
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase tracking-wide text-white/50">Encabezado corto</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="Aviso importante"
              value={kicker}
              onChange={e => setKicker(e.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase tracking-wide text-white/50">Título principal</span>
            <input
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="Ya podés revisar el ranking"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase tracking-wide text-white/50">Mensaje</span>
            <textarea
              required
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="Entrá a ver tu posición y seguí sumando puntos."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </label>

          <label className="admin-global-alert-form__toggle">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
            />
            <span>Mostrar alerta a todos los usuarios al iniciar sesión</span>
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <PremiumButton type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar alerta'}
            </PremiumButton>
            <PremiumButton
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setIsActive(v => !v)}
            >
              {isActive ? 'Marcar desactivada' : 'Marcar activa'}
            </PremiumButton>
          </div>
        </form>
      )}
    </PremiumCard>
  )
}
