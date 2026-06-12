import { ChevronRight } from 'lucide-react'
import type { AdminUserRow } from '../../../types/admin'
import { REVIEW_STATUS_CLASS, REVIEW_STATUS_LABEL, reviewRowClass } from '../../../utils/reviewStatus'

type Props = {
  user: AdminUserRow
  accountLabel: string
  accountClass: string
  isTest: boolean
  onView: () => void
  onManage: () => void
}

function formatDate(value: string | null) {
  if (!value) return 'Sin login'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AdminUserMobileCard({
  user,
  accountLabel,
  accountClass,
  isTest,
  onView,
  onManage,
}: Props) {
  const reviewStatus = user.review_status ?? 'pending'
  const rowTone = reviewRowClass(reviewStatus)
    || (reviewStatus === 'verified' ? 'admin-user-row--verified' : '')

  return (
    <div className={`admin-user-mobile-row ${rowTone}`}>
      <button type="button" className="admin-user-mobile-row__main" onClick={onView}>
        <div className="admin-user-mobile-row__top">
          <div className="min-w-0 flex-1">
            <p className="admin-user-mobile-row__name">{user.full_name}</p>
            <p className="admin-user-mobile-row__sub">
              {user.legajo ? `${user.legajo} · ` : ''}{user.dni_masked}
            </p>
            <p className="admin-user-mobile-row__email">{user.email}</p>
          </div>
          <div className="admin-user-mobile-row__scores">
            <span className="admin-user-mobile-row__pts">{user.total_points} pts</span>
            <span className="admin-user-mobile-row__pred">{user.predictions_count} pred.</span>
          </div>
          <ChevronRight className="admin-user-mobile-row__chevron h-4 w-4 shrink-0" />
        </div>

        <div className="admin-user-mobile-row__badges">
          <span className={REVIEW_STATUS_CLASS[reviewStatus]}>
            {REVIEW_STATUS_LABEL[reviewStatus]}
          </span>
          <span className={`admin-user-mobile-row__account ${accountClass}`}>{accountLabel}</span>
          {isTest && <span className="admin-user-mobile-row__tag">Test</span>}
        </div>

        <p className="admin-user-mobile-row__meta">
          Login: {formatDate(user.last_login_at)} · Alta: {formatDate(user.created_at)}
        </p>
      </button>

      {user.role !== 'admin' && !user.deleted_at && (
        <button type="button" className="admin-user-mobile-row__manage" onClick={onManage}>
          Gestionar
        </button>
      )}
    </div>
  )
}
