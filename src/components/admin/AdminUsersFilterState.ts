export type AdminUsersFilterState = {
  reviewFilter: string
  accountFilter: string
  roleFilter: string
  predFilter: string
  passwordFilter: string
  active7dFilter: boolean
  testFilter: string
  todayFilter: boolean
  noLoginFilter: boolean
}

export const EMPTY_ADMIN_USERS_FILTERS: AdminUsersFilterState = {
  reviewFilter: '',
  accountFilter: '',
  roleFilter: '',
  predFilter: '',
  passwordFilter: '',
  active7dFilter: false,
  testFilter: '',
  todayFilter: false,
  noLoginFilter: false,
}

const REVIEW_LABELS: Record<string, string> = {
  verified: 'Verificado',
  review_required: 'En revisión',
  manually_approved: 'Aprobado manual',
  rejected: 'Rechazado',
}

const ACCOUNT_LABELS: Record<string, string> = {
  active: 'Activos',
  blocked: 'Bloqueados',
  deleted: 'Eliminados',
}

const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  admin: 'Admin',
}

const PRED_LABELS: Record<string, string> = {
  with: 'Con predicciones',
  without: 'Sin predicciones',
}

const PASSWORD_LABELS: Record<string, string> = {
  must: 'Debe cambiar clave',
  ok: 'Clave actualizada',
}

const TEST_LABELS: Record<string, string> = {
  real: 'Usuarios reales',
  test: 'Usuarios de prueba',
}

export function countActiveAdminUserFilters(search: string, filters: AdminUsersFilterState) {
  let count = 0
  if (search.trim()) count++
  if (filters.reviewFilter) count++
  if (filters.accountFilter) count++
  if (filters.roleFilter) count++
  if (filters.predFilter) count++
  if (filters.passwordFilter) count++
  if (filters.active7dFilter) count++
  if (filters.testFilter) count++
  if (filters.todayFilter) count++
  if (filters.noLoginFilter) count++
  return count
}

export function listActiveAdminUserFilterChips(search: string, filters: AdminUsersFilterState) {
  const chips: { key: string; label: string }[] = []
  if (search.trim()) chips.push({ key: 'search', label: `Búsqueda: "${search.trim()}"` })
  if (filters.reviewFilter) chips.push({ key: 'reviewFilter', label: REVIEW_LABELS[filters.reviewFilter] ?? filters.reviewFilter })
  if (filters.accountFilter) chips.push({ key: 'accountFilter', label: ACCOUNT_LABELS[filters.accountFilter] ?? filters.accountFilter })
  if (filters.roleFilter) chips.push({ key: 'roleFilter', label: ROLE_LABELS[filters.roleFilter] ?? filters.roleFilter })
  if (filters.predFilter) chips.push({ key: 'predFilter', label: PRED_LABELS[filters.predFilter] ?? filters.predFilter })
  if (filters.passwordFilter) chips.push({ key: 'passwordFilter', label: PASSWORD_LABELS[filters.passwordFilter] ?? filters.passwordFilter })
  if (filters.active7dFilter) chips.push({ key: 'active7dFilter', label: 'Activos 7d' })
  if (filters.testFilter) chips.push({ key: 'testFilter', label: TEST_LABELS[filters.testFilter] ?? filters.testFilter })
  if (filters.todayFilter) chips.push({ key: 'todayFilter', label: 'Registrados hoy' })
  if (filters.noLoginFilter) chips.push({ key: 'noLoginFilter', label: 'Sin login' })
  return chips
}
