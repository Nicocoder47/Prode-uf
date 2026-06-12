import { Copy, Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { AdminUserDetailPadron, AdminUserRow } from '../../types/admin'
import { REVIEW_STATUS_CLASS, REVIEW_STATUS_LABEL } from '../../utils/reviewStatus'

type Props = {
  user: AdminUserRow
  padron: AdminUserDetailPadron | null
  formatDate: (value: string | null | undefined) => string
  accountLabel: string
  isTest: boolean
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-user-info-section">
      <p className="admin-user-info-section__title">{title}</p>
      <div className="admin-user-info-section__grid">{children}</div>
    </section>
  )
}

function InfoField({ label, value, mono, highlight, danger }: { label: string; value: ReactNode; mono?: boolean; highlight?: boolean; danger?: boolean }) {
  return (
    <div className="admin-user-info-field">
      <dt className="admin-user-info-field__label">{label}</dt>
      <dd className={`admin-user-info-field__value${mono ? ' admin-user-info-field__value--mono' : ''}${highlight ? ' admin-user-info-field__value--highlight' : ''}${danger ? ' admin-user-info-field__value--danger' : ''}`}>
        {value ?? '—'}
      </dd>
    </div>
  )
}

function CopyableId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <span className="admin-user-info-copy">
      <span className="admin-user-info-copy__text">{value}</span>
      <button type="button" className="admin-user-info-copy__btn" onClick={copy} title="Copiar ID">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}

function formatDni(user: AdminUserRow, padron: AdminUserDetailPadron | null) {
  if (user.dni) return user.dni
  if (padron?.dni) return padron.dni
  return user.dni_masked
}

export function AdminUserInfoSections({ user, padron, formatDate, accountLabel, isTest }: Props) {
  const reviewStatus = user.review_status ?? 'pending'
  const blocked = user.is_blocked || !user.is_active

  return (
    <div className="admin-user-info-sections space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={REVIEW_STATUS_CLASS[reviewStatus]}>{REVIEW_STATUS_LABEL[reviewStatus]}</span>
        <span className={`admin-user-info-badge${blocked ? ' admin-user-info-badge--danger' : ' admin-user-info-badge--ok'}`}>{accountLabel}</span>
        <span className="admin-user-info-badge">{user.role.toUpperCase()}</span>
        {isTest && <span className="admin-user-info-badge admin-user-info-badge--warn">Test</span>}
        {user.must_change_password && <span className="admin-user-info-badge admin-user-info-badge--warn">Debe cambiar clave</span>}
      </div>

      <InfoSection title="Identidad">
        <InfoField label="Nombre completo" value={user.full_name} />
        <InfoField label="Email" value={user.email} />
        <InfoField label="Legajo" value={user.legajo ?? '—'} mono />
        <InfoField label="DNI" value={formatDni(user, padron)} mono />
        <InfoField label="DNI enmascarado" value={user.dni_masked} mono />
        <InfoField label="ID interno" value={<CopyableId value={user.id} />} mono />
      </InfoSection>

      <InfoSection title="Revisión y padrón">
        <InfoField label="Estado revisión" value={REVIEW_STATUS_LABEL[reviewStatus]} />
        <InfoField label="Motivo revisión" value={user.review_reason ?? '—'} />
        <InfoField label="Revisado el" value={formatDate(user.reviewed_at)} />
        <InfoField label="Coincidencia padrón" value={user.match_label ?? '—'} />
        <InfoField label="Ref. apellido" value={user.reference_last_name ?? padron?.last_name ?? '—'} />
        <InfoField label="Ref. nombre" value={user.reference_first_name ?? padron?.first_name ?? '—'} />
        <InfoField label="Ref. nombre completo" value={user.reference_full_name ?? padron?.full_name ?? '—'} />
        <InfoField
          label="Padrón Excel"
          value={
            padron
              ? `${padron.full_name ?? `${padron.last_name ?? ''} ${padron.first_name ?? ''}`.trim()} · DNI ${padron.dni}`
              : 'No encontrado en padrón'
          }
          danger={!padron}
        />
      </InfoSection>

      <InfoSection title="Cuenta y acceso">
        <InfoField label="Estado cuenta" value={accountLabel} />
        <InfoField label="Rol" value={user.role} />
        <InfoField label="Tipo usuario" value={isTest ? 'Prueba' : 'Real'} />
        <InfoField label="Bloqueado" value={user.is_blocked ? 'Sí' : 'No'} />
        <InfoField label="Motivo bloqueo" value={user.block_reason ?? '—'} />
        <InfoField label="Eliminado el" value={formatDate(user.deleted_at)} />
        <InfoField label="Motivo eliminación" value={user.deleted_reason ?? '—'} />
      </InfoSection>

      <InfoSection title="Seguridad">
        <InfoField label="Contraseña" value={user.must_change_password ? 'Debe cambiar en próximo login' : 'Actualizada'} />
        <InfoField label="Clave actualizada" value={formatDate(user.password_changed_at)} />
      </InfoSection>

      <InfoSection title="Actividad">
        <InfoField label="Alta" value={formatDate(user.created_at)} />
        <InfoField label="Último login" value={formatDate(user.last_login_at)} />
        <InfoField label="Activo últimos 7d" value={user.active_last_7d ? 'Sí' : 'No'} />
        <InfoField label="Sin login" value={user.never_logged_in || !user.last_login_at ? 'Sí' : 'No'} />
        <InfoField label="Registrado hoy" value={user.registered_today ? 'Sí' : 'No'} />
      </InfoSection>

      <InfoSection title="Puntaje y predicciones">
        <InfoField label="Puntos totales" value={user.total_points} highlight />
        <InfoField label="Predicciones" value={user.predictions_count} />
        <InfoField label="Exactas" value={user.exact_predictions ?? 0} />
        <InfoField label="Aciertos" value={user.hit_predictions ?? 0} />
      </InfoSection>
    </div>
  )
}
