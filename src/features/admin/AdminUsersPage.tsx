import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eraser, SlidersHorizontal } from 'lucide-react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { useAdminUsers, useInvalidateAdmin } from '../../hooks/useAdminQueries.ts'
import { useAdminMobile } from '../../hooks/useAdminMobile.ts'
import type { AdminUserRow } from '../../types/admin.ts'
import { isTestUserEmail } from '../../utils/adminTestUser.ts'
import {
  adminUserToneRowClass,
  getAccountStateLabel,
  getVerificationListLabel,
} from '../../utils/adminUserVisualStatus.ts'
import { downloadCsv } from '../../utils/exportCsv'
import { AdminUserMobileCard } from '../../components/admin/mobile/AdminUserMobileCard.tsx'
import { AdminUsersFiltersSheet } from '../../components/admin/mobile/AdminUsersFiltersSheet.tsx'
import { AdminUsersMobileStats } from '../../components/admin/mobile/AdminUsersMobileStats.tsx'
import { AdminUsersFiltersPanel } from '../../components/admin/AdminUsersFiltersPanel.tsx'
import { EMPTY_ADMIN_USERS_FILTERS, countActiveAdminUserFilters } from '../../components/admin/AdminUsersFilterState.ts'
import { AdminUserDetailPanel } from '../../components/admin/users/AdminUserDetailPanel.tsx'
import { AdminUserDetailSheet } from '../../components/admin/users/AdminUserDetailSheet.tsx'

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

function isTestUser(u: AdminUserRow) {
  return u.is_test_user ?? isTestUserEmail(u.email)
}

export default function AdminUsersPage() {
  const isMobile = useAdminMobile()
  const { data: users = [], isLoading, error, refetch } = useAdminUsers()
  const { invalidateUsers, invalidateBetaOverview, invalidateDashboard } = useInvalidateAdmin()
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)

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

  const filterState = {
    reviewFilter,
    accountFilter,
    roleFilter,
    predFilter,
    passwordFilter,
    active7dFilter,
    testFilter,
    todayFilter,
    noLoginFilter,
  }

  const activeFilterCount = countActiveAdminUserFilters(search, filterState)

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
  const selectedUser = users.find(u => u.id === selectedUserId) ?? null
  const reviewCount = users.filter(u => u.review_status === 'review_required').length

  useEffect(() => {
    const userId = searchParams.get('userId')
    if (!userId || !users.length) return
    const found = users.find(u => u.id === userId)
    if (!found) return
    setSelectedUserId(found.id)
    if (isMobile) setMobileSheetOpen(true)
  }, [searchParams, users, isMobile])

  function handleChanged() {
    invalidateUsers()
    invalidateBetaOverview()
    invalidateDashboard()
    refetch()
  }

  function resetFilters() {
    setSearch('')
    setReviewFilter('')
    setAccountFilter('')
    setRoleFilter('')
    setPredFilter('')
    setPasswordFilter('')
    setActive7dFilter(false)
    setTestFilter('')
    setTodayFilter(false)
    setNoLoginFilter(false)
    setPage(0)
  }

  function applyFilterPatch(patch: Partial<typeof filterState>) {
    if ('reviewFilter' in patch) setReviewFilter(patch.reviewFilter ?? '')
    if ('accountFilter' in patch) setAccountFilter(patch.accountFilter ?? '')
    if ('roleFilter' in patch) setRoleFilter(patch.roleFilter ?? '')
    if ('predFilter' in patch) setPredFilter(patch.predFilter ?? '')
    if ('passwordFilter' in patch) setPasswordFilter(patch.passwordFilter ?? '')
    if ('active7dFilter' in patch) setActive7dFilter(patch.active7dFilter ?? false)
    if ('testFilter' in patch) setTestFilter(patch.testFilter ?? '')
    if ('todayFilter' in patch) setTodayFilter(patch.todayFilter ?? false)
    if ('noLoginFilter' in patch) setNoLoginFilter(patch.noLoginFilter ?? false)
    setPage(0)
  }

  function clearFilterChip(key: string) {
    if (key === 'search') { setSearch(''); setPage(0); return }
    applyFilterPatch({ [key]: EMPTY_ADMIN_USERS_FILTERS[key as keyof typeof EMPTY_ADMIN_USERS_FILTERS] } as Partial<typeof filterState>)
  }

  function selectUser(u: AdminUserRow, openMobileSheet = false) {
    setSelectedUserId(u.id)
    setSearchParams({ userId: u.id })
    if (openMobileSheet || isMobile) setMobileSheetOpen(true)
  }

  function closeDetail() {
    setSelectedUserId(null)
    setMobileSheetOpen(false)
    setSearchParams({})
  }

  function exportCsv() {
    downloadCsv(
      `usuarios-${new Date().toISOString().slice(0, 10)}.csv`,
      ['legajo', 'nombre', 'email', 'dni_masked', 'estado', 'verificacion', 'ultimo_login'],
      filtered.map(u => [
        u.legajo ?? '',
        u.full_name,
        u.email,
        u.dni_masked,
        getAccountStateLabel(u),
        getVerificationListLabel(u),
        u.last_login_at ?? '',
      ]),
    )
  }

  const listContent = isLoading ? (
    <p className="p-4 text-sm text-white/50">Cargando usuarios…</p>
  ) : pageUsers.length === 0 ? (
    <div className="admin-users-empty-premium">
      <p className="admin-users-empty-premium__title">Sin resultados</p>
      <p className="admin-users-empty-premium__hint">Probá otro término o limpiá los filtros.</p>
      <PremiumButton size="sm" variant="ghost" onClick={resetFilters}>Limpiar filtros</PremiumButton>
    </div>
  ) : (
    <>
      <table className="admin-users-table-v2 w-full text-left text-sm">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Legajo</th>
            <th>DNI</th>
            <th>Estado</th>
            <th>Verificación</th>
            <th>Último login</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {pageUsers.map(u => {
            const tone = adminUserToneRowClass(u)
            const isSelected = selectedUserId === u.id
            return (
              <tr
                key={u.id}
                className={`${tone}${isSelected ? ' is-selected' : ''}`}
                onClick={() => selectUser(u)}
              >
                <td>
                  <p className="admin-users-table-v2__name">{u.full_name}</p>
                  <p className="admin-users-table-v2__sub">{u.email}</p>
                </td>
                <td className="font-mono text-xs">{u.legajo ?? '—'}</td>
                <td className="font-mono text-xs">{u.dni_masked}</td>
                <td className="text-xs">{getAccountStateLabel(u)}</td>
                <td>
                  <span className={`admin-users-table-v2__verification admin-users-table-v2__verification--${tone.replace('admin-user-tone--', '')}`}>
                    {getVerificationListLabel(u)}
                  </span>
                </td>
                <td className="text-xs text-white/55">{formatDate(u.last_login_at)}</td>
                <td>
                  <PremiumButton
                    size="sm"
                    variant="ghost"
                    onClick={e => { e.stopPropagation(); selectUser(u) }}
                  >
                    Ver detalles
                  </PremiumButton>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {filtered.length > PAGE_SIZE && (
        <div className="admin-users-table-v2__pager">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <PremiumButton size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</PremiumButton>
            <PremiumButton size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Siguiente</PremiumButton>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className="admin-users-page space-y-4">
      <header className="hidden md:block">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Identidad</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Usuarios</h2>
        <p className="mt-1 text-sm text-white/50">Revisión automática por DNI vs padrón Excel</p>
      </header>

      <div className="md:hidden">
        <AdminUsersMobileStats users={users} filteredCount={filtered.length} />
      </div>

      {error && (
        <PremiumCard variant="dark">
          <p className="text-red-300">{error instanceof Error ? error.message : 'Error'}</p>
        </PremiumCard>
      )}

      {reviewCount > 0 && (
        <div className="admin-users-review-banner md:rounded-2xl md:border md:border-red-400/30 md:bg-red-500/10 md:px-4 md:py-3 md:text-sm md:text-red-100">
          <strong>{reviewCount}</strong> usuario(s) requieren revisión (DNI no encontrado en padrón o datos distintos).
        </div>
      )}

      <div className="admin-users-mobile-toolbar sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-20 -mx-1 space-y-2 border-b border-white/10 bg-[#041418]/95 px-1 py-2 backdrop-blur-xl md:hidden">
        <input
          className="admin-users-mobile-toolbar__search"
          placeholder="Buscar legajo, nombre, email o DNI"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">
            {filtered.length} de {users.length}
            {activeFilterCount > 0 && <span className="ml-1 text-amber-300/90">· {activeFilterCount} filtro{activeFilterCount === 1 ? '' : 's'}</span>}
          </span>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button type="button" className="admin-users-mobile-toolbar__clear" onClick={resetFilters} title="Limpiar filtros">
                <Eraser className="h-4 w-4" />
              </button>
            )}
            <button type="button" className="admin-users-mobile-toolbar__filters" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && <span className="admin-users-mobile-toolbar__filters-badge">{activeFilterCount}</span>}
            </button>
          </div>
        </div>
      </div>

      <AdminUsersFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filterState}
        activeFilterCount={activeFilterCount}
        onChange={applyFilterPatch}
        onReset={resetFilters}
        resultCount={filtered.length}
        totalCount={users.length}
      />

      <PremiumCard title="Filtros" description={`${filtered.length} de ${users.length} usuarios`} className="hidden md:block">
        <div className="mb-3 flex flex-wrap gap-2">
          <PremiumButton size="sm" variant="ghost" onClick={exportCsv}>Exportar CSV</PremiumButton>
          {activeFilterCount > 0 && (
            <PremiumButton size="sm" variant="ghost" onClick={resetFilters}>
              <Eraser className="h-3.5 w-3.5" />
              Limpiar filtros
            </PremiumButton>
          )}
        </div>
        <AdminUsersFiltersPanel
          search={search}
          filters={filterState}
          onSearchChange={value => { setSearch(value); setPage(0) }}
          onFilterChange={applyFilterPatch}
          onClearChip={clearFilterChip}
          onClearAll={resetFilters}
        />
      </PremiumCard>

      {/* Mobile: cards */}
      <div className="admin-users-mobile-list md:hidden">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="admin-user-mobile-card-v2 admin-user-tone--gray admin-user-mobile-card-v2--skeleton" />
          ))
        ) : (
          pageUsers.map(u => (
            <AdminUserMobileCard
              key={u.id}
              user={u}
              selected={selectedUserId === u.id}
              onViewDetails={() => selectUser(u, true)}
            />
          ))
        )}
        {!isLoading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-white/60">
            <span>Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <PremiumButton size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</PremiumButton>
              <PremiumButton size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Siguiente</PremiumButton>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: split list + fixed detail panel */}
      <div className="admin-users-split hidden md:grid">
        <PremiumCard className="admin-users-split__list !p-0 overflow-hidden">
          {listContent}
        </PremiumCard>
        <aside className="admin-users-split__detail">
          {selectedUser ? (
            <AdminUserDetailPanel
              user={selectedUser}
              onClose={closeDetail}
              onChanged={handleChanged}
              variant="panel"
            />
          ) : (
            <div className="admin-users-split__placeholder">
              <p className="admin-users-split__placeholder-title">Detalle de usuario</p>
              <p className="admin-users-split__placeholder-hint">Seleccioná un usuario de la lista o tocá «Ver detalles».</p>
            </div>
          )}
        </aside>
      </div>

      {mobileSheetOpen && selectedUser && (
        <AdminUserDetailSheet
          user={selectedUser}
          onClose={closeDetail}
          onChanged={handleChanged}
        />
      )}
    </div>
  )
}
