import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eraser, SlidersHorizontal } from 'lucide-react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { useAdminUsers, useInvalidateAdmin } from '../../hooks/useAdminQueries.ts'
import type { AdminUserRow } from '../../types/admin.ts'
import { isTestUserEmail } from '../../utils/adminTestUser.ts'
import {
  adminUserToneRowClass,
  getAccountStateLabel,
  getAdminUserVisualTone,
  getVerificationListLabel,
} from '../../utils/adminUserVisualStatus.ts'
import { downloadCsv } from '../../utils/exportCsv'
import { AdminUserMobileCard } from '../../components/admin/mobile/AdminUserMobileCard.tsx'
import { AdminUsersFiltersSheet } from '../../components/admin/mobile/AdminUsersFiltersSheet.tsx'
import { AdminUsersFiltersPanel } from '../../components/admin/AdminUsersFiltersPanel.tsx'
import { EMPTY_ADMIN_USERS_FILTERS, countActiveAdminUserFilters } from '../../components/admin/AdminUsersFilterState.ts'
import { AdminDeletedUsersRecovery, useAdminDeletedUsersPendingCount } from '../../components/admin/users/AdminDeletedUsersRecovery.tsx'
import { AdminUserDetailSheet } from '../../components/admin/users/AdminUserDetailSheet.tsx'
import { AdminUsersPager } from '../../components/admin/users/AdminUsersPager.tsx'
import { AdminUsersTabs, type AdminUsersTab } from '../../components/admin/users/AdminUsersTabs.tsx'

const PAGE_SIZE = 25

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
  const { data: users = [], isLoading, error, refetch } = useAdminUsers()
  const { invalidateUsers, invalidateBetaOverview, invalidateDashboard } = useInvalidateAdmin()
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminUsersTab>('all')
  const recoveryCount = useAdminDeletedUsersPendingCount()

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

  const tabCounts = useMemo(() => ({
    all: users.length,
    review: users.filter(u => getAdminUserVisualTone(u) === 'red').length,
    verified: users.filter(u => getAdminUserVisualTone(u) === 'green').length,
    recovery: recoveryCount,
  }), [users, recoveryCount])

  const tabFiltered = useMemo(() => {
    if (activeTab === 'recovery') return []
    return filtered.filter(u => {
      if (activeTab === 'all') return true
      const tone = getAdminUserVisualTone(u)
      if (activeTab === 'review') return tone === 'red'
      if (activeTab === 'verified') return tone === 'green'
      return true
    })
  }, [filtered, activeTab])

  const totalPages = Math.max(1, Math.ceil(tabFiltered.length / PAGE_SIZE))
  const pageUsers = tabFiltered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const selectedUser = users.find(u => u.id === selectedUserId) ?? null
  const isRecoveryTab = activeTab === 'recovery'

  useEffect(() => {
    const userId = searchParams.get('userId')
    if (!userId || !users.length) return
    const found = users.find(u => u.id === userId)
    if (!found) return
    setSelectedUserId(found.id)
    setDetailOpen(true)
  }, [searchParams, users])

  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(totalPages - 1)
  }, [page, totalPages])

  function goPrevPage() {
    setPage(p => Math.max(0, p - 1))
  }

  function goNextPage() {
    setPage(p => Math.min(totalPages - 1, p + 1))
  }

  const pagerProps = {
    page,
    totalPages,
    totalItems: tabFiltered.length,
    pageSize: PAGE_SIZE,
    onPrev: goPrevPage,
    onNext: goNextPage,
  }

  function changeTab(tab: AdminUsersTab) {
    setActiveTab(tab)
    setPage(0)
    if (tab === 'recovery') {
      setSelectedUserId(null)
      setDetailOpen(false)
      setSearchParams({})
    }
  }

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

  function selectUser(u: AdminUserRow) {
    setSelectedUserId(u.id)
    setSearchParams({ userId: u.id })
    setDetailOpen(true)
  }

  function closeDetail() {
    setSelectedUserId(null)
    setDetailOpen(false)
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

  return (
    <div className="admin-users-page admin-users-page--scroll">
      <header className="admin-users-page__header admin-users-desktop-only">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Identidad</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Usuarios</h2>
        <p className="mt-1 text-sm text-white/50">Revisión automática por DNI vs padrón Excel</p>
      </header>

      <AdminUsersTabs active={activeTab} counts={tabCounts} onChange={changeTab} />

      {error && (
        <PremiumCard variant="dark" className="admin-users-page__block">
          <p className="text-red-300">{error instanceof Error ? error.message : 'Error'}</p>
        </PremiumCard>
      )}

      {!isRecoveryTab && (
      <div className="admin-users-mobile-toolbar admin-users-mobile-only sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-20 -mx-1 space-y-2 border-b border-white/10 bg-[#041418]/95 px-1 py-2 backdrop-blur-xl">
        <input
          className="admin-users-mobile-toolbar__search"
          placeholder="Buscar legajo, nombre, email o DNI"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">
            {tabFiltered.length} de {users.length}
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
      )}

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

      {!isRecoveryTab && (
      <PremiumCard title="Filtros" description={`${tabFiltered.length} de ${users.length} usuarios`} className="admin-users-filters-card admin-users-desktop-only">
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
      )}

      {isRecoveryTab ? (
        <PremiumCard className="admin-users-recovery-card admin-users-mobile-only">
          <AdminDeletedUsersRecovery />
        </PremiumCard>
      ) : (
      <>
      {/* Mobile: cards */}
      <div className="admin-users-mobile-list admin-users-mobile-only">
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
              onViewDetails={() => selectUser(u)}
            />
          ))
        )}
      </div>

      {!isLoading && (
        <div className="admin-users-page__pager-mobile admin-users-mobile-only">
          <AdminUsersPager {...pagerProps} sticky />
        </div>
      )}
      </>
      )}

      {isRecoveryTab && (
        <div className="admin-users-desktop-only">
          <PremiumCard className="admin-users-recovery-card">
            <AdminDeletedUsersRecovery />
          </PremiumCard>
        </div>
      )}

      {!isRecoveryTab && (
        <div className="admin-users-desktop-table admin-users-desktop-only">
          {isLoading ? (
            <p className="admin-users-desktop-table__loading">Cargando usuarios…</p>
          ) : pageUsers.length === 0 ? (
            <div className="admin-users-empty-premium">
              <p className="admin-users-empty-premium__title">Sin resultados</p>
              <p className="admin-users-empty-premium__hint">Probá otro término o limpiá los filtros.</p>
              <PremiumButton size="sm" variant="ghost" onClick={resetFilters}>Limpiar filtros</PremiumButton>
            </div>
          ) : (
            <>
              <div className="admin-users-desktop-table__scroll">
                <table className="admin-users-table-v2 admin-users-table-v2--full w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Legajo</th>
                      <th>DNI</th>
                      <th>Estado</th>
                      <th>Verificación</th>
                      <th>Puntos</th>
                      <th className="admin-users-table-v2__col-action">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageUsers.map(u => {
                      const tone = adminUserToneRowClass(u)
                      return (
                        <tr key={u.id} className={tone}>
                          <td className="admin-users-table-v2__col-user">
                            <p className="admin-users-table-v2__name">{u.full_name}</p>
                            <p className="admin-users-table-v2__sub">{u.email}</p>
                          </td>
                          <td className="admin-users-table-v2__col-narrow">{u.legajo ?? '—'}</td>
                          <td className="admin-users-table-v2__col-narrow">{u.dni_masked}</td>
                          <td className="admin-users-table-v2__col-status">{getAccountStateLabel(u)}</td>
                          <td className="admin-users-table-v2__col-verify">
                            <span className={`admin-users-table-v2__verification admin-users-table-v2__verification--${tone.replace('admin-user-tone--', '')}`}>
                              {getVerificationListLabel(u)}
                            </span>
                          </td>
                          <td className="admin-users-table-v2__col-narrow">{u.total_points}</td>
                          <td className="admin-users-table-v2__col-action">
                            <button
                              type="button"
                              className="admin-users-table-v2__details-btn"
                              onClick={() => selectUser(u)}
                            >
                              Detalles
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <AdminUsersPager {...pagerProps} />
            </>
          )}
        </div>
      )}

      {detailOpen && selectedUser && (
        <AdminUserDetailSheet
          user={selectedUser}
          onClose={closeDetail}
          onChanged={handleChanged}
        />
      )}
    </div>
  )
}
