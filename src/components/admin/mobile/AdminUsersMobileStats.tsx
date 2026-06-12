import type { AdminUserRow } from '../../../types/admin'

type Props = {
  users: AdminUserRow[]
  filteredCount: number
}

export function AdminUsersMobileStats({ users, filteredCount }: Props) {
  const review = users.filter(u => u.review_status === 'review_required').length
  const verified = users.filter(u => u.review_status === 'verified').length

  return (
    <div className="admin-users-mobile-header">
      <p className="admin-users-mobile-header__kicker">Usuarios</p>
      <h2 className="admin-users-mobile-header__title">
        {filteredCount === users.length ? users.length : `${filteredCount} / ${users.length}`}
        <span className="admin-users-mobile-header__label"> miembros</span>
      </h2>
      <div className="admin-users-mobile-header__chips">
        {verified > 0 && <span className="admin-users-mobile-header__chip admin-users-mobile-header__chip--green">{verified} verificados</span>}
        {review > 0 && <span className="admin-users-mobile-header__chip admin-users-mobile-header__chip--red">{review} en revisión</span>}
      </div>
    </div>
  )
}
