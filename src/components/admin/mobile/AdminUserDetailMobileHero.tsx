import { Crown, Mail, Hash } from 'lucide-react'
import type { AdminUserRow } from '../../../types/admin'
import { AdminUserAvatar } from './AdminUserAvatar'
import { REVIEW_STATUS_CLASS, REVIEW_STATUS_LABEL } from '../../../utils/reviewStatus'

type Props = {
  user: AdminUserRow
  accountLabel: string
  isTest: boolean
}

export function AdminUserDetailMobileHero({ user, accountLabel, isTest }: Props) {
  const isAdmin = user.role === 'admin'

  return (
    <section className="admin-premium-card admin-premium-card--gold admin-user-detail-hero">
      <div className="admin-user-detail-hero__glow" aria-hidden />
      <div className="admin-user-detail-hero__top">
        <AdminUserAvatar name={user.full_name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="admin-user-detail-hero__badges">
            <span className={`admin-user-detail-hero__status admin-user-detail-hero__status--${accountLabel.toLowerCase()}`}>
              {accountLabel}
            </span>
            {isAdmin && (
              <span className="admin-user-detail-hero__admin">
                <Crown className="h-3 w-3" />
                Admin
              </span>
            )}
            {isTest && <span className="admin-user-detail-hero__test">Test</span>}
          </div>
          <h2 className="admin-user-detail-hero__name">{user.full_name}</h2>
          <p className="admin-user-detail-hero__meta">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{user.email}</span>
          </p>
          {user.legajo && (
            <p className="admin-user-detail-hero__meta">
              <Hash className="h-3.5 w-3.5 shrink-0" />
              <span>Legajo {user.legajo}</span>
            </p>
          )}
        </div>
      </div>

      <div className="admin-user-detail-hero__kpis">
        <div className="admin-premium-inset admin-user-detail-hero__kpi admin-user-detail-hero__kpi--gold">
          <span className="admin-user-detail-hero__kpi-value">{user.total_points}</span>
          <span className="admin-user-detail-hero__kpi-label">Puntos</span>
        </div>
        <div className="admin-premium-inset admin-user-detail-hero__kpi">
          <span className="admin-user-detail-hero__kpi-value">{user.predictions_count}</span>
          <span className="admin-user-detail-hero__kpi-label">Predicciones</span>
        </div>
        <div className="admin-premium-inset admin-user-detail-hero__kpi">
          <span className="admin-user-detail-hero__kpi-value">{user.exact_predictions ?? 0}</span>
          <span className="admin-user-detail-hero__kpi-label">Exactas</span>
        </div>
        <div className="admin-premium-inset admin-user-detail-hero__kpi">
          <span className="admin-user-detail-hero__kpi-value">{user.hit_predictions ?? 0}</span>
          <span className="admin-user-detail-hero__kpi-label">Aciertos</span>
        </div>
      </div>

      <div className="admin-user-detail-hero__footer">
        <span className={REVIEW_STATUS_CLASS[user.review_status ?? 'pending']}>
          {REVIEW_STATUS_LABEL[user.review_status ?? 'pending']}
        </span>
        <span className="admin-user-detail-hero__dni">DNI {user.dni_masked}</span>
      </div>
    </section>
  )
}
