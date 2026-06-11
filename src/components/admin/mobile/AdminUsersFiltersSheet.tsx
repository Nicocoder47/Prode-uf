import { SlidersHorizontal, X } from 'lucide-react'
import { PremiumButton } from '../../ui/PremiumButton'

type FilterState = {
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

type Props = {
  open: boolean
  onClose: () => void
  filters: FilterState
  onChange: (patch: Partial<FilterState>) => void
  onReset: () => void
  resultCount: number
  totalCount: number
}

export function AdminUsersFiltersSheet({ open, onClose, filters, onChange, onReset, resultCount, totalCount }: Props) {
  if (!open) return null

  return (
    <div className="admin-users-filters-sheet" role="dialog" aria-modal="true" aria-label="Filtros de usuarios">
      <button type="button" className="admin-users-filters-sheet__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="admin-users-filters-sheet__panel">
        <div className="admin-users-filters-sheet__header">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-amber-300" />
            <p className="font-extrabold text-white">Filtros</p>
          </div>
          <button type="button" className="admin-more-sheet__close" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="admin-users-filters-sheet__count">
          {resultCount} de {totalCount} usuarios
        </p>

        <div className="admin-users-filters-sheet__grid">
          <select
            className="admin-users-filters-sheet__input"
            value={filters.reviewFilter}
            onChange={e => onChange({ reviewFilter: e.target.value })}
          >
            <option value="">Revisión: todos</option>
            <option value="verified">Verificado</option>
            <option value="review_required">En revisión</option>
            <option value="manually_approved">Aprobado manual</option>
            <option value="rejected">Rechazado</option>
          </select>
          <select
            className="admin-users-filters-sheet__input"
            value={filters.accountFilter}
            onChange={e => onChange({ accountFilter: e.target.value })}
          >
            <option value="">Cuenta: todas</option>
            <option value="active">Activos</option>
            <option value="blocked">Bloqueados</option>
            <option value="deleted">Eliminados</option>
          </select>
          <select
            className="admin-users-filters-sheet__input"
            value={filters.roleFilter}
            onChange={e => onChange({ roleFilter: e.target.value })}
          >
            <option value="">Rol: todos</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <select
            className="admin-users-filters-sheet__input"
            value={filters.predFilter}
            onChange={e => onChange({ predFilter: e.target.value })}
          >
            <option value="">Predicciones: todas</option>
            <option value="with">Con predicciones</option>
            <option value="without">Sin predicciones</option>
          </select>
          <select
            className="admin-users-filters-sheet__input"
            value={filters.passwordFilter}
            onChange={e => onChange({ passwordFilter: e.target.value })}
          >
            <option value="">Contraseña: todas</option>
            <option value="must">Debe cambiar</option>
            <option value="ok">Actualizada</option>
          </select>
          <select
            className="admin-users-filters-sheet__input"
            value={filters.testFilter}
            onChange={e => onChange({ testFilter: e.target.value })}
          >
            <option value="">Tipo: todos</option>
            <option value="real">Usuarios reales</option>
            <option value="test">Usuarios de prueba</option>
          </select>
          <label className="admin-users-filters-sheet__check">
            <input
              type="checkbox"
              checked={filters.active7dFilter}
              onChange={e => onChange({ active7dFilter: e.target.checked })}
            />
            Activos 7d
          </label>
          <label className="admin-users-filters-sheet__check">
            <input type="checkbox" checked={filters.todayFilter} onChange={e => onChange({ todayFilter: e.target.checked })} />
            Registrados hoy
          </label>
          <label className="admin-users-filters-sheet__check">
            <input type="checkbox" checked={filters.noLoginFilter} onChange={e => onChange({ noLoginFilter: e.target.checked })} />
            Sin login
          </label>
        </div>

        <div className="admin-users-filters-sheet__actions">
          <PremiumButton size="sm" variant="ghost" onClick={onReset}>
            Limpiar
          </PremiumButton>
          <PremiumButton size="sm" onClick={onClose}>
            Aplicar
          </PremiumButton>
        </div>
      </div>
    </div>
  )
}
