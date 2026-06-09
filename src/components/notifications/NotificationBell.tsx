import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { fetchMyNotifications, markNotificationRead } from '../../services/admin/adminService.ts'
import type { AppNotification } from '../../types/admin.ts'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const reload = useCallback(() => {
    fetchMyNotifications().then(setItems).catch(() => setItems([]))
  }, [])

  useEffect(() => {
    reload()
    const id = window.setInterval(reload, 60000)
    return () => window.clearInterval(id)
  }, [reload])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const unread = items.filter(n => !n.is_read).length

  async function handleRead(id: string) {
    await markNotificationRead(id)
    reload()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="wc26-header-icon-btn relative"
        aria-label="Notificaciones"
        onClick={() => setOpen(v => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-white/[0.05] p-3 shadow-xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-extrabold text-white">Notificaciones</p>
            <Link to="/notifications" className="text-xs font-bold text-wc26-yellow" onClick={() => setOpen(false)}>
              Ver todas
            </Link>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-white/50">Sin notificaciones</p>
            ) : (
              items.slice(0, 8).map(n => (
                <button
                  key={n.id}
                  type="button"
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    n.is_read ? 'border-white/5 bg-white/5' : 'border-wc26-yellow/30 bg-wc26-yellow/10'
                  }`}
                  onClick={() => !n.is_read && handleRead(n.id)}
                >
                  <p className="font-semibold text-white">{n.title}</p>
                  <p className="text-xs text-white/70">{n.message}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
