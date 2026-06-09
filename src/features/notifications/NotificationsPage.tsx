import { useEffect, useState } from 'react'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { fetchMyNotifications, markNotificationRead } from '../../services/admin/adminService.ts'
import type { AppNotification } from '../../types/admin.ts'

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  function reload() {
    setLoading(true)
    fetchMyNotifications()
      .then(setItems)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  async function handleRead(n: AppNotification) {
    if (n.is_read) return
    await markNotificationRead(n.id)
    reload()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-wc26-yellow">Avisos</p>
        <h1 className="text-2xl font-extrabold text-white">Notificaciones</h1>
      </div>

      {loading ? (
        <p className="text-white/60">Cargando…</p>
      ) : items.length === 0 ? (
        <PremiumCard variant="dark">
          <p className="text-white/60">No tenés notificaciones por ahora.</p>
        </PremiumCard>
      ) : (
        items.map(n => (
          <PremiumCard
            key={n.id}
            variant={n.is_read ? 'default' : 'premium'}
            className="cursor-pointer"
            onClick={() => handleRead(n)}
            interactive
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-extrabold text-white">{n.title}</p>
                <p className="mt-1 text-sm text-white/80">{n.message}</p>
                <p className="mt-2 text-xs text-white/40">{formatDate(n.created_at)}</p>
              </div>
              {!n.is_read && (
                <span className="rounded-full bg-wc26-yellow px-2 py-0.5 text-[10px] font-bold text-[#1a1200]">
                  Nuevo
                </span>
              )}
            </div>
          </PremiumCard>
        ))
      )}
    </div>
  )
}
