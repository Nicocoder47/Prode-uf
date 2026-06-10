import type { ReactNode } from 'react'
import { PremiumCard, StatsPill } from '../../components/ui/PremiumCard'
import { BetaCapacityAlerts } from '../../components/admin/BetaCapacityAlerts'
import { RegistrationToggle } from '../../components/admin/RegistrationToggle'
import { useAdminBetaCapacity } from '../../hooks/useAdminQueries'
import {
  BETA300_ACTION_LABELS,
  BETA300_STATUS_LABELS,
  type Beta300Status,
} from '../../utils/beta300Capacity'
import { BETA_MODE, ENABLE_REALTIME, MAX_BETA_USERS } from '../../config/betaMode'

const STATUS_STYLES: Record<Beta300Status, string> = {
  green: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  yellow: 'border-amber-400/40 bg-amber-500/15 text-amber-100',
  red: 'border-red-400/40 bg-red-500/15 text-red-100',
  exceeded: 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100',
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' }) {
  const tones = {
    neutral: 'border-white/15 bg-white/5 text-white/80',
    ok: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
    warn: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
    danger: 'border-red-400/30 bg-red-500/10 text-red-100',
  }
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  )
}

function statusTone(status: Beta300Status): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'green') return 'ok'
  if (status === 'yellow') return 'warn'
  return 'danger'
}

export default function AdminBetaCapacityPage() {
  const { data, isLoading, error } = useAdminBetaCapacity()

  if (isLoading) {
    return <p className="text-white/60">Cargando métricas de beta…</p>
  }

  if (error || !data) {
    return (
      <p className="text-red-300">
        No se pudieron cargar métricas. Aplicá las migraciones beta_300 en Supabase.
      </p>
    )
  }

  const status = data.status
  const dh = data.device_health

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Beta cerrada</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Estado de Beta / Capacidad</h2>
        <p className="mt-1 text-sm text-white/55">
          Máximo {MAX_BETA_USERS} usuarios · polling {ENABLE_REALTIME ? 'OFF (realtime ON)' : 'ON'} · beta={String(BETA_MODE)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="neutral">Beta 300</Badge>
          <Badge tone={statusTone(status)}>Estado: {BETA300_STATUS_LABELS[status]}</Badge>
          <Badge tone={data.capacity_percent >= 80 ? 'warn' : 'ok'}>
            Capacidad usada: {data.capacity_percent}%
          </Badge>
          <Badge tone="neutral">Nuevos usuarios hoy: {data.new_users_today}</Badge>
          {dh && (
            <Badge tone={dh.mobile_error_share_pct > 60 ? 'warn' : 'neutral'}>
              Problemas móviles: {dh.mobile_error_share_pct}%
            </Badge>
          )}
        </div>
      </div>

      <div className={`rounded-2xl border px-5 py-4 ${STATUS_STYLES[status]}`}>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">Semáforo beta 300</p>
        <p className="mt-1 text-lg font-extrabold">
          {data.registered_users} / {MAX_BETA_USERS} usuarios — {BETA300_STATUS_LABELS[status]}
        </p>
        <p className="mt-2 text-sm opacity-90">{data.recommendation}</p>
        <p className="mt-1 text-sm opacity-80">
          Concurrentes estimados: ~{data.estimated_concurrent_users} · Acción:{' '}
          {BETA300_ACTION_LABELS[data.technical_action]}
        </p>
      </div>

      <RegistrationToggle
        enabled={data.registration_open !== false}
        suggestClose={data.status === 'red' || data.status === 'exceeded'}
      />

      <PremiumCard title="Alertas preventivas" description="Señales antes de saturar">
        <BetaCapacityAlerts data={data} />
      </PremiumCard>

      <PremiumCard title="Performance (load tests)" description="Desde último snapshot">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatsPill label="read_p95_ms" value={data.read_p95_ms != null ? `${Math.round(data.read_p95_ms)}ms` : '—'} />
          <StatsPill label="save_prediction_p95_ms" value={data.save_p95_ms != null ? `${Math.round(data.save_p95_ms)}ms` : '—'} />
          <StatsPill label="Auth 429 (24h)" value={String(data.auth_errors_429_24h ?? 0)} highlight={(data.auth_errors_429_24h ?? 0) === 0} />
          <StatsPill label="Deben cambiar clave" value={String(data.users_must_change_password ?? 0)} />
        </div>
      </PremiumCard>

      <PremiumCard title="Contadores principales" description="Crecimiento y uso">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatsPill label="Usuarios registrados" value={String(data.registered_users)} highlight />
          <StatsPill label="Nuevos hoy" value={String(data.new_users_today)} />
          <StatsPill label="Nuevos 7 días" value={String(data.new_users_7d)} />
          <StatsPill label="Activos 24h" value={String(data.active_users_24h)} />
          <StatsPill label="Activos 7 días" value={String(data.active_users_7d)} />
          <StatsPill label="Capacidad usada" value={`${data.capacity_percent}%`} highlight />
          <StatsPill label="Concurrentes estimados" value={String(data.estimated_concurrent_users)} />
          <StatsPill label="Predicciones totales" value={String(data.total_predictions)} />
          <StatsPill label="Predicciones 24h" value={String(data.predictions_24h)} />
          <StatsPill label="Predicciones 7d" value={String(data.predictions_7d)} />
          <StatsPill label="Usuarios que jugaron" value={`${data.users_played_pct}%`} />
        </div>
      </PremiumCard>

      <PremiumCard title="Recomendación técnica" description="Sin implementar migración automática">
        <div className="space-y-3">
          <p className="text-2xl font-extrabold text-amber-200">
            {BETA300_ACTION_LABELS[data.technical_action]}
          </p>
          {data.migration_needed && (
            <p className="text-sm font-bold text-red-300">
              Migración recomendada — no abrir más invitaciones hasta resolver.
            </p>
          )}
          <ul className="list-inside list-disc space-y-1 text-sm text-white/70">
            {data.reasons.map(r => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/65">
            <p className="font-bold text-white/85">Si migrás (manual):</p>
            <p>1. Supabase Pro (~USD 25/mes)</p>
            <p>2. Render Worker (~USD 7/mes)</p>
            <p className="mt-2 text-white/50">No pagar Redis ni Vercel Pro sin evidencia.</p>
          </div>
        </div>
      </PremiumCard>

      {dh && (
        <PremiumCard title="Problemas por dispositivo" description="Últimas 24h — device_reports">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatsPill label="Reportes 24h" value={String(dh.reports_24h)} />
            <StatsPill label="Errores 24h" value={String(dh.errors_24h)} highlight={dh.errors_24h === 0} />
            <StatsPill label="% errores" value={`${dh.error_rate}%`} highlight={dh.error_rate <= 5} />
            <StatsPill
              label="Mobile % errores"
              value={`${dh.mobile_error_share_pct}%`}
              highlight={dh.mobile_error_share_pct <= 60}
            />
          </div>

          {dh.mobile_error_share_pct > 60 && dh.errors_24h > 0 && (
            <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Advertencia: mobile concentra más del 60% de los errores.
            </p>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-white/50">Errores por dispositivo</p>
              <ul className="space-y-1 text-sm text-white/70">
                {Object.entries(dh.errors_by_device).map(([k, v]) => (
                  <li key={k}>{k}: {v}</li>
                ))}
                {Object.keys(dh.errors_by_device).length === 0 && <li>Sin errores</li>}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-white/50">Errores por navegador</p>
              <ul className="space-y-1 text-sm text-white/70">
                {Object.entries(dh.errors_by_browser).map(([k, v]) => (
                  <li key={k}>{k}: {v}</li>
                ))}
                {Object.keys(dh.errors_by_browser).length === 0 && <li>Sin errores</li>}
              </ul>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-white/50">Rutas con más errores</p>
              <ul className="space-y-1 text-sm text-white/70">
                {dh.top_error_routes.map(r => (
                  <li key={r.route}>{r.route}: {r.count}</li>
                ))}
                {dh.top_error_routes.length === 0 && <li>—</li>}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-white/50">Peor performance promedio</p>
              <ul className="space-y-1 text-sm text-white/70">
                {dh.slow_routes.map(r => (
                  <li key={r.route}>{r.route}: {r.avg_ms}ms</li>
                ))}
                {dh.slow_routes.length === 0 && <li>—</li>}
              </ul>
            </div>
          </div>
        </PremiumCard>
      )}

      {data.latest_snapshots?.length > 0 && (
        <PremiumCard title="Historial snapshots" description="system_capacity_snapshots">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-white/70">
              <thead>
                <tr className="border-b border-white/10 text-white/50">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Users</th>
                  <th className="py-2 pr-3">Activos 7d</th>
                  <th className="py-2 pr-3">Preds</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.latest_snapshots.map(s => (
                  <tr key={s.id} className="border-b border-white/5">
                    <td className="py-2 pr-3">{new Date(s.created_at).toLocaleString('es-AR')}</td>
                    <td className="py-2 pr-3">{s.total_users}</td>
                    <td className="py-2 pr-3">{s.active_users_7d}</td>
                    <td className="py-2 pr-3">{s.total_predictions}</td>
                    <td className="py-2 pr-3 uppercase">{s.capacity_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>
      )}

      {data.last_sync && (
        <PremiumCard title="Sync operativo" description="data_sync_logs">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatsPill label="Estado" value={String(data.last_sync.status ?? '—')} />
            <StatsPill label="Errores sync 24h" value={String(data.recent_sync_errors_24h)} highlight={data.recent_sync_errors_24h === 0} />
            <StatsPill label="Auth 429 (24h)" value={String(data.auth_errors_429_24h ?? 0)} highlight={(data.auth_errors_429_24h ?? 0) === 0} />
          </div>
        </PremiumCard>
      )}
    </div>
  )
}
