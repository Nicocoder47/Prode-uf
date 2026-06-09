import { useCallback, useEffect, useState } from 'react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { adminUpdateCard, fetchActiveAdminCards } from '../../services/admin/adminService.ts'
import type { AdminCard } from '../../types/admin.ts'

const STATUS_OPTIONS = ['neutral', 'success', 'warning', 'danger'] as const

export default function AdminCardsPage() {
  const [cards, setCards] = useState<AdminCard[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminCard | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    fetchActiveAdminCards()
      .then(setCards)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

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
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PremiumCard title="Cards de la app" description="Visibles en home/dashboard">
        {loading ? (
          <p className="text-white/60">Cargando…</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {cards.map(card => (
              <div key={card.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{card.key}</p>
                    <p className="mt-1 text-xl font-extrabold text-white">{card.value ?? '—'}</p>
                    <p className="font-semibold text-white/90">{card.title}</p>
                    {card.subtitle && <p className="text-xs text-white/50">{card.subtitle}</p>}
                  </div>
                  <PremiumButton size="sm" variant="ghost" onClick={() => setEditing({ ...card })}>
                    Editar
                  </PremiumButton>
                </div>
              </div>
            ))}
          </div>
        )}
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
