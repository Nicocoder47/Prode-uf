import { Calendar, Fingerprint, FileText, User } from 'lucide-react'
import type { AdminUserDetailPadron, AdminUserRow } from '../../../types/admin'

type Props = {
  user: AdminUserRow
  padron: AdminUserDetailPadron | null
  accountLabel: string
  formatDate: (v: string | null | undefined) => string
}

function DataRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="admin-user-data-row">
      <div className="admin-user-data-row__icon">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="admin-user-data-row__content">
        <span className="admin-user-data-row__label">{label}</span>
        <span className="admin-user-data-row__value">{value}</span>
      </div>
    </div>
  )
}

export function AdminUserSummaryMobile({ user, padron, accountLabel, formatDate }: Props) {
  return (
    <div className="admin-user-summary-mobile space-y-3">
      <section className="admin-premium-card admin-premium-panel">
        <p className="admin-premium-panel__title">
          <User className="h-4 w-4 text-amber-300/90" />
          Datos declarados
        </p>
        <div className="admin-premium-panel__body">
          <DataRow icon={User} label="Nombre completo" value={user.full_name} />
          <DataRow icon={Fingerprint} label="DNI" value={user.dni_masked} />
          <DataRow icon={FileText} label="Legajo" value={user.legajo ?? '—'} />
          <DataRow icon={Calendar} label="Registro" value={formatDate(user.created_at)} />
          <DataRow icon={Calendar} label="Último login" value={formatDate(user.last_login_at)} />
          <DataRow icon={FileText} label="Estado cuenta" value={accountLabel} />
          {user.review_reason && (
            <DataRow icon={FileText} label="Motivo revisión" value={user.review_reason} />
          )}
        </div>
      </section>

      <section className={`admin-premium-card admin-premium-panel${padron ? '' : ' admin-premium-panel--alert admin-premium-card--alert'}`}>
        <p className="admin-premium-panel__title">
          <FileText className="h-4 w-4 text-amber-300/90" />
          Padrón de referencia
        </p>
        <div className="admin-premium-panel__body">
          {padron ? (
            <>
              <DataRow icon={User} label="Apellido" value={padron.last_name ?? '—'} />
              <DataRow icon={User} label="Nombre" value={padron.first_name ?? '—'} />
              <DataRow icon={User} label="Nombre completo" value={padron.full_name ?? '—'} />
              <DataRow
                icon={Fingerprint}
                label="DNI padrón"
                value={padron.dni ? `****${String(padron.dni).slice(-4)}` : '—'}
              />
            </>
          ) : (
            <p className="admin-premium-panel__alert-text">
              DNI no encontrado en padrón de referencia. Revisar identidad antes de aprobar.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
