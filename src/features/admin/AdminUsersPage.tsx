import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { useAdminUsers, useInvalidateAdmin } from '../../hooks/useAdminQueries.ts'
import type { AdminUserRow, ReviewStatus } from '../../types/admin.ts'
import { REVIEW_STATUS_CLASS, REVIEW_STATUS_LABEL, reviewRowClass } from '../../utils/reviewStatus.ts'
import { isTestUserEmail } from '../../utils/adminTestUser.ts'
import { downloadCsv } from '../../utils/exportCsv'
import { AdminUserDetailDrawer } from './AdminUserDetailDrawer.tsx'

const PAGE_SIZE = 25

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function isToday(value: string | null) {
  if (!value) return false
  const d = new Date(value)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function accountStatus(u: AdminUserRow) {
  if (u.deleted_at) return { label: 'Eliminado', className: 'text-red-400' }
  if (u.is_blocked || !u.is_active) return { label: 'Bloqueado', className: 'text-red-300' }
  return { label: 'Activo', className: 'text-emerald-300' }
}

function isTestUser(u: AdminUserRow) {
  return u.is_test_user ?? isTestUserEmail(u.email)
}

function ReviewBadge({ status }: { status?: ReviewStatus }) {
  const s = status ?? 'pending'
  return <span className={REVIEW_STATUS_CLASS[s]}>{REVIEW_STATUS_LABEL[s]}</span>
}

export default function AdminUsersPage() {
  const { data: users = [], isLoading, error, refetch } = useAdminUsers()
  const { invalidateUsers, invalidateBetaOverview, invalidateDashboard } = useInvalidateAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null)
  const [page, setPage] = useState(0)

  const [search, setSearch] = useState('')
  const [reviewFilter, setReviewFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [predFilter, setPredFilter] = useState('')
  const [passwordFilter, setPasswordFilter] = useState('')
  const [active7dFilter, setActive7dFilter] = useState(false)
  const [testFilter, setTestFilter] = useState('')
  const [todayFilter, setTodayFilter] = useState(false)
  const [noLoginFilter, setNoLoginFilter] = useState(false)

  useEffect(() => {
    const userId = searchParams.get('userId')
    if (userId && users.length) {
      const found = users.find(u => u.id === userId)
      if (found) setDetailUser(found)
    }
  }, [searchParams, users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      if (q) {
        const haystack = [u.legajo, u.full_name, u.email, u.dni_masked].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (passwordFilter === 'must' && !u.must_change_password) return false
      if (passwordFilter === 'ok' && u.must_change_password) return false
      if (active7dFilter && !u.active_last_7d) return false
      if (reviewFilter && u.review_status !== reviewFilter) return false
      if (roleFilter && u.role !== roleFilter) return false
      if (accountFilter === 'active' && (u.deleted_at || !u.is_active)) return false
      if (accountFilter === 'blocked' && (u.deleted_at || (!u.is_blocked && u.is_active))) return false
      if (accountFilter === 'deleted' && !u.deleted_at) return false
      if (predFilter === 'with' && u.predictions_count <= 0) return false
      if (predFilter === 'without' && u.predictions_count > 0) return false
      if (testFilter === 'test' && !isTestUser(u)) return false
      if (testFilter === 'real' && isTestUser(u)) return false
      if (todayFilter && !u.registered_today && !isToday(u.created_at)) return false
      if (noLoginFilter && u.last_login_at) return false
      return true
    })
  }, [users, search, reviewFilter, accountFilter, roleFilter, predFilter, passwordFilter, active7dFilter, testFilter, todayFilter, noLoginFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageUsers = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  function exportCsv() {
    downloadCsv(
      `usuarios-${new Date().toISOString().slice(0, 10)}.csv`,
      ['legajo', 'nombre', 'email', 'dni_masked', 'rol', 'estado', 'predicciones', 'puntos'],
      filtered.map(u => [
        u.legajo ?? '',
        u.full_name,
        u.email,
        u.dni_masked,
        u.role,
        u.deleted_at ? 'desactivado' : u.is_blocked ? 'bloqueado' : 'activo',
        String(u.predictions_count),
        String(u.total_points),
      ]),
    )
  }

  const reviewCount = users.filter(u => u.review_status === 'review_required').length

  function handleChanged() {
    invalidateUsers()
    invalidateBetaOverview()
    invalidateDashboard()
    refetch()
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Identidad</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Usuarios</h2>
      </div>

      {error && (
        <PremiumCard variant="dark">
          <p className="text-red-300">{error instanceof Error ? error.message : 'Error'}</p>
        </PremiumCard>
      )}

      {reviewCount > 0 && (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <strong>{reviewCount}</strong> usuario(s) requieren revisión (DNI no encontrado en padrón o datos distintos).
        </div>
      )}

      <PremiumCard title="Filtros" description={`${filtered.length} de ${users.length} usuarios`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <PremiumButton size="sm" variant="ghost" onClick={exportCsv}>Exportar CSV</PremiumButton>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
          <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={passwordFilter} onChange={e => setPasswordFilter(e.target.value)}>
            <option value="">Contraseña: todas</option>
            <option value="must">Debe cambiar</option>
            <option value="ok">Actualizada</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
            <input type="checkbox" checked={active7dFilter} onChange={e => setActive7dFilter(e.target.checked)} />
            Activos 7d
          </label>
          <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={testFilter} onChange={e => setTestFilter(e.target.value)}>
            <option value="">Tipo: todos</option>
            <option value="real">Usuarios reales</option>
            <option value="test">Usuarios de prueba</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
            <input type="checkbox" checked={todayFilter} onChange={e => setTodayFilter(e.target.checked)} />
            Registrados hoy
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
            <input type="checkbox" checked={noLoginFilter} onChange={e => setNoLoginFilter(e.target.checked)} />
            Sin login
          </label>
        </div>
      </PremiumCard>

      <PremiumCard title="Usuarios" description="Revisión automática por DNI vs padrón Excel">
        {isLoading ? (
          <p className="text-white/60">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-white/50">
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">DNI</th>
                  <th className="py-2 pr-3">Padrón</th>
                  <th className="py-2 pr-3">Pred.</th>
                  <th className="py-2 pr-3">Pts</th>
                  <th className="py-2 pr-3">Login</th>
                  <th className="py-2 pr-3">Alta</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Rol</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.map(u => {
                  const st = accountStatus(u)
                  const test = isTestUser(u)
                  return (
                    <tr key={u.id} className={`border-b border-white/5 ${reviewRowClass(u.review_status)}`}>
                      <td className="py-2 pr-3 text-white">
                        <div className="font-semibold">{u.full_name}</div>
                        <div className="text-xs text-white/45">{u.legajo ?? '—'}</div>
                        {test && <span className="mt-1 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">Test</span>}
                      </td>
                      <td className="py-2 pr-3 text-white/70 text-xs">{u.email}</td>
                      <td className="py-2 pr-3 font-mono text-white/80">{u.dni_masked}</td>
                      <td className="py-2 pr-3"><ReviewBadge status={u.review_status} /></td>
                      <td className="py-2 pr-3">{u.predictions_count}</td>
                      <td className="py-2 pr-3 font-bold text-wc26-yellow">{u.total_points}</td>
                      <td className="py-2 pr-3 text-xs text-white/50">{formatDate(u.last_login_at)}</td>
                      <td className="py-2 pr-3 text-xs text-white/50">{formatDate(u.created_at)}</td>
                      <td className={`py-2 pr-3 text-xs font-semibold ${st.className}`}>{st.label}</td>
                      <td className="py-2 pr-3 text-xs uppercase text-white/60">{u.role}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          <PremiumButton size="sm" variant="ghost" onClick={() => { setDetailUser(u); setSearchParams({ userId: u.id }) }}>
                            Ver
                          </PremiumButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="mt-4 flex items-center justify-between text-sm text-white/60">
              <span>Página {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <PremiumButton size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</PremiumButton>
                <PremiumButton size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Siguiente</PremiumButton>
              </div>
            </div>
          </div>
        )}
      </PremiumCard>

      {detailUser && (
        <AdminUserDetailDrawer
          user={detailUser}
          onClose={() => { setDetailUser(null); setSearchParams({}) }}
          onChanged={handleChanged}
        />
      )}
    </div>
  )
}
