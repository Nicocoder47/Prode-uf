import { Calendar, ChevronRight, Hash, Lock, Target, Trophy } from 'lucide-react'
import { PremiumButton } from '../../ui/PremiumButton'
import type { AdminUserRow } from '../../../types/admin'
import { REVIEW_STATUS_CLASS, REVIEW_STATUS_LABEL } from '../../../utils/reviewStatus'
import { AdminUserAvatar } from './AdminUserAvatar'

type Props = {
  user: AdminUserRow
  accountLabel: string
  accountClass: string
  isTest: boolean
  onView: () => void
  onToggleBlock: () => void
  busy?: boolean
}

function formatDate(value: string | null, empty = '—') {
  if (!value) return empty
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function statusModifier(label: string) {
  const l = label.toLowerCase()
  if (l.includes('activo')) return 'active'
  if (l.includes('bloqueado')) return 'blocked'
  return 'deleted'
}

export function AdminUserMobileCard({
  user,
  accountLabel,
  isTest,
  onView,
  onToggleBlock,
  busy,
}: Props) {
  const blocked = user.is_blocked || !user.is_active || !!user.deleted_at

  return (
    <article
      className={`admin-premium-card admin-user-mobile-card admin-user-mobile-card--${statusModifier(accountLabel)}`}
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onView() }}
    >
      <div className="admin-user-mobile-card__shine" aria-hidden />

      <div className="admin-user-mobile-card__head">
        <AdminUserAvatar name={user.full_name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="admin-user-mobile-card__title-row">
            <h3 className="admin-user-mobile-card__name">{user.full_name}</h3>
            <ChevronRight className="admin-user-mobile-card__chevron h-5 w-5 shrink-0" />
          </div>
          <p className="admin-user-mobile-card__email">{user.email}</p>
          <div className="admin-user-mobile-card__ids">
            {user.legajo && (
              <span className="admin-user-mobile-card__id">
                <Hash className="h-3 w-3" />
                {user.legajo}
              </span>
            )}
            <span className="admin-user-mobile-card__id">
              <Lock className="h-3 w-3" />
              {user.dni_masked}
            </span>
          </div>
        </div>
        <span className={`admin-user-mobile-card__status admin-user-mobile-card__status--${statusModifier(accountLabel)}`}>
          {accountLabel}
        </span>
      </div>

      <div className="admin-user-mobile-card__meta">
        <span className="admin-user-mobile-card__role">{user.role}</span>
        <span className={REVIEW_STATUS_CLASS[user.review_status ?? 'pending']}>
          {REVIEW_STATUS_LABEL[user.review_status ?? 'pending']}
        </span>
        {isTest && <span className="admin-user-mobile-card__test">Test</span>}
        {user.active_last_7d && <span className="admin-user-mobile-card__active7d">Activo 7d</span>}
        {user.must_change_password && <span className="admin-user-mobile-card__pwd">Cambiar clave</span>}
      </div>

      <div className="admin-user-mobile-card__stats">
        <div className="admin-premium-inset admin-user-mobile-card__stat admin-user-mobile-card__stat--gold">
          <Trophy className="h-4 w-4" />
          <div>
            <span className="admin-user-mobile-card__stat-value">{user.total_points}</span>
            <span className="admin-user-mobile-card__stat-label">Puntos</span>
          </div>
        </div>
        <div className="admin-premium-inset admin-user-mobile-card__stat">
          <Target className="h-4 w-4" />
          <div>
            <span className="admin-user-mobile-card__stat-value">{user.predictions_count}</span>
            <span className="admin-user-mobile-card__stat-label">Predicciones</span>
          </div>
        </div>
        <div className="admin-premium-inset admin-user-mobile-card__stat admin-user-mobile-card__stat--wide">
          <Calendar className="h-4 w-4" />
          <div>
            <span className="admin-user-mobile-card__stat-value admin-user-mobile-card__stat-value--sm">
              {formatDate(user.last_login_at, 'Sin login')}
            </span>
            <span className="admin-user-mobile-card__stat-label">Último acceso · Alta {formatDate(user.created_at)}</span>
          </div>
        </div>
      </div>

      {!user.deleted_at && (
        <div className="admin-user-mobile-card__actions" onClick={e => e.stopPropagation()}>
          <PremiumButton size="sm" onClick={onView}>
            Ver perfil
          </PremiumButton>
          <PremiumButton
            size="sm"
            variant={blocked ? 'success' : 'danger'}
            disabled={busy}
            onClick={onToggleBlock}
          >
            {blocked ? 'Desbloquear' : 'Bloquear'}
          </PremiumButton>
        </div>
      )}
    </article>
  )
}
