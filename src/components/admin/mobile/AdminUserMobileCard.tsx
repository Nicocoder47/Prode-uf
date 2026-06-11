import { MoreHorizontal } from 'lucide-react'
import { PremiumButton } from '../../ui/PremiumButton'
import type { AdminUserRow } from '../../../types/admin'
import { REVIEW_STATUS_CLASS, REVIEW_STATUS_LABEL } from '../../../utils/reviewStatus'

type Props = {
  user: AdminUserRow
  accountLabel: string
  accountClass: string
  isTest: boolean
  onView: () => void
  onToggleBlock: () => void
  onMore: () => void
  busy?: boolean
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AdminUserMobileCard({
  user,
  accountLabel,
  accountClass,
  isTest,
  onView,
  onToggleBlock,
  onMore,
  busy,
}: Props) {
  const blocked = user.is_blocked || !user.is_active || !!user.deleted_at

  return (
    <article className="admin-user-mobile-card">
      <div className="admin-user-mobile-card__head">
        <div className="min-w-0">
          <h3 className="admin-user-mobile-card__name">{user.full_name}</h3>
          <p className="admin-user-mobile-card__email">{user.email}</p>
        </div>
        <span className={`admin-user-mobile-card__status ${accountClass}`}>{accountLabel}</span>
      </div>

      <div className="admin-user-mobile-card__meta">
        <span className="admin-user-mobile-card__badge">{user.role}</span>
        <span className={REVIEW_STATUS_CLASS[user.review_status ?? 'pending']}>
          {REVIEW_STATUS_LABEL[user.review_status ?? 'pending']}
        </span>
        {isTest && <span className="admin-user-mobile-card__test">Test</span>}
      </div>

      <div className="admin-user-mobile-card__stats">
        <div>
          <span className="admin-user-mobile-card__stat-label">Puntos</span>
          <span className="admin-user-mobile-card__stat-value">{user.total_points}</span>
        </div>
        <div>
          <span className="admin-user-mobile-card__stat-label">Predicciones</span>
          <span className="admin-user-mobile-card__stat-value">{user.predictions_count}</span>
        </div>
        <div>
          <span className="admin-user-mobile-card__stat-label">Último login</span>
          <span className="admin-user-mobile-card__stat-value admin-user-mobile-card__stat-value--sm">
            {formatDate(user.last_login_at)}
          </span>
        </div>
        <div>
          <span className="admin-user-mobile-card__stat-label">Alta</span>
          <span className="admin-user-mobile-card__stat-value admin-user-mobile-card__stat-value--sm">
            {formatDate(user.created_at)}
          </span>
        </div>
      </div>

      <div className="admin-user-mobile-card__actions">
        <PremiumButton size="sm" variant="ghost" onClick={onView}>
          Ver
        </PremiumButton>
        {!user.deleted_at && (
          <PremiumButton size="sm" variant={blocked ? 'primary' : 'danger'} disabled={busy} onClick={onToggleBlock}>
            {blocked ? 'Desbloquear' : 'Bloquear'}
          </PremiumButton>
        )}
        <PremiumButton size="sm" variant="ghost" onClick={onMore} aria-label="Más acciones">
          <MoreHorizontal className="h-4 w-4" />
        </PremiumButton>
      </div>
    </article>
  )
}
