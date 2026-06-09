import { useCallback, useEffect, useMemo, useState } from 'react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { fetchAdminUsers } from '../../services/admin/adminService.ts'
import type { AdminUserRow, ReviewStatus } from '../../types/admin.ts'
import { REVIEW_STATUS_CLASS, REVIEW_STATUS_LABEL, reviewRowClass } from '../../utils/reviewStatus.ts'
import { AdminUserDetailDrawer } from './AdminUserDetailDrawer.tsx'

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function accountStatus(u: AdminUserRow) {
  if (u.deleted_at) return { label: 'Eliminado', className: 'text-red-400' }
  if (!u.is_active) return { label: 'Bloqueado', className: 'text-red-300' }
  return { label: 'Activo', className: 'text-emerald-300' }
}

function ReviewBadge({ status }: { status?: ReviewStatus }) {
  const s = status ?? 'pending'
  return <span className={REVIEW_STATUS_CLASS[s]}>{REVIEW_STATUS_LABEL[s]}</span>
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null)

  const [search, setSearch] = useState('')
  const [reviewFilter, setReviewFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [predFilter, setPredFilter] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    fetchAdminUsers()
      .then(setUsers)
      .catch(err => setError(err instanceof Error ? err.message : 'Error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      if (q) {
        const haystack = [u.legajo, u.full_name, u.email, u.dni_masked, u.dni].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (reviewFilter && u.review_status !== reviewFilter) return false
      if (roleFilter && u.role !== roleFilter) return false
      if (accountFilter === 'active' && (u.deleted_at || !u.is_active)) return false
      if (accountFilter === 'blocked' && (u.deleted_at || u.is_active)) return false
      if (accountFilter === 'deleted' && !u.deleted_at) return false
      if (predFilter === 'with' && u.predictions_count <= 0) return false
      if (predFilter === 'without' && u.predictions_count > 0) return false
      return true
    })
  }, [users, search, reviewFilter, accountFilter, roleFilter, predFilter])

  const reviewCount = users.filter(u => u.review_status === 'review_required').length

  return (
    <div className="space-y-6">
      {error && (
        <PremiumCard variant="dark">
          <p className="text-red-300">{error}</p>
        </PremiumCard>
      )}

      {reviewCount > 0 && (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <strong>{reviewCount}</strong> usuario(s) requieren revisión (DNI no encontrado en padrón o datos distintos).
        </div>
      )}

      <PremiumCard title="Filtros" description={`${filtered.length} de ${users.length} usuarios`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white lg:col-span-2"
            placeholder="Buscar legajo, nombre, email o DNI"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={reviewFilter} onChange={e => setReviewFilter(e.target.value)}>
            <option value="">Revisión: todos</option>
            <option value="verified">Verificado</option>
            <option value="review_required">En revisión</option>
            <option value="manually_approved">Aprobado manual</option>
            <option value="rejected">Rechazado</option>
          </select>
          <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={accountFilter} onChange={e => setAccountFilter(e.target.value)}>
            <option value="">Cuenta: todas</option>
            <option value="active">Activos</option>
            <option value="blocked">Bloqueados</option>
            <option value="deleted">Eliminados</option>
          </select>
          <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">Rol: todos</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={predFilter} onChange={e => setPredFilter(e.target.value)}>
            <option value="">Predicciones: todas</option>
            <option value="with">Con predicciones</option>
            <option value="without">Sin predicciones</option>
          </select>
        </div>
      </PremiumCard>

      <PremiumCard title="Usuarios" description="Revisión automática por DNI vs padrón Excel">
        {loading ? (
          <p className="text-white/60">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-white/50">
                  <th className="py-2 pr-3">Revisión</th>
                  <th className="py-2 pr-3">Cuenta</th>
                  <th className="py-2 pr-3">Legajo</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">DNI</th>
                  <th className="py-2 pr-3">Padrón</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Pts</th>
                  <th className="py-2 pr-3">Pred.</th>
                  <th className="py-2 pr-3">Exact.</th>
                  <th className="py-2 pr-3">Aciertos</th>
                  <th className="py-2 pr-3">Login</th>
                  <th className="py-2 pr-3">Alta</th>
                  <th className="py-2 pr-3">Rol</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const st = accountStatus(u)
                  return (
                    <tr key={u.id} className={`border-b border-white/5 ${reviewRowClass(u.review_status)}`}>
                      <td className="py-2 pr-3"><ReviewBadge status={u.review_status} /></td>
                      <td className={`py-2 pr-3 text-xs font-semibold ${st.className}`}>{st.label}</td>
                      <td className="py-2 pr-3 font-semibold text-white">{u.legajo ?? '—'}</td>
                      <td className="py-2 pr-3 text-white">{u.full_name}</td>
                      <td className="py-2 pr-3 font-mono text-white/80">{u.dni_masked}</td>
                      <td className="py-2 pr-3 text-white/70">{u.reference_full_name ?? '—'}</td>
                      <td className="py-2 pr-3 text-white/70">{u.email}</td>
                      <td className="py-2 pr-3 font-bold text-wc26-yellow">{u.total_points}</td>
                      <td className="py-2 pr-3">{u.predictions_count}</td>
                      <td className="py-2 pr-3">{u.exact_predictions ?? 0}</td>
                      <td className="py-2 pr-3">{u.hit_predictions ?? 0}</td>
                      <td className="py-2 pr-3 text-xs text-white/50">{formatDate(u.last_login_at)}</td>
                      <td className="py-2 pr-3 text-xs text-white/50">{formatDate(u.created_at)}</td>
                      <td className="py-2 pr-3 text-xs uppercase text-white/60">{u.role}</td>
                      <td className="py-2">
                        <PremiumButton size="sm" variant="ghost" onClick={() => setDetailUser(u)}>
                          Ver detalle
                        </PremiumButton>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>

      {detailUser && (
        <AdminUserDetailDrawer
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onChanged={reload}
        />
      )}
    </div>
  )
}
