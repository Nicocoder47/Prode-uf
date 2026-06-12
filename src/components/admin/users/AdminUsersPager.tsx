import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPrev: () => void
  onNext: () => void
  sticky?: boolean
}

export function AdminUsersPager({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPrev,
  onNext,
  sticky = false,
}: Props) {
  if (totalPages <= 1) return null

  const from = page * pageSize + 1
  const to = Math.min(totalItems, (page + 1) * pageSize)
  const canPrev = page > 0
  const canNext = page < totalPages - 1

  return (
    <nav
      className={`admin-users-pager${sticky ? ' admin-users-pager--sticky' : ''}`}
      aria-label="Paginación de usuarios"
    >
      <p className="admin-users-pager__info">
        <span className="admin-users-pager__page">Página {page + 1} de {totalPages}</span>
        <span className="admin-users-pager__range">{from}–{to} de {totalItems}</span>
      </p>
      <div className="admin-users-pager__actions">
        <button
          type="button"
          className="admin-users-pager__btn"
          disabled={!canPrev}
          onClick={onPrev}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <button
          type="button"
          className="admin-users-pager__btn admin-users-pager__btn--next"
          disabled={!canNext}
          onClick={onNext}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
