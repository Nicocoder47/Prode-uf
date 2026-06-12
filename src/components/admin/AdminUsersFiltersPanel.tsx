import { Eraser } from 'lucide-react'
import { PremiumButton } from '../ui/PremiumButton'
import type { AdminUsersFilterState } from './AdminUsersFilterState'
import { listActiveAdminUserFilterChips } from './AdminUsersFilterState'

type Props = {
  search: string
  filters: AdminUsersFilterState
  onSearchChange: (value: string) => void
  onFilterChange: (patch: Partial<AdminUsersFilterState>) => void
  onClearChip: (key: string) => void
  onClearAll: () => void
}

const inputClass = 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white'
const selectClass = inputClass

export function AdminUsersFiltersPanel({
  search,
  filters,
  onSearchChange,
  onFilterChange,
  onClearChip,
  onClearAll,
}: Props) {
  const chips = listActiveAdminUserFilterChips(search, filters)
  const hasActive = chips.length > 0

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <input
          className={`${inputClass} lg:col-span-2`}
          placeholder="Buscar legajo, nombre, email o DNI"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
        <select className={selectClass} value={filters.reviewFilter} onChange={e => onFilterChange({ reviewFilter: e.target.value })}>
          <option value="">Revisión: todos</option>
          <option value="verified">Verificado</option>
          <option value="review_required">En revisión</option>
          <option value="manually_approved">Aprobado manual</option>
          <option value="rejected">Rechazado</option>
        </select>
        <select className={selectClass} value={filters.accountFilter} onChange={e => onFilterChange({ accountFilter: e.target.value })}>
          <option value="">Cuenta: todas</option>
          <option value="active">Activos</option>
          <option value="blocked">Bloqueados</option>
          <option value="deleted">Eliminados</option>
        </select>
        <select className={selectClass} value={filters.roleFilter} onChange={e => onFilterChange({ roleFilter: e.target.value })}>
          <option value="">Rol: todos</option>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <select className={selectClass} value={filters.predFilter} onChange={e => onFilterChange({ predFilter: e.target.value })}>
          <option value="">Predicciones: todas</option>
          <option value="with">Con predicciones</option>
          <option value="without">Sin predicciones</option>
        </select>
        <select className={selectClass} value={filters.passwordFilter} onChange={e => onFilterChange({ passwordFilter: e.target.value })}>
          <option value="">Contraseña: todas</option>
          <option value="must">Debe cambiar</option>
          <option value="ok">Actualizada</option>
        </select>
        <label className={`${inputClass} flex items-center gap-2`}>
          <input type="checkbox" checked={filters.active7dFilter} onChange={e => onFilterChange({ active7dFilter: e.target.checked })} />
          Activos 7d
        </label>
        <select className={selectClass} value={filters.testFilter} onChange={e => onFilterChange({ testFilter: e.target.value })}>
          <option value="">Tipo: todos</option>
          <option value="real">Usuarios reales</option>
          <option value="test">Usuarios de prueba</option>
        </select>
        <label className={`${inputClass} flex items-center gap-2`}>
          <input type="checkbox" checked={filters.todayFilter} onChange={e => onFilterChange({ todayFilter: e.target.checked })} />
          Registrados hoy
        </label>
        <label className={`${inputClass} flex items-center gap-2`}>
          <input type="checkbox" checked={filters.noLoginFilter} onChange={e => onFilterChange({ noLoginFilter: e.target.checked })} />
          Sin login
        </label>
      </div>

      {hasActive && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(chip => (
            <button key={chip.key} type="button" className="admin-users-filter-chip" onClick={() => onClearChip(chip.key)}>
              {chip.label}
              <span aria-hidden>×</span>
            </button>
          ))}
          <PremiumButton size="sm" variant="ghost" onClick={onClearAll}>
            <Eraser className="h-3.5 w-3.5" />
            Limpiar todo
          </PremiumButton>
        </div>
      )}
    </div>
  )
}
