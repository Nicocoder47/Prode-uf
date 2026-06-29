import { AlertTriangle, KeyRound, RefreshCw } from 'lucide-react'
import { PremiumButton } from '../../ui/PremiumButton'
import { PremiumCard } from '../../ui/PremiumCard'
import { useAdminLoginIssues } from '../../../hooks/useAdminQueries'
import type { AdminLoginAtRiskUser, AdminLoginFailureRow } from '../../../types/admin'

type Props = {
  onSelectUser: (userId: string) => void
  onResetPassword: (userId: string, name: string) => void
  busyUserId?: string | null
}

const ISSUE_LABELS: Record<string, string> = {
  sin_login: 'Sin login',
  clave_cambiada: 'Cambió clave',
  cuenta_inactiva: 'Cuenta inactiva',
  bloqueado: 'Bloqueado',
  debe_cambiar_clave: 'Debe cambiar clave',
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function IssueTags({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-white/40">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(tag => (
        <span key={tag} className="admin-login-issues__tag">
          {ISSUE_LABELS[tag] ?? tag}
        </span>
      ))}
    </div>
  )
}

export function AdminLoginIssuesPanel({ onSelectUser, onResetPassword, busyUserId }: Props) {
  const { data, isLoading, error, refetch, isFetching } = useAdminLoginIssues()
  const summary = data?.summary
  const atRisk = data?.at_risk_users ?? []
  const failures = data?.recent_failures ?? []

  return (
    <div className="admin-login-issues space-y-4">
      <PremiumCard
        title="Problemas de ingreso"
        description="Usuarios que no pueden entrar y errores recientes en /login"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-white/50">
            {summary?.generated_at
              ? `Actualizado ${formatDate(summary.generated_at)}`
              : 'Monitoreo de accesos fallidos'}
          </p>
          <PremiumButton size="sm" variant="ghost" disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw className={`h-3.5 w-3.5${isFetching ? ' animate-spin' : ''}`} />
            Actualizar
          </PremiumButton>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-300">
            {error instanceof Error ? error.message : 'No se pudo cargar el reporte'}
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-white/50">Cargando reporte de logins…</p>
        ) : summary ? (
          <div className="admin-login-issues__stats">
            <Stat label="Sin login nunca" value={summary.never_logged_in} />
            <Stat label="Clave cambiada (no entra con DNI)" value={summary.likely_wrong_password} warn />
            <Stat label="Cuentas inactivas" value={summary.inactive_accounts} warn />
            <Stat label="Bloqueados" value={summary.blocked_accounts} />
            <Stat label="Errores 24 h" value={summary.failed_attempts_24h} warn />
            <Stat label="Errores 7 días" value={summary.failed_attempts_7d} />
          </div>
        ) : null}
      </PremiumCard>

      <PremiumCard title={`Usuarios con problemas (${atRisk.length})`} description="Ordenados por urgencia">
        {isLoading ? (
          <p className="text-sm text-white/50">Cargando…</p>
        ) : atRisk.length === 0 ? (
          <p className="text-sm text-white/50">No hay usuarios con problemas detectados.</p>
        ) : (
          <div className="admin-login-issues__table-wrap">
            <table className="admin-login-issues__table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Problemas</th>
                  <th>Último error</th>
                  <th>Fallos 7d</th>
                  <th>Pred.</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {atRisk.map((u: AdminLoginAtRiskUser) => (
                  <tr key={u.id}>
                    <td>
                      <p className="font-semibold text-white">{u.full_name}</p>
                      <p className="text-xs text-white/50">{u.email}</p>
                      <p className="text-xs text-white/40">
                        DNI {u.dni_masked} · Legajo {u.legajo ?? '—'}
                      </p>
                    </td>
                    <td><IssueTags tags={u.issue_tags} /></td>
                    <td>
                      <p className="text-xs text-red-200/90">{u.last_error_message ?? '—'}</p>
                      <p className="text-[10px] text-white/40">{formatDate(u.last_failed_at)}</p>
                    </td>
                    <td className="text-center">{u.failed_attempts_7d}</td>
                    <td className="text-center">{u.predictions_count}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <button type="button" className="admin-login-issues__btn" onClick={() => onSelectUser(u.id)}>
                          Ver
                        </button>
                        <button
                          type="button"
                          className="admin-login-issues__btn admin-login-issues__btn--accent"
                          disabled={busyUserId === u.id}
                          onClick={() => onResetPassword(u.id, u.full_name)}
                        >
                          <KeyRound className="inline h-3 w-3" />
                          {busyUserId === u.id ? '…' : 'Reset DNI'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>

      <PremiumCard title={`Intentos fallidos recientes (${failures.length})`} description="Cada error al intentar entrar en /login">
        {isLoading ? (
          <p className="text-sm text-white/50">Cargando…</p>
        ) : failures.length === 0 ? (
          <p className="text-sm text-white/50">
            Todavía no hay intentos registrados. Los nuevos errores aparecen acá automáticamente.
          </p>
        ) : (
          <div className="admin-login-issues__failures">
            {failures.map((f: AdminLoginFailureRow) => (
              <div key={f.id} className="admin-login-issues__failure-row">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">
                    {f.full_name ?? f.email}
                    {f.full_name && <span className="ml-2 font-normal text-white/45">{f.email}</span>}
                  </p>
                  <p className="text-xs text-red-200/90">{f.error_message ?? f.error_code ?? 'Error desconocido'}</p>
                  {f.dni_masked && (
                    <p className="text-[10px] text-white/40">DNI {f.dni_masked} · Legajo {f.legajo ?? '—'}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-white/40">{f.attempt_type}</p>
                  <p className="text-xs text-white/55">{formatDate(f.created_at)}</p>
                  {f.user_id && (
                    <button type="button" className="admin-login-issues__btn mt-1" onClick={() => onSelectUser(f.user_id!)}>
                      Ver usuario
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PremiumCard>
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`admin-login-issues__stat${warn && value > 0 ? ' admin-login-issues__stat--warn' : ''}`}>
      {warn && value > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
      <span className="admin-login-issues__stat-value">{value}</span>
      <span className="admin-login-issues__stat-label">{label}</span>
    </div>
  )
}
