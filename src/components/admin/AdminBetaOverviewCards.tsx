import type { AdminBetaOverview } from '../../types/admin.ts'

type Status = 'ok' | 'warn' | 'error'

function cardStatus(value: number, warnAt: number, errorAt: number): Status {
  if (value >= errorAt) return 'error'
  if (value >= warnAt) return 'warn'
  return 'ok'
}

const STATUS_CLASS: Record<Status, string> = {
  ok: 'border-emerald-400/35 bg-emerald-500/10',
  warn: 'border-amber-400/35 bg-amber-500/10',
  error: 'border-red-400/35 bg-red-500/10',
}

const VALUE_CLASS: Record<Status, string> = {
  ok: 'text-emerald-200',
  warn: 'text-amber-200',
  error: 'text-red-200',
}

function OverviewCard({
  label,
  value,
  hint,
  status = 'ok',
}: {
  label: string
  value: string | number
  hint?: string
  status?: Status
}) {
  return (
    <div className={`rounded-2xl border p-4 ${STATUS_CLASS[status]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${VALUE_CLASS[status]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/55">{hint}</p> : null}
    </div>
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AdminBetaOverviewCards({ data }: { data: AdminBetaOverview }) {
  const capStatus = cardStatus(data.capacity_percent, 73, 93)
  const slotsStatus: Status =
    data.available_slots <= 20 ? 'error' : data.available_slots <= 80 ? 'warn' : 'ok'

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300/80">Beta cerrada</p>
        <h2 className="text-lg font-extrabold text-white">Resumen operativo</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <OverviewCard
          label="Usuarios activos / cupo"
          value={`${data.registered_users} / ${data.max_users}`}
          hint={`${data.capacity_percent}% ocupado`}
          status={capStatus}
        />
        <OverviewCard
          label="Cupos disponibles"
          value={data.available_slots}
          status={slotsStatus}
        />
        <OverviewCard
          label="Nuevos hoy"
          value={data.new_users_today}
          status={data.new_users_today > 15 ? 'warn' : 'ok'}
        />
        <OverviewCard
          label="Sin predicciones"
          value={data.users_without_predictions}
          status={data.users_without_predictions > data.registered_users * 0.5 ? 'warn' : 'ok'}
        />
        <OverviewCard
          label="Con predicciones"
          value={data.users_with_predictions}
          status="ok"
        />
        <OverviewCard
          label="Bloqueados"
          value={data.users_blocked}
          status={data.users_blocked > 0 ? 'warn' : 'ok'}
        />
        <OverviewCard
          label="Usuarios de prueba"
          value={data.test_users_detected}
          status={data.test_users_detected > 0 ? 'warn' : 'ok'}
          hint={data.test_users_detected > 0 ? 'Podés liberar cupos' : 'Sin test detectados'}
        />
        <OverviewCard
          label="Invitaciones"
          value={data.registration_open ? 'Abiertas' : 'Cerradas'}
          status={data.registration_open && data.available_slots < 30 ? 'warn' : 'ok'}
        />
        <OverviewCard
          label="Último cálculo puntajes"
          value={formatDate(data.last_score_calculated_at)}
          status={data.last_score_calculated_at ? 'ok' : 'warn'}
        />
        <OverviewCard
          label="Último partido procesado"
          value={
            data.last_scored_match
              ? `${data.last_scored_match.score_home ?? '—'}-${data.last_scored_match.score_away ?? '—'}`
              : '—'
          }
          hint={data.last_scored_match?.scored_at ? formatDate(data.last_scored_match.scored_at) : 'Sin partidos puntuados'}
          status={data.last_scored_match ? 'ok' : 'warn'}
        />
      </div>
    </div>
  )
}
