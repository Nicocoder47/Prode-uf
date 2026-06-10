import { Link } from 'react-router-dom'
import type { AdminBetaCapacity } from '../../types/admin'
import { MAX_BETA_USERS, WARN_USERS, CRITICAL_USERS } from '../../config/betaMode'
import { BETA300_STATUS_LABELS } from '../../utils/beta300Capacity'

const STATUS_STYLES = {
  green: 'border-emerald-400/40 bg-emerald-500/12',
  yellow: 'border-amber-400/40 bg-amber-500/12',
  red: 'border-red-400/40 bg-red-500/12',
  exceeded: 'border-fuchsia-400/40 bg-fuchsia-500/12',
} as const

type Props = {
  data: AdminBetaCapacity
  compact?: boolean
}

export function AdminBeta300Status({ data, compact }: Props) {
  const status = data.status
  const showBanner = status === 'yellow' || status === 'red' || status === 'exceeded'

  return (
    <div className="space-y-3">
      {showBanner && !compact && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            status === 'yellow' ? 'border-amber-400/40 bg-amber-500/15 text-amber-100' : 'border-red-400/40 bg-red-500/15 text-red-100'
          }`}
        >
          {data.recommendation}
          {data.registration_open === false && ' · Invitaciones cerradas.'}
        </div>
      )}

      <div className={`rounded-2xl border p-4 ${STATUS_STYLES[status]}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Estado Beta 300</p>
            <p className="mt-1 text-2xl font-extrabold text-white">
              {data.registered_users} / {MAX_BETA_USERS}
              <span className="ml-2 text-base font-bold text-white/70">({data.capacity_percent}%)</span>
            </p>
            <p className="mt-1 text-sm text-white/80">
              {BETA300_STATUS_LABELS[status]} — {data.recommendation}
            </p>
          </div>
          <Link
            to="/admin/beta-capacity"
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
          >
            Ver capacidad →
          </Link>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Nuevos hoy" value={String(data.new_users_today)} />
          <Metric label="Activos 24h" value={String(data.active_users_24h)} />
          <Metric label="Predicciones 24h" value={String(data.predictions_24h)} />
          <Metric label="Invitaciones" value={data.registration_open === false ? 'Cerradas' : 'Abiertas'} />
        </div>

        {!compact && (
          <p className="mt-3 text-xs text-white/50">
            Umbrales: verde &lt;{WARN_USERS} · amarillo {WARN_USERS}–{CRITICAL_USERS - 1} · rojo {CRITICAL_USERS}–{MAX_BETA_USERS}
          </p>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase text-white/45">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  )
}
