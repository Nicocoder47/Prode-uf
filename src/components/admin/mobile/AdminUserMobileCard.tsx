import type { AdminUserRow } from '../../../types/admin'
import {
  adminUserToneRowClass,
  getAccountStateLabel,
  getVerificationListLabel,
} from '../../../utils/adminUserVisualStatus'

type Props = {
  user: AdminUserRow
  selected?: boolean
  onViewDetails: () => void
}

function formatDate(value: string | null) {
  if (!value) return 'Sin login'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AdminUserMobileCard({ user, selected, onViewDetails }: Props) {
  const toneClass = adminUserToneRowClass(user)
  const verification = getVerificationListLabel(user)

  return (
    <article className={`admin-user-mobile-card-v2 ${toneClass}${selected ? ' is-selected' : ''}`}>
      <div className="admin-user-mobile-card-v2__body">
        <p className="admin-user-mobile-card-v2__name">{user.full_name}</p>
        <p className="admin-user-mobile-card-v2__line">{user.email}</p>
        <p className="admin-user-mobile-card-v2__line">
          Legajo {user.legajo ?? '—'} · DNI {user.dni_masked}
        </p>
        <div className="admin-user-mobile-card-v2__meta">
          <span className="admin-user-mobile-card-v2__pill">{verification}</span>
          <span className="admin-user-mobile-card-v2__pill admin-user-mobile-card-v2__pill--muted">
            {getAccountStateLabel(user)}
          </span>
        </div>
        <p className="admin-user-mobile-card-v2__login">Último login: {formatDate(user.last_login_at)}</p>
      </div>
      <button type="button" className="admin-user-mobile-card-v2__cta" onClick={onViewDetails}>
        Ver detalles
      </button>
    </article>
  )
}
