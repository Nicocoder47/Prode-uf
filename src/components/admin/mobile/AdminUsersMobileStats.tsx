import { ShieldAlert, Target, Trophy, Users } from 'lucide-react'
import type { AdminUserRow } from '../../../types/admin'

type Props = {
  users: AdminUserRow[]
  filteredCount: number
}

export function AdminUsersMobileStats({ users, filteredCount }: Props) {
  const active = users.filter(u => !u.deleted_at && u.is_active && !u.is_blocked).length
  const review = users.filter(u => u.review_status === 'review_required').length
  const withPred = users.filter(u => u.predictions_count > 0).length
  const totalPts = users.reduce((sum, u) => sum + (u.total_points ?? 0), 0)

  const stats = [
    { icon: Users, label: 'Registrados', value: String(users.length), accent: 'gold' },
    { icon: Trophy, label: 'Activos', value: String(active), accent: 'green' },
    { icon: ShieldAlert, label: 'En revisión', value: String(review), accent: review > 0 ? 'red' : 'muted' },
    { icon: Target, label: 'Con pred.', value: String(withPred), accent: 'blue' },
  ] as const

  return (
    <section className="admin-users-mobile-stats">
      <div className="admin-users-mobile-stats__hero">
        <p className="admin-users-mobile-stats__kicker">Identidad · Centro de control</p>
        <h2 className="admin-users-mobile-stats__title">Usuarios</h2>
        <p className="admin-users-mobile-stats__subtitle">
          {filteredCount === users.length
            ? `${users.length} miembros registrados`
            : `${filteredCount} resultados de ${users.length}`}
          {totalPts > 0 && <span className="admin-users-mobile-stats__pts"> · {totalPts.toLocaleString('es-AR')} pts totales</span>}
        </p>
      </div>
      <div className="admin-users-mobile-stats__grid">
        {stats.map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className={`admin-premium-card admin-premium-card--flat admin-premium-card--compact admin-users-mobile-stats__chip admin-users-mobile-stats__chip--${accent}`}>
            <Icon className="admin-users-mobile-stats__icon" strokeWidth={2} />
            <div>
              <span className="admin-users-mobile-stats__value">{value}</span>
              <span className="admin-users-mobile-stats__label">{label}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
