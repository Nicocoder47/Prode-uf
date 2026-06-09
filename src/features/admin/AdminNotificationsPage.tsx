import { useCallback, useEffect, useState } from 'react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { adminCreateNotification, fetchAdminNotifications, fetchAdminUsers } from '../../services/admin/adminService.ts'
import type { AdminNotificationRow, AdminUserRow } from '../../types/admin.ts'

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<AdminNotificationRow[]>([])
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetType, setTargetType] = useState<'all' | 'user' | 'role'>('all')
  const [targetUserId, setTargetUserId] = useState('')
  const [targetRole, setTargetRole] = useState('member')
  const [expiresAt, setExpiresAt] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [notifs, userRows] = await Promise.all([fetchAdminNotifications(), fetchAdminUsers()])
      setItems(notifs)
      setUsers(userRows.filter(u => !u.deleted_at))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adminCreateNotification({
        title,
        message,
        targetType,
        targetUserId: targetType === 'user' ? targetUserId : undefined,
        targetRole: targetType === 'role' ? targetRole : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      })
      setTitle('')
      setMessage('')
      setExpiresAt('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PremiumCard title="Nueva notificación">
        <form className="space-y-3" onSubmit={handleCreate}>
          <input
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Título"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            required
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Mensaje"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <select
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={targetType}
            onChange={e => setTargetType(e.target.value as 'all' | 'user' | 'role')}
          >
            <option value="all">Todos los usuarios</option>
            <option value="user">Usuario específico</option>
            <option value="role">Por rol</option>
          </select>
          {targetType === 'user' && (
            <select
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={targetUserId}
              onChange={e => setTargetUserId(e.target.value)}
            >
              <option value="">Seleccionar usuario</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.legajo})</option>
              ))}
            </select>
          )}
          {targetType === 'role' && (
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
            >
              <option value="member">Jugadores (member)</option>
              <option value="admin">Administradores</option>
            </select>
          )}
          <input
            type="datetime-local"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <PremiumButton type="submit" disabled={busy}>
            {busy ? 'Enviando…' : 'Crear notificación'}
          </PremiumButton>
        </form>
      </PremiumCard>

      <PremiumCard title="Notificaciones" description="Activas e históricas">
        {loading ? (
          <p className="text-white/60">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-white/50">
                  <th className="py-2 pr-3">Título</th>
                  <th className="py-2 pr-3">Destino</th>
                  <th className="py-2 pr-3">Creador</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Lecturas</th>
                  <th className="py-2">Activa</th>
                </tr>
              </thead>
              <tbody>
                {items.map(n => (
                  <tr key={n.id} className="border-b border-white/5">
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-white">{n.title}</p>
                      <p className="text-xs text-white/50">{n.message}</p>
                    </td>
                    <td className="py-2 pr-3 text-white/70">
                      {n.target_type === 'all' && 'Todos'}
                      {n.target_type === 'user' && (n.target_user_name ?? n.target_user_id)}
                      {n.target_type === 'role' && `Rol: ${n.target_role}`}
                    </td>
                    <td className="py-2 pr-3 text-white/70">{n.creator_name ?? '—'}</td>
                    <td className="py-2 pr-3 text-xs text-white/50">{formatDate(n.created_at)}</td>
                    <td className="py-2 pr-3">{n.read_count}</td>
                    <td className="py-2">{n.is_active ? 'Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>
    </div>
  )
}
