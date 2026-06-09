import { useState } from 'react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { useAppToast } from '../../components/ui/ToastProvider.tsx'
import { adminUpdateCard } from '../../services/admin/adminService.ts'
import { useAdminCards, useInvalidateAdmin } from '../../hooks/useAdminQueries.ts'
import type { AdminCard } from '../../types/admin.ts'

const STATUS_OPTIONS = ['neutral', 'success', 'warning', 'danger'] as const

const statusBorder: Record<AdminCard['status'], string> = {
  neutral: 'border-white/15',
  success: 'border-emerald-400/30',
  warning: 'border-amber-400/30',
  danger: 'border-red-400/30',
}

export default function AdminCardsPage() {
  const { data: cards = [], isLoading, refetch } = useAdminCards()
  const { invalidateCards, invalidateDashboard } = useInvalidateAdmin()
  const { showToast } = useAppToast()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminCard | null>(null)

  const activeCards = cards.filter(c => c.is_active)

  async function toggleActive(card: AdminCard) {
    setBusy(true)
    setError(null)
    try {
      await adminUpdateCard({
        key: card.key,
        title: card.title,
        value: card.value ?? undefined,
        subtitle: card.subtitle ?? undefined,
        description: card.description ?? undefined,
        icon: card.icon ?? undefined,
        status: card.status,
        orderIndex: card.order_index,
        isActive: !card.is_active,
      })
      invalidateCards()
      invalidateDashboard()
      await refetch()
      showToast(card.is_active ? 'Card desactivada' : 'Card activada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      await adminUpdateCard({
        key: editing.key,
        title: editing.title,
        value: editing.value ?? undefined,
        subtitle: editing.subtitle ?? undefined,
        description: editing.description ?? undefined,
        icon: editing.icon ?? undefined,
        status: editing.status,
        orderIndex: editing.order_index,
        isActive: editing.is_active,
      })
      setEditing(null)
      invalidateCards()
      invalidateDashboard()
      await refetch()
      showToast('Card actualizada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Contenido</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Cards</h2>
      </div>

      <PremiumCard title="Vista previa en app" description="Así se ven las cards activas en el home">
        {activeCards.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {activeCards.map(card => (
              <div
                key={card.id}
                className={`rounded-2xl border bg-white/5 p-3 ${statusBorder[card.status] ?? statusBorder.neutral}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{card.title}</p>
                <p className="mt-1 text-lg font-extrabold text-white">{card.value ?? '—'}</p>
                {card.subtitle && <p className="text-[11px] text-white/55">{card.subtitle}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/50">No hay cards activas</p>
        )}
      </PremiumCard>

      <PremiumCard title="Gestión de cards" description="Activar/desactivar y editar contenido">
        {isLoading ? (
          <p className="text-white/60">Cargando…</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {cards.map(card => (
              <div
                key={card.id}
                className={`rounded-2xl border p-4 ${card.is_active ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.03] opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{card.key}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${card.is_active ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/40'}`}>
                        {card.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <p className="mt-1 text-xl font-extrabold text-white">{card.value ?? '—'}</p>
                    <p className="font-semibold text-white/90">{card.title}</p>
                    {card.subtitle && <p className="text-xs text-white/50">{card.subtitle}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={() => toggleActive(card)}>
                      {card.is_active ? 'Desactivar' : 'Activar'}
                    </PremiumButton>
                    <PremiumButton size="sm" variant="ghost" onClick={() => setEditing({ ...card })}>
                      Editar
                    </PremiumButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </PremiumCard>

      {editing && (
        <PremiumCard title={`Editar: ${editing.key}`}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSave}>
            <label className="space-y-1 text-sm">
              <span className="text-white/50">Key</span>
              <input disabled className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white" value={editing.key} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-white/50">Título</span>
              <input required className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-white/50">Valor</span>
              <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white" value={editing.value ?? ''} onChange={e => setEditing({ ...editing, value: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-white/50">Subtítulo</span>
              <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white" value={editing.subtitle ?? ''} onChange={e => setEditing({ ...editing, subtitle: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-white/50">Descripción</span>
              <textarea rows={2} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white" value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-white/50">Icono</span>
              <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white" value={editing.icon ?? ''} onChange={e => setEditing({ ...editing, icon: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-white/50">Estado</span>
              <select className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as AdminCard['status'] })}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-white/50">Orden</span>
              <input type="number" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white" value={editing.order_index} onChange={e => setEditing({ ...editing, order_index: Number(e.target.value) })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-white">
              <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />
              Activa
            </label>
            {error && <p className="sm:col-span-2 text-sm text-red-300">{error}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <PremiumButton type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</PremiumButton>
              <PremiumButton type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</PremiumButton>
            </div>
          </form>
        </PremiumCard>
      )}
    </div>
  )
}
